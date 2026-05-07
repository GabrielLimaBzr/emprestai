'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Parcela } from '@/types'

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function getParcelasByEmprestimo(emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', user.id)
    .order('numero')

  if (error) throw error
  return data as Parcela[]
}

export async function getAllParcelas(filtros?: { status?: string; proximosDias?: number }) {
  const supabase = createClient()
  const user = await getUser()
  let query = supabase
    .from('parcelas')
    .select('*, emprestimo:emprestimos(*, tomador:tomadores(nome))')
    .eq('user_id', user.id)
    .order('data_vencimento')

  if (filtros?.status) {
    query = query.eq('status', filtros.status)
  }

  if (filtros?.proximosDias) {
    const hoje = new Date().toISOString().split('T')[0]
    const limite = new Date()
    limite.setDate(limite.getDate() + filtros.proximosDias)
    const limiteStr = limite.toISOString().split('T')[0]
    query = query.gte('data_vencimento', hoje).lte('data_vencimento', limiteStr)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function registrarPagamento(
  parcelaId: string,
  emprestimoId: string,
  values: {
    valor_pago: number
    data_pagamento: string
    forma_pagamento: string
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_esperado, tipo')
    .eq('id', parcelaId)
    .eq('user_id', user.id)
    .single()

  if (!parcela) throw new Error('Parcela não encontrada')

  const novoPagamento = values.valor_pago >= parcela.valor_esperado ? 'pago' : 'atrasado'

  const { error: parcErr } = await supabase
    .from('parcelas')
    .update({
      status: novoPagamento,
      data_pagamento: values.data_pagamento,
      valor_pago: values.valor_pago,
      observacoes: values.observacoes,
    })
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (parcErr) throw parcErr

  const tipoTransacao = parcela.tipo === 'principal' ? 'principal_recebido' : 'juros_recebido'

  const { error: trxErr } = await supabase.from('transacoes').insert({
    user_id: user.id,
    emprestimo_id: emprestimoId,
    parcela_id: parcelaId,
    tipo: tipoTransacao,
    valor: values.valor_pago,
    data: values.data_pagamento,
    forma_pagamento: values.forma_pagamento,
    observacoes: values.observacoes,
  })

  if (trxErr) throw trxErr

  if (parcela.tipo === 'principal' && novoPagamento === 'pago') {
    await supabase
      .from('emprestimos')
      .update({ status: 'quitado' })
      .eq('id', emprestimoId)
      .eq('user_id', user.id)
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function registrarAbatimentoPrincipal(
  parcelaId: string,
  emprestimoId: string,
  values: {
    valor_pago: number
    data_pagamento: string
    forma_pagamento: string
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_esperado, tipo')
    .eq('id', parcelaId)
    .eq('user_id', user.id)
    .single()

  if (!parcela) throw new Error('Parcela não encontrada')

  const { data: transacoes } = await supabase
    .from('transacoes')
    .select('valor')
    .eq('parcela_id', parcelaId)
    .eq('user_id', user.id)
    .eq('tipo', 'principal_recebido')

  const totalAnterior = (transacoes ?? []).reduce((acc, t) => acc + (t.valor as number), 0)
  const novoTotal = totalAnterior + values.valor_pago

  const { error: trxErr } = await supabase.from('transacoes').insert({
    user_id: user.id,
    emprestimo_id: emprestimoId,
    parcela_id: parcelaId,
    tipo: 'principal_recebido',
    valor: values.valor_pago,
    data: values.data_pagamento,
    forma_pagamento: values.forma_pagamento,
    observacoes: values.observacoes,
  })

  if (trxErr) throw trxErr

  const quitado = novoTotal >= parcela.valor_esperado
  const updateParcela: Record<string, unknown> = { valor_pago: novoTotal }
  if (quitado) {
    updateParcela.status = 'pago'
    updateParcela.data_pagamento = values.data_pagamento
  }

  const { error: parcErr } = await supabase
    .from('parcelas')
    .update(updateParcela)
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (parcErr) throw parcErr

  if (quitado) {
    await supabase
      .from('emprestimos')
      .update({ status: 'quitado' })
      .eq('id', emprestimoId)
      .eq('user_id', user.id)
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function estornarPagamento(parcelaId: string, emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_pago, data_pagamento')
    .eq('id', parcelaId)
    .eq('user_id', user.id)
    .single()

  if (!parcela) throw new Error('Parcela não encontrada')

  await supabase.from('transacoes').insert({
    user_id: user.id,
    emprestimo_id: emprestimoId,
    parcela_id: parcelaId,
    tipo: 'estorno',
    valor: parcela.valor_pago ?? 0,
    data: new Date().toISOString().split('T')[0],
    observacoes: 'Estorno',
  })

  await supabase
    .from('parcelas')
    .update({ status: 'pendente', data_pagamento: null, valor_pago: null })
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/dashboard')
}

export async function updateParcela(
  parcelaId: string,
  emprestimoId: string,
  values: {
    valor_esperado?: number
    data_vencimento?: string
    status?: Parcela['status']
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('parcelas')
    .update(values)
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function deleteParcela(parcelaId: string, emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('parcelas')
    .delete()
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
}

export async function regenerarParcelasPendentes(emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()

  const { data: emp } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('id', emprestimoId)
    .eq('user_id', user.id)
    .single()

  if (!emp) throw new Error('Empréstimo não encontrado')

  await supabase
    .from('parcelas')
    .delete()
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', user.id)
    .in('status', ['pendente', 'atrasado', 'isento'])

  const { data: pagas } = await supabase
    .from('parcelas')
    .select('numero')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', user.id)
    .eq('status', 'pago')
    .order('numero', { ascending: false })
    .limit(1)

  const proximoNumero = pagas && pagas.length > 0 ? pagas[0].numero + 1 : 1

  const { gerarParcelas } = await import('@/utils/juros')
  const todasParcelas = gerarParcelas(
    emp.valor_principal,
    emp.taxa_juros_mensal,
    emp.data_inicio,
    emp.data_vencimento,
    emp.modalidade
  )

  const novasParcelas = todasParcelas
    .filter(p => p.numero >= proximoNumero)
    .map(p => ({ ...p, emprestimo_id: emprestimoId, user_id: user.id }))

  if (novasParcelas.length > 0) {
    const { error } = await supabase.from('parcelas').insert(novasParcelas)
    if (error) throw error
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function sincronizarStatusParcelas() {
  const supabase = createClient()
  const user = await getUser()
  const hoje = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('parcelas')
    .update({ status: 'atrasado' })
    .eq('user_id', user.id)
    .eq('status', 'pendente')
    .lt('data_vencimento', hoje)

  if (error) throw error
  revalidatePath('/dashboard')
  revalidatePath('/parcelas')
}
