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

export async function getFluxoMensal() {
  const supabase = createClient()

  // Últimos 6 meses
  const meses: { mes: string; recebido: number; esperado: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const data = new Date()
    data.setMonth(data.getMonth() - i)
    const inicio = startOfMonth(data)
    const fim = endOfMonth(data)
    const mesLabel = data.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })

    const [{ data: recebido }, { data: esperado }] = await Promise.all([
      supabase
        .from('transacoes')
        .select('valor')
        .eq('tipo', 'juros_recebido')
        .gte('data', inicio)
        .lte('data', fim),
      supabase
        .from('parcelas')
        .select('valor_esperado')
        .eq('tipo', 'juros')
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim),
    ])

    meses.push({
      mes: mesLabel,
      recebido: recebido?.reduce((s, t) => s + t.valor, 0) ?? 0,
      esperado: esperado?.reduce((s, p) => s + p.valor_esperado, 0) ?? 0,
    })
  }

  return meses
}
