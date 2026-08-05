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
    { data: parcelasDoMes },
  ] = await Promise.all([
    supabase.from('emprestimos').select('*, tomador:tomadores(nome)').eq('status', 'ativo'),
    supabase.from('transacoes').select('*, emprestimo:emprestimos(tomador:tomadores(nome))').gte('data', inicioMes).lte('data', fimMes).neq('tipo', 'estorno'),
    supabase.from('parcelas').select('*').eq('status', 'pendente').eq('tipo', 'juros'),
    supabase.from('parcelas').select('*, emprestimo:emprestimos(id, tomador:tomadores(nome))').eq('status', 'atrasado'),
    supabase
      .from('parcelas')
      .select('*, emprestimo:emprestimos(id, tomador:tomadores(nome))')
      .in('status', ['pendente', 'atrasado'])
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes)
      .order('data_vencimento'),
  ])

  const ativos = emprestimosAtivos as Emprestimo[] ?? []
  const rentabilidade = calcularRentabilidadeMedia(ativos)
  const projecao = calcularProjecaoRecebimentos(parcelasPendentes as Parcela[] ?? [], 6)

  const totalMes = transacoesMes?.reduce((s, t) => s + t.valor, 0) ?? 0
  const totalAtrasado = parcelasAtrasadas?.reduce((s, p) => s + p.valor_esperado, 0) ?? 0

  // O que ainda falta entrar dentro do mês corrente. Em parcela com pagamento
  // parcial, só o saldo restante conta como "a receber".
  const saldoAberto = (p: { valor_esperado: number; valor_pago: number | null }) =>
    Math.max(0, p.valor_esperado - (p.valor_pago ?? 0))

  const aReceberMes = (parcelasDoMes ?? []) as any[]
  const totalAReceberMes = aReceberMes.reduce((s, p) => s + saldoAberto(p), 0)
  const previstoMes = totalMes + totalAReceberMes
  const pctRecebido = previstoMes > 0 ? (totalMes / previstoMes) * 100 : 0

  // Atraso arrastado de meses anteriores não entra no previsto do mês, mas é
  // dinheiro devido — vale sinalizar sem misturar com o cálculo.
  const atrasadoAnterior = (parcelasAtrasadas ?? []).filter(p => p.data_vencimento < inicioMes)
  const totalAtrasadoAnterior = atrasadoAnterior.reduce((s, p) => s + saldoAberto(p), 0)

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
          <h2 className="font-semibold capitalize">
            {hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">Já recebido</p>
                <p className="text-lg sm:text-xl font-bold text-success tabular-nums">
                  {formatCurrency(totalMes)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">A receber</p>
                <p className="text-lg sm:text-xl font-bold text-warning tabular-nums">
                  {formatCurrency(totalAReceberMes)}
                </p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground">Previsto no mês</p>
                <p className="text-lg sm:text-xl font-bold text-primary tabular-nums">
                  {formatCurrency(previstoMes)}
                </p>
              </CardContent>
            </Card>
          </div>

          {previstoMes > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progresso do mês</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {pctRecebido.toFixed(0)}% recebido
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${Math.min(100, pctRecebido)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {totalAtrasadoAnterior > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Fora do mês: {atrasadoAnterior.length} parcela{atrasadoAnterior.length !== 1 ? 's' : ''} em atraso de meses anteriores
              </p>
              <p className="text-sm font-bold text-danger tabular-nums">
                {formatCurrency(totalAtrasadoAnterior)}
              </p>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Recebimentos ({transacoesMes?.length ?? 0})</CardTitle>
                <p className="font-bold text-success tabular-nums">{formatCurrency(totalMes)}</p>
              </div>
            </CardHeader>
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
                      <p className="font-medium text-success shrink-0 tabular-nums">+{formatCurrency(t.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">A receber ({aReceberMes.length})</CardTitle>
                <p className="font-bold text-warning tabular-nums">{formatCurrency(totalAReceberMes)}</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {aReceberMes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Tudo recebido neste mês!
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {aReceberMes.map(p => {
                    const parcial = (p.valor_pago ?? 0) > 0
                    return (
                      <div key={p.id} className="flex items-center justify-between px-3 sm:px-6 py-3 gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.emprestimo?.tomador?.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.tipo === 'juros' ? 'Juros' : 'Principal'} · Venc. {formatDate(p.data_vencimento)}
                            {p.status === 'atrasado' && <span className="text-danger"> · atrasado</span>}
                            {parcial && ` · ${formatCurrency(p.valor_pago)} já recebido`}
                          </p>
                        </div>
                        <p className={`font-medium shrink-0 tabular-nums ${p.status === 'atrasado' ? 'text-danger' : 'text-warning'}`}>
                          {formatCurrency(saldoAberto(p))}
                        </p>
                      </div>
                    )
                  })}
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
            <p className="text-lg font-bold text-danger">{formatCurrency(totalAtrasado)}</p>
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
                            Venc. {formatDate(p.data_vencimento)} · <span className="text-danger">{diasAtraso} dias de atraso</span>
                          </p>
                        </div>
                        <p className="font-medium text-danger shrink-0 tabular-nums">{formatCurrency(p.valor_esperado)}</p>
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
