'use server'

import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function saveSubscription(sub: PushSubscriptionJSON): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: sub.endpoint!,
    p256dh: (sub.keys as any).p256dh,
    auth: (sub.keys as any).auth,
  }, { onConflict: 'endpoint' })

  if (error) throw new Error(error.message)
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

export async function sendTestNotification(): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs?.length) throw new Error('Nenhuma inscrição push ativa. Ative as notificações primeiro.')

  const payload = JSON.stringify({
    title: 'emprestAI — Teste de notificação',
    body: 'Notificações estão funcionando corretamente!',
    url: '/dashboard',
    tag: 'test',
  })

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    )
  )

  const falhou = results.filter((r) => r.status === 'rejected')
  if (falhou.length === subs.length) throw new Error('Falha ao enviar notificação. Verifique as VAPID keys.')
}

export async function dispararAlertasAgora(): Promise<{ enviadas: number }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs?.length) throw new Error('Nenhuma inscrição push ativa. Ative as notificações primeiro.')

  const prefs = user.user_metadata?.preferencias
  const diasAntecedencia: number = prefs?.dias_antecedencia ?? 3

  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]
  const limiteStr = new Date(hoje.getTime() + diasAntecedencia * 86400000).toISOString().split('T')[0]

  const [{ data: vencendo }, { data: atrasadas }] = await Promise.all([
    supabase
      .from('parcelas')
      .select('id, valor_esperado, data_vencimento, emprestimo_id, emprestimo:emprestimos(id, tomador:tomadores(nome))')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .gte('data_vencimento', hojeStr)
      .lte('data_vencimento', limiteStr)
      .order('data_vencimento'),
    supabase
      .from('parcelas')
      .select('id, valor_esperado, data_vencimento, emprestimo_id, emprestimo:emprestimos(id, tomador:tomadores(nome))')
      .eq('user_id', user.id)
      .eq('status', 'atrasado')
      .lt('data_vencimento', hojeStr)
      .order('data_vencimento'),
  ])

  const payloads: string[] = []

  // Resumo semanal (segunda-feira)
  if (hoje.getDay() === 1 && vencendo?.length) {
    const total = vencendo.reduce((s, p) => s + p.valor_esperado, 0)
    payloads.push(JSON.stringify({
      title: '📊 Resumo da semana',
      body: `Você tem ${vencendo.length} vencimento${vencendo.length > 1 ? 's' : ''} esta semana — Total: ${formatCurrency(total)}`,
      url: '/parcelas?status=pendente',
      tag: 'resumo-semanal',
    }))
  }

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

  const empAlertados = new Set<string>()
  for (const p of atrasadas ?? []) {
    if (empAlertados.has(p.emprestimo_id)) continue
    empAlertados.add(p.emprestimo_id)
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

  if (!payloads.length) return { enviadas: 0 }

  let enviadas = 0
  for (const payload of payloads) {
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      )
    )
    enviadas += results.filter((r) => r.status === 'fulfilled').length
    await new Promise((r) => setTimeout(r, 150))
  }

  return { enviadas }
}
