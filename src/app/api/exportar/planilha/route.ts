import { createClient } from '@/lib/supabase/server'
import { gerarCsv, type TipoPlanilha } from '@/lib/exportar-csv'
import type { Emprestimo, Parcela, Tomador, Transacao } from '@/types'

export const dynamic = 'force-dynamic'

const TIPOS: TipoPlanilha[] = ['contratos', 'parcelas', 'pagamentos']

export async function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get('tipo') as TipoPlanilha
  if (!TIPOS.includes(tipo)) return new Response('Tipo inválido', { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autenticado', { status: 401 })

  const [{ data: emprestimos }, { data: parcelas }, { data: transacoes }] = await Promise.all([
    supabase.from('emprestimos').select('*, tomador:tomadores(*)').eq('user_id', user.id).order('data_vencimento'),
    supabase.from('parcelas').select('*').eq('user_id', user.id).order('data_vencimento'),
    supabase.from('transacoes').select('*').eq('user_id', user.id).order('data'),
  ])

  const hoje = new Date()
  const csv = gerarCsv(tipo, {
    emprestimos: (emprestimos ?? []) as (Emprestimo & { tomador?: Tomador | null })[],
    parcelas: (parcelas ?? []) as Parcela[],
    transacoes: (transacoes ?? []) as Transacao[],
    hoje,
  })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="emprestai-${tipo}-${hoje.toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
