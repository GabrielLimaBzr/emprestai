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
  modalidade: 'juros_mensais' | 'sem_juros'
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
    modalidade?: 'juros_mensais' | 'sem_juros'
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
