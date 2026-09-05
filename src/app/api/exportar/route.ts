import { createClient } from '@/lib/supabase/server'
import { gerarMarkdownCarteira } from '@/lib/exportar-markdown'
import type { Emprestimo, Parcela, Tomador, Transacao } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Não autenticado', { status: 401 })

  // RLS já restringe ao usuário, mas o filtro explícito mantém a intenção clara.
  const [{ data: emprestimos }, { data: parcelas }, { data: transacoes }] = await Promise.all([
    supabase
      .from('emprestimos')
      .select('*, tomador:tomadores(*)')
      .eq('user_id', user.id)
      .order('data_vencimento'),
    supabase.from('parcelas').select('*').eq('user_id', user.id).order('data_vencimento'),
    supabase.from('transacoes').select('*').eq('user_id', user.id).order('data'),
  ])

  const geradoEm = new Date()
  const markdown = gerarMarkdownCarteira({
    geradoEm,
    emprestimos: (emprestimos ?? []) as (Emprestimo & { tomador?: Tomador | null })[],
    parcelas: (parcelas ?? []) as Parcela[],
    transacoes: (transacoes ?? []) as Transacao[],
  })

  const arquivo = `carteira-emprestai-${geradoEm.toISOString().slice(0, 10)}.md`

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${arquivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
