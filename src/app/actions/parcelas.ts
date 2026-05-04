'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Parcela } from '@/types'

export async function getParcelasByEmprestimo(emprestimoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .order('numero')

  if (error) throw error
  return data as Parcela[]
}

export async function getAllParcelas(filtros?: { status?: string; proximosDias?: number }) {
  const supabase = createClient()
  let query = supabase
    .from('parcelas')
    .select('*, emprestimo:emprestimos(*, tomador:tomadores(nome))')
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_esperado, tipo')
    .eq('id', parcelaId)
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

  // Se quitou o principal → muda status do empréstimo
  if (parcela.tipo === 'principal' && novoPagamento === 'pago') {
    await supabase
      .from('emprestimos')
      .update({ status: 'quitado' })
      .eq('id', emprestimoId)
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function estornarPagamento(parcelaId: string, emprestimoId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_pago, data_pagamento')
    .eq('id', parcelaId)
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

  await supabase.from('parcelas').update({
    status: 'pendente',
    data_pagamento: null,
    valor_pago: null,
  }).eq('id', parcelaId)

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/dashboard')
}

export async function sincronizarStatusParcelas() {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('parcelas')
    .update({ status: 'atrasado' })
    .eq('status', 'pendente')
    .lt('data_vencimento', hoje)

  if (error) throw error
  revalidatePath('/dashboard')
  revalidatePath('/parcelas')
}
