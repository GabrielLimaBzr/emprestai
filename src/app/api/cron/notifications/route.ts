import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'

interface PushSub {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const hojeISO = new Date().toISOString().split('T')[0]

  // O status de atraso é função da data, mas nada o atualizava sozinho: só a
  // sincronização manual em Configurações. Sem isso a parcela vencia e seguia
  // "pendente" na lista, no dashboard, nos relatórios e no extrato do cliente
  // — e este próprio cron lê 'atrasado' para alertar, então avisava tarde.
  const [vencidas, reagendadas] = await Promise.all([
    supabase
      .from('parcelas')
      .update({ status: 'atrasado' })
      .eq('status', 'pendente')
      .lt('data_vencimento', hojeISO)
      .select('id'),
    // Simétrico: se o vencimento foi empurrado para frente (edição de contrato,
    // renegociação), a parcela deixa de estar em atraso.
    supabase
      .from('parcelas')
      .update({ status: 'pendente' })
      .eq('status', 'atrasado')
      .gte('data_vencimento', hojeISO)
      .select('id'),
  ])

  const statusSincronizados = (vencidas.data?.length ?? 0) + (reagendadas.data?.length ?? 0)

  // Buscar todas as subscriptions agrupadas por user_id
  const { data: allSubs, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth') as { data: PushSub[] | null; error: unknown }

  if (error) return Response.json({ error: String(error) }, { status: 500 })
  if (!allSubs?.length) return Response.json({ ok: true, enviadas: 0, statusSincronizados })

  // Agrupar subscriptions por usuário
  const porUsuario = new Map<string, PushSub[]>()
  for (const s of allSubs) {
    if (!porUsuario.has(s.user_id)) porUsuario.set(s.user_id, [])
    porUsuario.get(s.user_id)!.push(s)
  }

  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]
  const ehSegundaFeira = hoje.getDay() === 1

  let totalEnviadas = 0

  for (const [userId, subs] of Array.from(porUsuario.entries())) {
    // Preferências do usuário via admin API
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    const diasAntecedencia: number = user?.user_metadata?.preferencias?.dias_antecedencia ?? 3
    const limiteStr = new Date(hoje.getTime() + diasAntecedencia * 86400000).toISOString().split('T')[0]

    // Parcelas vencendo em breve
    const { data: vencendo } = await supabase
      .from('parcelas')
      .select('id, numero, valor_esperado, data_vencimento, emprestimo_id, emprestimo:emprestimos(id, tomador:tomadores(nome))')
      .eq('user_id', userId)
      .eq('status', 'pendente')
      .gte('data_vencimento', hojeStr)
      .lte('data_vencimento', limiteStr)
      .order('data_vencimento')

    // Parcelas em atraso
    const { data: atrasadas } = await supabase
      .from('parcelas')
      .select('id, numero, valor_esperado, data_vencimento, emprestimo_id, emprestimo:emprestimos(id, tomador:tomadores(nome))')
      .eq('user_id', userId)
      .eq('status', 'atrasado')
      .lt('data_vencimento', hojeStr)
      .order('data_vencimento')

    const payloads: string[] = []

    // Resumo semanal (segunda-feira)
    if (ehSegundaFeira && vencendo?.length) {
      const total = vencendo.reduce((s, p) => s + p.valor_esperado, 0)
      payloads.push(JSON.stringify({
        title: '📊 Resumo da semana',
        body: `Você tem ${vencendo.length} vencimento${vencendo.length > 1 ? 's' : ''} esta semana — Total: ${formatCurrency(total)}`,
        url: '/parcelas?status=pendente',
        tag: 'resumo-semanal',
      }))
    }

    // Alerta por parcela vencendo
    for (const p of vencendo ?? []) {
      const nome = (p.emprestimo as any)?.tomador?.nome ?? 'Tomador'
      const empId = (p.emprestimo as any)?.id
      const diasRestantes = Math.round((new Date(p.data_vencimento).getTime() - hoje.getTime()) / 86400000)
      const quando = diasRestantes === 0 ? 'hoje' : diasRestantes === 1 ? 'amanhã' : `em ${diasRestantes} dias`
      payloads.push(JSON.stringify({
        title: `📅 Vencimento ${quando}`,
        body: `${nome} — ${formatCurrency(p.valor_esperado)} vence em ${formatDate(p.data_vencimento)}`,
        url: empId ? `/emprestimos/${empId}` : '/parcelas',
        tag: `vencimento-${p.id}`,
      }))
    }

    // Alerta por empréstimo atrasado (1 push por empréstimo)
    const emprestimosAlertados = new Set<string>()
    for (const p of atrasadas ?? []) {
      if (emprestimosAlertados.has(p.emprestimo_id)) continue
      emprestimosAlertados.add(p.emprestimo_id)
      const nome = (p.emprestimo as any)?.tomador?.nome ?? 'Tomador'
      const empId = (p.emprestimo as any)?.id
      const diasAtraso = Math.floor((hoje.getTime() - new Date(p.data_vencimento).getTime()) / 86400000)
      payloads.push(JSON.stringify({
        title: '⚠️ Parcela em atraso',
        body: `${nome} — ${formatCurrency(p.valor_esperado)} está ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} em atraso`,
        url: empId ? `/emprestimos/${empId}` : '/parcelas?status=atrasado',
        tag: `atraso-${p.emprestimo_id}`,
      }))
    }

    // Enviar todos os payloads para as subscriptions do usuário
    for (const payload of payloads) {
      const results = await Promise.allSettled(
        subs.map((s) =>
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
        )
      )
      totalEnviadas += results.filter((r) => r.status === 'fulfilled').length

      // Limpar subscriptions inválidas (410 Gone)
      const invalidas = results
        .map((r, i) => (r.status === 'rejected' && (r as any).reason?.statusCode === 410 ? subs[i].endpoint : null))
        .filter(Boolean)

      if (invalidas.length) {
        await supabase.from('push_subscriptions').delete().in('endpoint', invalidas)
      }

      await new Promise((r) => setTimeout(r, 150))
    }
  }

  return Response.json({ ok: true, enviadas: totalEnviadas, usuarios: porUsuario.size, statusSincronizados })
}
