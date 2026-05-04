'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Tomador } from '@/types'

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function getTomadores() {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('tomadores')
    .select('*')
    .eq('user_id', user.id)
    .order('nome')

  if (error) throw error
  return data as Tomador[]
}

export async function getTomadorById(id: string) {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('tomadores')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw error
  return data as Tomador
}

export async function createTomador(values: Omit<Tomador, 'id' | 'user_id' | 'criado_em' | 'atualizado_em'>) {
  const supabase = createClient()
  const user = await getUser()

  const { data, error } = await supabase
    .from('tomadores')
    .insert({ ...values, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  revalidatePath('/tomadores')
  return data as Tomador
}

export async function updateTomador(id: string, values: Partial<Tomador>) {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('tomadores')
    .update(values)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/tomadores')
  revalidatePath(`/tomadores/${id}`)
  return data as Tomador
}

export async function deleteTomador(id: string) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('tomadores')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/tomadores')
}
