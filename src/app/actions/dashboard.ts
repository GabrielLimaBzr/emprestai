'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth } from '@/utils/date'
import type { DashboardStats } from '@/types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createClient()
  const hoje = new Date()

  // Contratos em curso. Inadimplente e renegociado também têm capital na rua —
  // filtrar só por 'ativo' escondia justamente o dinheiro mais em risco.
  const { data: emCurso } = await supabase
    .from('emprestimos')
    .select('valor_principal, taxa_juros_mensal')
    .neq('status', 'quitado')

  // Capital ainda na rua sai das parcelas, não de emprestimos.valor_principal:
  // uma amortização já reduz valor_principal E registra a transação, então
  // descontar as transações do valor do contrato contaria a devolução 2x.
  // O cronograma é a fonte consistente — sincronizarCronograma o mantém alinhado.
  const { data: parcelasPrincipal } = await supabase
    .from('parcelas')
    .select('valor_esperado, valor_pago')
    .eq('tipo', 'principal')

  const capitalEmAberto = (parcelasPrincipal ?? []).reduce(
    (s, p) => s + Math.max(0, p.valor_esperado - (p.valor_pago ?? 0)),
    0
  )

  // Principal já devolvido: regime de caixa, incluindo amortizações avulsas
  // (que não têm parcela vinculada). Estornos de principal são descontados.
  const { data: trxPrincipal } = await supabase
    .from('transacoes')
    .select('valor, tipo, parcela:parcelas(tipo)')
    .in('tipo', ['principal_recebido', 'estorno'])

  const principalDevolvido = (trxPrincipal ?? []).reduce((s, t: any) => {
    if (t.tipo === 'principal_recebido') return s + t.valor
    return t.parcela?.tipo === 'principal' ? s - t.valor : s
  }, 0)

  // Rentabilidade média ponderada pelo principal contratado
  const totalCapital = (emCurso ?? []).reduce((s, e) => s + e.valor_principal, 0) || 1
  const rentabilidadeMedia =
    (emCurso?.reduce((s, e) => s + e.taxa_juros_mensal * e.valor_principal, 0) ?? 0) / totalCapital

  // Juros recebidos no mês atual, líquidos de estorno
  const { data: transacoesMes } = await supabase
    .from('transacoes')
    .select('valor, tipo, parcela:parcelas(tipo)')
    .in('tipo', ['juros_recebido', 'estorno'])
    .gte('data', startOfMonth())
    .lte('data', endOfMonth())

  const jurosRecebidosMes = (transacoesMes ?? []).reduce((s, t: any) => {
    if (t.tipo === 'juros_recebido') return s + t.valor
    return t.parcela?.tipo === 'juros' ? s - t.valor : s
  }, 0)

  // Juros a receber nos próximos 30 dias
  const em30Dias = new Date()
  em30Dias.setDate(em30Dias.getDate() + 30)
  const { data: parcelasFuturas } = await supabase
    .from('parcelas')
    .select('valor_esperado')
    .eq('tipo', 'juros')
    .eq('status', 'pendente')
    .gte('data_vencimento', hoje.toISOString().split('T')[0])
    .lte('data_vencimento', em30Dias.toISOString().split('T')[0])

  const jurosAReceberProximos30 = parcelasFuturas?.reduce((s, p) => s + p.valor_esperado, 0) ?? 0

  // Contratos inadimplentes
  const { count: contratosInadimplentes } = await supabase
    .from('emprestimos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'inadimplente')

  return {
    capitalEmAberto,
    principalDevolvido,
    jurosRecebidosMes,
    jurosAReceberProximos30,
    contratosInadimplentes: contratosInadimplentes ?? 0,
    rentabilidadeMedia,
  }
}

export async function getProximosVencimentos(diasAntecedencia = 7) {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const limite = new Date()
  limite.setDate(limite.getDate() + diasAntecedencia)

  const { data } = await supabase
    .from('parcelas')
    .select('*, emprestimo:emprestimos(id, valor_principal, tomador:tomadores(nome))')
    .in('status', ['pendente', 'atrasado'])
    .gte('data_vencimento', hoje)
    .lte('data_vencimento', limite.toISOString().split('T')[0])
    .order('data_vencimento')
    .limit(10)

  return data ?? []
}

export async function getAlertasInadimplencia() {
  const supabase = createClient()
  const limite = new Date()
  limite.setDate(limite.getDate() - 1)

  const { data } = await supabase
    .from('parcelas')
    .select('*, emprestimo:emprestimos(id, valor_principal, tomador:tomadores(nome))')
    .eq('status', 'atrasado')
    .lt('data_vencimento', limite.toISOString().split('T')[0])
    .order('data_vencimento')
    .limit(10)

  return data ?? []
}

export async function getFluxoMensal(meses = 12) {
  const supabase = createClient()

  // Baldes montados por aritmética de ano/mês. Repetir setMonth() sobre a data
  // de hoje estoura em meses curtos — dia 31 menos um mês cai no mês seguinte.
  const agora = new Date()
  const baldes = new Map<string, { mes: string; recebido: number; esperado: number }>()

  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    baldes.set(chave, {
      mes: d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
      recebido: 0,
      esperado: 0,
    })
  }

  const desde = `${Array.from(baldes.keys())[0]}-01`
  const ate = endOfMonth()

  // Duas consultas cobrindo a janela inteira. Antes era um par por mês, com
  // await dentro do laço — 12 idas ao banco em série só para desenhar 6 barras.
  const [{ data: transacoes }, { data: parcelas }] = await Promise.all([
    supabase
      .from('transacoes')
      .select('valor, tipo, data, parcela:parcelas(tipo)')
      .in('tipo', ['juros_recebido', 'estorno'])
      .gte('data', desde)
      .lte('data', ate),
    supabase
      .from('parcelas')
      .select('valor_esperado, data_vencimento')
      .eq('tipo', 'juros')
      .gte('data_vencimento', desde)
      .lte('data_vencimento', ate),
  ])

  for (const t of (transacoes ?? []) as any[]) {
    const balde = baldes.get(t.data.slice(0, 7))
    if (!balde) continue
    if (t.tipo === 'juros_recebido') balde.recebido += t.valor
    else if (t.parcela?.tipo === 'juros') balde.recebido -= t.valor
  }

  for (const p of parcelas ?? []) {
    const balde = baldes.get(p.data_vencimento.slice(0, 7))
    if (balde) balde.esperado += p.valor_esperado
  }

  return Array.from(baldes.values())
}
