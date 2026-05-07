'use server'

import { createClient } from '@/lib/supabase/server'

export interface Preferencias {
  taxa_padrao: number
  dia_vencimento: number
  dias_antecedencia: number
}

const DEFAULTS: Preferencias = {
  taxa_padrao: 0.015,
  dia_vencimento: 10,
  dias_antecedencia: 3,
}

export async function getPreferencias(): Promise<Preferencias> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const meta = (user?.user_metadata?.preferencias ?? {}) as Partial<Preferencias>
  return { ...DEFAULTS, ...meta }
}

export async function salvarPreferencias(prefs: Preferencias): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({
    data: { preferencias: prefs },
  })
  if (error) throw new Error(error.message)
}
