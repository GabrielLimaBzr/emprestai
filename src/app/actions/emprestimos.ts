'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { gerarParcelas } from '@/utils/juros'
import type { Emprestimo, EmprestimoResumo } from '@/types'

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function getEmprestimos() {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*, tomador:tomadores(*)')
    .eq('user_id', user.id)
    .order('criado_em', { ascending: false })

  if (error) throw error
  return data as Emprestimo[]
}

export async function getEmprestimosResumo() {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('vw_emprestimos_resumo')
    .select('*')
    .eq('user_id', user.id)
    .order('data_vencimento')

  if (error) throw error
  return data as EmprestimoResumo[]
}

export async function getEmprestimoById(id: string) {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('emprestimos')
    .select('*, tomador:tomadores(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw error
  return data as Emprestimo
}

export async function createEmprestimo(values: {
  tomador_id: string
  valor_principal: number
  taxa_juros_mensal: number
  data_inicio: string
  data_vencimento: string
  modalidade: 'juros_mensais' | 'sem_juros' | 'parcelado'
  descricao?: string
  garantia?: string
}) {
  const supabase = createClient()
  const user = await getUser()

  const { data: emprestimo, error: empErr } = await supabase
    .from('emprestimos')
    .insert({ ...values, user_id: user.id })
    .select()
    .single()

  if (empErr) throw empErr

  const parcelas = gerarParcelas(
    values.valor_principal,
    values.taxa_juros_mensal,
    values.data_inicio,
    values.data_vencimento,
    values.modalidade
  )

  const parcelasToInsert = parcelas.map((p) => ({
    ...p,
    emprestimo_id: emprestimo.id,
    user_id: user.id,
  }))

  const { error: parcErr } = await supabase.from('parcelas').insert(parcelasToInsert)
  if (parcErr) throw parcErr

  revalidatePath('/emprestimos')
  revalidatePath('/dashboard')
  return emprestimo as Emprestimo
}

export async function updateEmprestimoStatus(id: string, status: Emprestimo['status']) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('emprestimos')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/emprestimos')
  revalidatePath(`/emprestimos/${id}`)
  revalidatePath('/dashboard')
}

export async function updateEmprestimo(
  id: string,
  values: {
    valor_principal?: number
    taxa_juros_mensal?: number
    data_inicio?: string
    data_vencimento?: string
    modalidade?: 'juros_mensais' | 'sem_juros' | 'parcelado'
    descricao?: string
    garantia?: string
    status?: Emprestimo['status']
  }
) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('emprestimos')
    .update(values)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/emprestimos')
  revalidatePath(`/emprestimos/${id}`)
  revalidatePath('/dashboard')
}

export async function renegociarEmprestimo(
  id: string,
  values: {
    tipo: 'prorrogar' | 'amortizar'
    nova_data_vencimento: string
    nova_taxa_juros_mensal: number
    valor_amortizado?: number
    data_amortizacao?: string
    forma_pagamento_amortizacao?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()

  const { data: emp } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!emp) throw new Error('Empréstimo não encontrado')

  const novoPrincipal =
    values.tipo === 'amortizar' && values.valor_amortizado
      ? emp.valor_principal - values.valor_amortizado
      : emp.valor_principal

  if (novoPrincipal <= 0) throw new Error('Valor amortizado não pode ser maior ou igual ao principal')

  // 1. Registrar amortização no histórico
  if (values.tipo === 'amortizar' && values.valor_amortizado && values.valor_amortizado > 0) {
    const { error } = await supabase.from('transacoes').insert({
      user_id: user.id,
      emprestimo_id: id,
      tipo: 'principal_recebido',
      valor: values.valor_amortizado,
      data: values.data_amortizacao ?? new Date().toISOString().split('T')[0],
      forma_pagamento: values.forma_pagamento_amortizacao ?? null,
      observacoes: `Amortização parcial — principal anterior: R$ ${emp.valor_principal.toFixed(2)}`,
    })
    if (error) throw error
  }

  // 2. Atualizar o contrato
  await supabase.from('emprestimos').update({
    valor_principal: novoPrincipal,
    taxa_juros_mensal: values.nova_taxa_juros_mensal,
    data_vencimento: values.nova_data_vencimento,
    status: 'ativo',
  }).eq('id', id).eq('user_id', user.id)

  // 3. Remover todas as parcelas pendentes/atrasadas (incluindo o principal futuro)
  await supabase.from('parcelas').delete()
    .eq('emprestimo_id', id)
    .eq('user_id', user.id)
    .in('status', ['pendente', 'atrasado', 'isento'])

  // 4. Descobrir próximo número de parcela
  const { data: pagas } = await supabase
    .from('parcelas')
    .select('numero')
    .eq('emprestimo_id', id)
    .eq('user_id', user.id)
    .order('numero', { ascending: false })
    .limit(1)

  const proximoNumero = pagas && pagas.length > 0 ? pagas[0].numero + 1 : 1

  // 5. Gerar novas parcelas a partir de hoje
  const { gerarParcelas } = await import('@/utils/juros')
  const hoje = new Date().toISOString().split('T')[0]
  const novasParcelas = gerarParcelas(
    novoPrincipal,
    values.nova_taxa_juros_mensal,
    hoje,
    values.nova_data_vencimento,
    emp.modalidade
  )

  const parcelasToInsert = novasParcelas.map((p, i) => ({
    ...p,
    numero: proximoNumero + i,
    emprestimo_id: id,
    user_id: user.id,
  }))

  if (parcelasToInsert.length > 0) {
    const { error } = await supabase.from('parcelas').insert(parcelasToInsert)
    if (error) throw error
  }

  revalidatePath(`/emprestimos/${id}`)
  revalidatePath('/emprestimos')
  revalidatePath('/dashboard')
}

export async function deleteEmprestimo(id: string) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('emprestimos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/emprestimos')
  revalidatePath('/dashboard')
}
