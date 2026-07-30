import { createClient } from '@supabase/supabase-js'

// Cliente com service role — usar APENAS em server components / route handlers.
// Nunca expor ao cliente. Necessita SUPABASE_SERVICE_ROLE_KEY no .env.local e Vercel.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
