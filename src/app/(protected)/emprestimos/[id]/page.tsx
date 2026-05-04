'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getEmprestimoById } from '@/app/actions/emprestimos'
import { getParcelasByEmprestimo, registrarPagamento, estornarPagamento } from '@/app/actions/parcelas'
import { StatusEmprestimoBadge, StatusParcelaBadge } from '@/components/common/StatusBadge'
import { PagamentoForm } from '@/components/pagamentos/PagamentoForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft, CreditCard, RotateCcw, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { Emprestimo, Parcela } from '@/types'

export default function EmprestimoDetalhePage() {
  const params = useParams()
  const id = params.id as string

  const [emprestimo, setEmprestimo] = useState<Emprestimo | null>(null)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)
  const [pagandoParcela, setPagandoParcela] = useState<Parcela | null>(null)
  const [pagamentoLoading, setPagamentoLoading] = useState(false)

  async function carregar() {
    setLoading(true)
    const [emp, parc] = await Promise.all([
      getEmprestimoById(id),
      getParcelasByEmprestimo(id),
    ])
    setEmprestimo(emp)
    setParcelas(parc)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [id])

  async function handlePagamento(values: any) {
    if (!pagandoParcela) return
    setPagamentoLoading(true)
    try {
      await registrarPagamento(pagandoParcela.id, id, values)
      toast({ title: 'Pagamento registrado!' })
      setPagandoParcela(null)
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setPagamentoLoading(false)
    }
  }

  async function handleEstorno(parcelaId: string) {
    try {
      await estornarPagamento(parcelaId, id)
      toast({ title: 'Pagamento estornado' })
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!emprestimo) return <p className="text-center text-muted-foreground py-10">Empréstimo não encontrado.</p>

  const totalEsperado = parcelas.reduce((s, p) => s + p.valor_esperado, 0)
  const totalRecebido = parcelas.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length
  const parcelasAtrasadas = parcelas.filter(p => p.status === 'atrasado').length

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emprestimos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{(emprestimo as any).tomador?.nome}</h1>
            <StatusEmprestimoBadge status={emprestimo.status} />
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(emprestimo.data_inicio)} → {formatDate(emprestimo.data_vencimento)}</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Principal', value: formatCurrency(emprestimo.valor_principal) },
          { label: 'Taxa', value: `${(emprestimo.taxa_juros_mensal * 100).toFixed(2)}% a.m.` },
          { label: 'Total recebido', value: formatCurrency(totalRecebido) },
          { label: 'Parcelas', value: `${parcelasPagas}/${parcelas.length} pagas${parcelasAtrasadas > 0 ? ` · ${parcelasAtrasadas} atr.` : ''}` },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {emprestimo.descricao && (
        <p className="text-sm text-muted-foreground bg-secondary/30 px-3 py-2 rounded-md">
          {emprestimo.descricao}
        </p>
      )}

      {/* Parcelas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Parcelas ({parcelas.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {parcelas.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      #{p.numero} — {p.tipo === 'juros' ? 'Juros' : 'Principal'}
                    </span>
                    <StatusParcelaBadge status={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Venc. {formatDate(p.data_vencimento)}
                    {p.data_pagamento && ` · Pago em ${formatDate(p.data_pagamento)}`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">
                    {p.valor_pago != null
                      ? formatCurrency(p.valor_pago)
                      : p.status === 'isento'
                      ? 'Isento'
                      : formatCurrency(p.valor_esperado)}
                  </p>
                  {p.valor_pago != null && p.valor_pago !== p.valor_esperado && (
                    <p className="text-xs text-muted-foreground">Esp: {formatCurrency(p.valor_esperado)}</p>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {p.status === 'pago' ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-xs">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Estornar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Estornar pagamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A parcela voltará para "pendente". Esta ação registra um estorno no histórico.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleEstorno(p.id)}>Estornar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : p.status !== 'isento' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPagandoParcela(p)}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Pagar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal de pagamento */}
      <Dialog open={!!pagandoParcela} onOpenChange={(open) => !open && setPagandoParcela(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          {pagandoParcela && (
            <PagamentoForm
              parcela={pagandoParcela}
              onSubmit={handlePagamento}
              isLoading={pagamentoLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
