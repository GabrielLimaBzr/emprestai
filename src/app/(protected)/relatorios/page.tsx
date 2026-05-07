import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/utils/currency'
import { formatDate, formatMonthYear } from '@/utils/date'
import { calcularRentabilidadeMedia, calcularProjecaoRecebimentos } from '@/utils/juros'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Emprestimo, Parcela } from '@/types'

export default async function RelatoriosPage() {
  const supabase = createClient()

  const hoje = new Date()
  const mesAtual = hoje.toISOString().slice(0, 7)
  const inicioMes = `${mesAtual}-01`
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: emprestimosAtivos },
    { data: transacoesMes },
    { data: parcelasPendentes },
    { data: parcelasAtrasadas },
  ] = await Promise.all([
    supabase.from('emprestimos').select('*, tomador:tomadores(nome)').eq('status', 'ativo'),
    supabase.from('transacoes').select('*, emprestimo:emprestimos(tomador:tomadores(nome))').gte('data', inicioMes).lte('data', fimMes).neq('tipo', 'estorno'),
    supabase.from('parcelas').select('*').eq('status', 'pendente').eq('tipo', 'juros'),
    supabase.from('parcelas').select('*, emprestimo:emprestimos(id, tomador:tomadores(nome))').eq('status', 'atrasado'),
  ])

  const ativos = emprestimosAtivos as Emprestimo[] ?? []
  const rentabilidade = calcularRentabilidadeMedia(ativos)
  const projecao = calcularProjecaoRecebimentos(parcelasPendentes as Parcela[] ?? [], 6)

  const totalMes = transacoesMes?.reduce((s, t) => s + t.valor, 0) ?? 0
  const totalAtrasado = parcelasAtrasadas?.reduce((s, p) => s + p.valor_esperado, 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Análise completa da sua carteira</p>
      </div>

      <Tabs defaultValue="extrato">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto gap-1 w-full">
          <TabsTrigger value="extrato" className="text-xs sm:text-sm">Extrato do mês</TabsTrigger>
          <TabsTrigger value="projecao" className="text-xs sm:text-sm">Projeção</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="text-xs sm:text-sm">Inadimplência</TabsTrigger>
          <TabsTrigger value="carteira" className="text-xs sm:text-sm">Carteira</TabsTrigger>
        </TabsList>

        {/* Extrato mensal */}
        <TabsContent value="extrato" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Recebimentos — {hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalMes)}</p>
          </div>
          <Card>
            <CardContent className="p-0">
              {!transacoesMes?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum recebimento neste mês.</p>
              ) : (
                <div className="divide-y divide-border">
                  {transacoesMes.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-3 sm:px-6 py-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.emprestimo?.tomador?.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.tipo === 'juros_recebido' ? 'Juros' : 'Principal'} · {formatDate(t.data)}
                          {t.forma_pagamento && ` · ${t.forma_pagamento}`}
                        </p>
                      </div>
                      <p className="font-medium text-emerald-400 shrink-0 tabular-nums">+{formatCurrency(t.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projeção */}
        <TabsContent value="projecao" className="space-y-4 mt-4">
          <h2 className="font-semibold">Projeção de recebimentos — próximos 6 meses</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {projecao.map(p => (
              <Card key={p.mes}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{p.mes}</p>
                  <p className="text-lg font-bold mt-1">{formatCurrency(p.valor)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total projetado (6 meses)</span>
                <span className="font-bold text-primary">
                  {formatCurrency(projecao.reduce((s, p) => s + p.valor, 0))}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inadimplência */}
        <TabsContent value="inadimplencia" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Parcelas em atraso ({parcelasAtrasadas?.length ?? 0})</h2>
            <p className="text-lg font-bold text-red-400">{formatCurrency(totalAtrasado)}</p>
          </div>
          <Card>
            <CardContent className="p-0">
              {!parcelasAtrasadas?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma inadimplência!</p>
              ) : (
                <div className="divide-y divide-border">
                  {parcelasAtrasadas.map((p: any) => {
                    const diasAtraso = Math.floor((Date.now() - new Date(p.data_vencimento).getTime()) / 86400000)
                    return (
                      <div key={p.id} className="flex items-center justify-between px-3 sm:px-6 py-3 gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.emprestimo?.tomador?.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Venc. {formatDate(p.data_vencimento)} · <span className="text-red-400">{diasAtraso} dias de atraso</span>
                          </p>
                        </div>
                        <p className="font-medium text-red-400 shrink-0 tabular-nums">{formatCurrency(p.valor_esperado)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carteira */}
        <TabsContent value="carteira" className="space-y-4 mt-4">
          <h2 className="font-semibold">Análise da carteira ativa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">Contratos ativos</p>
                <p className="text-2xl font-bold">{ativos.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">Rentabilidade média</p>
                <p className="text-2xl font-bold text-primary">{formatPercent(rentabilidade)}</p>
                <p className="text-xs text-muted-foreground">ao mês (ponderada)</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Contratos ativos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {ativos.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-3 sm:px-6 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{(e as any).tomador?.nome}</p>
                      <p className="text-xs text-muted-foreground">Venc. {formatDate(e.data_vencimento)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium tabular-nums">{formatCurrency(e.valor_principal)}</p>
                      <p className="text-xs text-primary">{(e.taxa_juros_mensal * 100).toFixed(2)}% a.m.</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
