'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getEmprestimoById, updateEmprestimo, deleteEmprestimo, renegociarEmprestimo } from '@/app/actions/emprestimos'
import {
  getParcelasByEmprestimo,
  registrarPagamento,
  registrarAbatimentoPrincipal,
  estornarPagamento,
  updateParcela,
  deleteParcela,
  regenerarParcelasPendentes,
  getTransacoesByEmprestimo,
  deletarTransacao,
  editarTransacao,
} from '@/app/actions/parcelas'
import { StatusEmprestimoBadge, StatusParcelaBadge } from '@/components/common/StatusBadge'
import { PagamentoForm } from '@/components/pagamentos/PagamentoForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { InputMoeda } from '@/components/ui/input-moeda'
import { InputPorcentagem } from '@/components/ui/input-porcentagem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { toast } from '@/hooks/use-toast'
import {
  ArrowLeft, CreditCard, RotateCcw, Loader2, Pencil, Trash2,
  RefreshCw, PencilLine, X, Repeat2, Share2,
} from 'lucide-react'
import Link from 'next/link'
import type { Emprestimo, Parcela, Transacao } from '@/types'

// ─── Schema edição do contrato ───────────────────────────────────────────────
const editEmpSchema = z.object({
  valor_principal: z.coerce.number().positive(),
  taxa_juros_mensal: z.coerce.number().min(0).max(1),
  data_inicio: z.string().min(1),
  data_vencimento: z.string().min(1),
  modalidade: z.enum(['juros_mensais', 'sem_juros', 'parcelado']),
  descricao: z.string().optional(),
  garantia: z.string().optional(),
  status: z.enum(['ativo', 'quitado', 'inadimplente', 'renegociado']),
})
type EditEmpValues = z.infer<typeof editEmpSchema>

// ─── Schema edição de transação ───────────────────────────────────────────────
const editTransacaoSchema = z.object({
  valor: z.coerce.number().positive('Informe um valor'),
  data: z.string().min(1, 'Informe a data'),
  forma_pagamento: z.enum(['pix', 'dinheiro', 'transferencia', 'cheque']).optional(),
  observacoes: z.string().optional(),
})
type EditTransacaoValues = z.infer<typeof editTransacaoSchema>

// ─── Schema edição de parcela ─────────────────────────────────────────────────
const editParcelaSchema = z.object({
  valor_esperado: z.coerce.number().min(0),
  data_vencimento: z.string().min(1),
  status: z.enum(['pendente', 'pago', 'atrasado', 'isento']),
  observacoes: z.string().optional(),
})
type EditParcelaValues = z.infer<typeof editParcelaSchema>

// ─── Schema renegociação ──────────────────────────────────────────────────────
const renegociarSchema = z.object({
  tipo: z.enum(['prorrogar', 'amortizar']),
  nova_data_vencimento: z.string().min(1, 'Informe a data de vencimento'),
  nova_taxa_juros_mensal: z.coerce.number().min(0).max(1),
  valor_amortizado: z.coerce.number().min(0).optional(),
  data_amortizacao: z.string().optional(),
  forma_pagamento_amortizacao: z.enum(['pix', 'dinheiro', 'transferencia', 'cheque']).optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'amortizar' && (!data.valor_amortizado || data.valor_amortizado <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o valor amortizado', path: ['valor_amortizado'] })
  }
})
type RenegociarValues = z.infer<typeof renegociarSchema>

// ─────────────────────────────────────────────────────────────────────────────

export default function EmprestimoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [emprestimo, setEmprestimo] = useState<Emprestimo | null>(null)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)

  // Modais
  const [pagandoParcela, setPagandoParcela] = useState<Parcela | null>(null)
  const [editandoParcela, setEditandoParcela] = useState<Parcela | null>(null)
  const [editandoTransacao, setEditandoTransacao] = useState<Transacao | null>(null)
  const [editEmpOpen, setEditEmpOpen] = useState(false)
  const [renegociarOpen, setRenegociarOpen] = useState(false)

  // Loading states
  const [pagamentoLoading, setPagamentoLoading] = useState(false)
  const [editEmpLoading, setEditEmpLoading] = useState(false)
  const [editParcelaLoading, setEditParcelaLoading] = useState(false)
  const [editTransacaoLoading, setEditTransacaoLoading] = useState(false)
  const [deletarTrxLoading, setDeletarTrxLoading] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [regenerarLoading, setRegenerarLoading] = useState(false)
  const [renegociarLoading, setRenegociarLoading] = useState(false)

  // ── Forms ──────────────────────────────────────────────────────────────────
  const empForm = useForm<EditEmpValues>({ resolver: zodResolver(editEmpSchema) })
  const parcelaForm = useForm<EditParcelaValues>({ resolver: zodResolver(editParcelaSchema) })
  const transacaoForm = useForm<EditTransacaoValues>({ resolver: zodResolver(editTransacaoSchema) })
  const renegForm = useForm<RenegociarValues>({
    resolver: zodResolver(renegociarSchema),
    defaultValues: { tipo: 'prorrogar', nova_taxa_juros_mensal: 0 },
  })

  // ── Carregar dados ─────────────────────────────────────────────────────────
  async function carregar() {
    setLoading(true)
    const [emp, parc, trxs] = await Promise.all([
      getEmprestimoById(id),
      getParcelasByEmprestimo(id),
      getTransacoesByEmprestimo(id),
    ])
    setEmprestimo(emp)
    setParcelas(parc)
    setTransacoes(trxs)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [id])

  // Preenche o form de edição quando o modal abre
  useEffect(() => {
    if (editEmpOpen && emprestimo) {
      empForm.reset({
        valor_principal: emprestimo.valor_principal,
        taxa_juros_mensal: emprestimo.taxa_juros_mensal,
        data_inicio: emprestimo.data_inicio,
        data_vencimento: emprestimo.data_vencimento,
        modalidade: emprestimo.modalidade,
        descricao: emprestimo.descricao ?? '',
        garantia: emprestimo.garantia ?? '',
        status: emprestimo.status,
      })
    }
  }, [editEmpOpen, emprestimo])

  useEffect(() => {
    if (editandoTransacao) {
      transacaoForm.reset({
        valor: editandoTransacao.valor,
        data: editandoTransacao.data,
        forma_pagamento: (editandoTransacao.forma_pagamento as EditTransacaoValues['forma_pagamento']) ?? undefined,
        observacoes: editandoTransacao.observacoes ?? '',
      })
    }
  }, [editandoTransacao])

  // Preenche o form de parcela quando o modal abre
  useEffect(() => {
    if (editandoParcela) {
      parcelaForm.reset({
        valor_esperado: editandoParcela.valor_esperado,
        data_vencimento: editandoParcela.data_vencimento,
        status: editandoParcela.status,
        observacoes: editandoParcela.observacoes ?? '',
      })
    }
  }, [editandoParcela])

  // Preenche o form de renegociação quando o modal abre
  useEffect(() => {
    if (renegociarOpen && emprestimo) {
      renegForm.reset({
        tipo: 'prorrogar',
        nova_data_vencimento: '',
        nova_taxa_juros_mensal: emprestimo.taxa_juros_mensal,
        valor_amortizado: 0,
        data_amortizacao: new Date().toISOString().split('T')[0],
        forma_pagamento_amortizacao: 'pix',
      })
    }
  }, [renegociarOpen, emprestimo])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handlePagamento(values: any) {
    if (!pagandoParcela) return
    setPagamentoLoading(true)
    try {
      if (pagandoParcela.tipo === 'principal') {
        await registrarAbatimentoPrincipal(pagandoParcela.id, id, values)
      } else {
        await registrarPagamento(pagandoParcela.id, id, values)
      }
      toast({ title: 'Pagamento registrado!' })
      setPagandoParcela(null)
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setPagamentoLoading(false)
    }
  }

  async function handleDeletarTransacao(transacaoId: string) {
    setDeletarTrxLoading(transacaoId)
    try {
      await deletarTransacao(transacaoId, id)
      toast({ title: 'Transação excluída' })
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setDeletarTrxLoading(null)
    }
  }

  async function handleEditarTransacao(values: EditTransacaoValues) {
    if (!editandoTransacao) return
    setEditTransacaoLoading(true)
    try {
      await editarTransacao(editandoTransacao.id, id, values)
      toast({ title: 'Transação atualizada' })
      setEditandoTransacao(null)
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setEditTransacaoLoading(false)
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

  async function handleEditEmp(values: EditEmpValues) {
    setEditEmpLoading(true)
    try {
      await updateEmprestimo(id, values)
      toast({ title: 'Contrato atualizado!' })
      setEditEmpOpen(false)
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setEditEmpLoading(false)
    }
  }

  async function handleEditParcela(values: EditParcelaValues) {
    if (!editandoParcela) return
    setEditParcelaLoading(true)
    try {
      await updateParcela(editandoParcela.id, id, values)
      toast({ title: 'Parcela atualizada!' })
      setEditandoParcela(null)
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setEditParcelaLoading(false)
    }
  }

  async function handleDeleteParcela(parcelaId: string) {
    try {
      await deleteParcela(parcelaId, id)
      toast({ title: 'Parcela removida' })
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  async function handleDeleteEmprestimo() {
    setDeleteLoading(true)
    try {
      await deleteEmprestimo(id)
      toast({ title: 'Empréstimo excluído' })
      router.push('/emprestimos')
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
      setDeleteLoading(false)
    }
  }

  async function handleRenegociar(values: RenegociarValues) {
    setRenegociarLoading(true)
    try {
      await renegociarEmprestimo(id, values)
      toast({ title: 'Renegociação concluída!', description: 'Novas parcelas geradas com sucesso.' })
      setRenegociarOpen(false)
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro na renegociação', description: err.message, variant: 'destructive' })
    } finally {
      setRenegociarLoading(false)
    }
  }

  async function handleRegenerarParcelas() {
    setRegenerarLoading(true)
    try {
      await regenerarParcelasPendentes(id)
      toast({ title: 'Parcelas regeneradas!', description: 'Parcelas pendentes foram recriadas com os dados atuais do contrato.' })
      await carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setRegenerarLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!emprestimo) return <p className="text-center text-muted-foreground py-10">Empréstimo não encontrado.</p>

  const totalRecebido = parcelas.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const parcelasPagas = parcelas.filter(p => p.status === 'pago').length
  const parcelasAtrasadas = parcelas.filter(p => p.status === 'atrasado').length
  const parcelasPendentes = parcelas.filter(p => ['pendente', 'atrasado'].includes(p.status))
  const principalRecebido = parcelas
    .filter(p => p.tipo === 'principal' && p.valor_pago != null)
    .reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const progressoPrincipal = emprestimo.valor_principal > 0
    ? Math.min(100, (principalRecebido / emprestimo.valor_principal) * 100)
    : 0
  const modalidadeLabel: Record<string, string> = {
    juros_mensais: 'Juros mensais',
    sem_juros: 'Sem juros',
    parcelado: 'Parcelado',
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 mt-0.5">
          <Link href="/emprestimos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold break-words">{(emprestimo as any).tomador?.nome}</h1>
                <StatusEmprestimoBadge status={emprestimo.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(emprestimo.data_inicio)} → {formatDate(emprestimo.data_vencimento)}
                <span className="mx-1.5">·</span>
                <span>{modalidadeLabel[emprestimo.modalidade] ?? emprestimo.modalidade}</span>
              </p>
            </div>

            {/* Ações do contrato */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {emprestimo.token_extrato && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${window.location.origin}/extrato/${emprestimo.token_extrato}`
                    navigator.clipboard.writeText(url).then(() =>
                      toast({ title: 'Link copiado!', description: 'Envie para o tomador ver o extrato.', variant: 'success' as any })
                    )
                  }}
                >
                  <Share2 className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Extrato</span>
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={() => setEditEmpOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Button>

              <Button variant="outline" size="sm" onClick={() => setRenegociarOpen(true)}>
                <Repeat2 className="h-3.5 w-3.5 mr-1.5" />
                Renegociar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir este empréstimo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as parcelas e transações vinculadas serão removidas. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={handleDeleteEmprestimo}
                      disabled={deleteLoading}
                    >
                      {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Excluir permanentemente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {/* ── Resumo ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Principal', value: formatCurrency(emprestimo.valor_principal) },
          { label: 'Taxa', value: `${(emprestimo.taxa_juros_mensal * 100).toFixed(2)}% a.m.` },
          { label: 'Total recebido', value: formatCurrency(totalRecebido) },
          {
            label: 'Parcelas',
            value: `${parcelasPagas}/${parcelas.length} pagas${parcelasAtrasadas > 0 ? ` · ${parcelasAtrasadas} atr.` : ''}`,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Progresso de recuperação ───────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Principal recuperado</span>
            <span className="tabular-nums">
              <span className="font-medium">{formatCurrency(principalRecebido)}</span>
              <span className="text-muted-foreground"> / {formatCurrency(emprestimo.valor_principal)} · {progressoPrincipal.toFixed(0)}%</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-primary/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressoPrincipal}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {(emprestimo.descricao || emprestimo.garantia) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {emprestimo.descricao && (
            <p className="flex-1 text-sm text-muted-foreground bg-secondary/30 px-3 py-2 rounded-md">
              {emprestimo.descricao}
            </p>
          )}
          {emprestimo.garantia && (
            <p className="text-sm text-muted-foreground bg-secondary/30 px-3 py-2 rounded-md">
              Garantia: {emprestimo.garantia}
            </p>
          )}
        </div>
      )}

      {/* ── Parcelas + Recebimentos ────────────────────────────────────────── */}
      <Tabs defaultValue="parcelas">
        <TabsList>
          <TabsTrigger value="parcelas">Parcelas ({parcelas.length})</TabsTrigger>
          <TabsTrigger value="transacoes">Recebimentos ({transacoes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="parcelas" className="mt-2">
          <Card>
            {parcelasPendentes.length > 0 && (
              <div className="flex justify-end px-4 pt-3 pb-0">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Regenerar pendentes
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerar parcelas pendentes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        As parcelas pendentes/atrasadas sem pagamento serão removidas e recriadas com os dados atuais do contrato (taxa, datas, modalidade). Parcelas pagas ou com pagamento parcial são mantidas — o principal já iniciado apenas tem o vencimento remanejado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRegenerarParcelas} disabled={regenerarLoading}>
                        {regenerarLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Regenerar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          <CardContent className="p-0">
          <div className="divide-y divide-border">
            {parcelas.map((p) => (
              <div key={p.id} className="flex items-center px-3 sm:px-6 py-3 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      #{p.numero} — {p.tipo === 'juros' ? 'Juros' : 'Principal'}
                    </span>
                    <StatusParcelaBadge status={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Venc. {formatDate(p.data_vencimento)}
                    {p.data_pagamento && ` · Pago em ${formatDate(p.data_pagamento)}`}
                  </p>
                  {p.tipo === 'principal' && p.valor_pago != null && p.valor_pago > 0 && p.status !== 'pago' && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(p.valor_pago)} / {formatCurrency(p.valor_esperado)} recebido
                      </p>
                      <div className="h-1 w-full rounded-full bg-primary/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (p.valor_pago / p.valor_esperado) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right mr-1">
                    <p className="text-sm font-medium tabular-nums">
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

                  {/* Editar parcela */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Editar parcela"
                    onClick={() => setEditandoParcela(p)}
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </Button>

                  {/* Excluir parcela */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" title="Remover parcela">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover parcela #{p.numero}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta parcela será excluída permanentemente. Use apenas para ajustes manuais.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive" onClick={() => handleDeleteParcela(p.id)}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Separator orientation="vertical" className="h-6 mx-0.5 self-center shrink-0" />

                  {p.status === 'pago' ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0">
                          <RotateCcw className="h-3 w-3 sm:mr-1" />
                          <span className="hidden sm:inline text-xs">Estornar</span>
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
                      className="h-8 px-2 shrink-0"
                      onClick={() => setPagandoParcela(p)}
                    >
                      <CreditCard className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline text-xs">Pagar</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transacoes" className="mt-2">
          <Card>
            <CardContent className="p-0">
              {transacoes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum recebimento registrado</p>
              ) : (
                <div className="divide-y divide-border">
                  {transacoes.map((t) => (
                    <div key={t.id} className="flex items-center px-3 sm:px-6 py-3 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {t.tipo === 'principal_recebido' ? 'Principal recebido'
                              : t.tipo === 'juros_recebido' ? 'Juros recebidos'
                              : 'Estorno'}
                          </span>
                          {t.forma_pagamento && (
                            <span className="text-xs text-muted-foreground capitalize">{t.forma_pagamento}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.data)}
                          {t.observacoes && ` · ${t.observacoes}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="text-sm font-medium tabular-nums mr-1">{formatCurrency(t.valor)}</p>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditandoTransacao(t)}>
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O efeito desta transação na parcela correspondente será desfeito.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleDeletarTransacao(t.id)}
                                disabled={deletarTrxLoading === t.id}
                              >
                                {deletarTrxLoading === t.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modal: registrar pagamento ─────────────────────────────────────── */}
      <Dialog open={!!pagandoParcela} onOpenChange={(open) => !open && setPagandoParcela(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pagandoParcela?.tipo === 'principal' ? 'Abater principal' : 'Registrar pagamento'}
            </DialogTitle>
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

      {/* ── Modal: editar contrato ─────────────────────────────────────────── */}
      <Dialog open={editEmpOpen} onOpenChange={setEditEmpOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar contrato</DialogTitle>
          </DialogHeader>
          <form onSubmit={empForm.handleSubmit(handleEditEmp)} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor principal</Label>
                <Controller
                  name="valor_principal"
                  control={empForm.control}
                  render={({ field }) => (
                    <InputMoeda value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa mensal</Label>
                <Controller
                  name="taxa_juros_mensal"
                  control={empForm.control}
                  render={({ field }) => (
                    <InputPorcentagem value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de início</Label>
                <DateInput {...empForm.register('data_inicio')} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de vencimento</Label>
                <DateInput {...empForm.register('data_vencimento')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Modalidade</Label>
                <Controller
                  name="modalidade"
                  control={empForm.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="juros_mensais">Juros mensais</SelectItem>
                        <SelectItem value="sem_juros">Sem juros (lump sum)</SelectItem>
                        <SelectItem value="parcelado">Parcelado (parcelas fixas)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={empForm.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inadimplente">Inadimplente</SelectItem>
                        <SelectItem value="quitado">Quitado</SelectItem>
                        <SelectItem value="renegociado">Renegociado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Finalidade do empréstimo..." {...empForm.register('descricao')} />
            </div>
            <div className="space-y-1.5">
              <Label>Garantia</Label>
              <Input placeholder="Cheque pré-datado, nota promissória..." {...empForm.register('garantia')} />
            </div>

            <div className="rounded-md bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
              Após salvar, use <strong>"Regenerar pendentes"</strong> na lista de parcelas para que elas reflitam os novos dados (taxa, datas).
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditEmpOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={editEmpLoading}>
                {editEmpLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: editar transação ───────────────────────────────────────── */}
      <Dialog open={!!editandoTransacao} onOpenChange={(open) => !open && setEditandoTransacao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar transação</DialogTitle>
          </DialogHeader>
          <form onSubmit={transacaoForm.handleSubmit(handleEditarTransacao)} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Controller
                  name="valor"
                  control={transacaoForm.control}
                  render={({ field }) => (
                    <InputMoeda value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                  )}
                />
                {transacaoForm.formState.errors.valor && (
                  <p className="text-xs text-destructive">{transacaoForm.formState.errors.valor.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <DateInput {...transacaoForm.register('data')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Controller
                name="forma_pagamento"
                control={transacaoForm.control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input placeholder="Opcional..." {...transacaoForm.register('observacoes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditandoTransacao(null)}>Cancelar</Button>
              <Button type="submit" disabled={editTransacaoLoading}>
                {editTransacaoLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: editar parcela ──────────────────────────────────────────── */}
      <Dialog open={!!editandoParcela} onOpenChange={(open) => !open && setEditandoParcela(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar parcela #{editandoParcela?.numero} — {editandoParcela?.tipo === 'juros' ? 'Juros' : 'Principal'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={parcelaForm.handleSubmit(handleEditParcela)} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor esperado (R$)</Label>
                <Controller
                  name="valor_esperado"
                  control={parcelaForm.control}
                  render={({ field }) => (
                    <InputMoeda value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de vencimento</Label>
                <DateInput {...parcelaForm.register('data_vencimento')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                name="status"
                control={parcelaForm.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                      <SelectItem value="isento">Isento</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input placeholder="Opcional..." {...parcelaForm.register('observacoes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditandoParcela(null)}>Cancelar</Button>
              <Button type="submit" disabled={editParcelaLoading}>
                {editParcelaLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: renegociar ─────────────────────────────────────────────── */}
      <Dialog open={renegociarOpen} onOpenChange={setRenegociarOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Renegociar empréstimo</DialogTitle>
          </DialogHeader>
          {emprestimo && (
            <RenegociarForm
              emprestimo={emprestimo}
              form={renegForm}
              onSubmit={handleRenegociar}
              isLoading={renegociarLoading}
              onCancel={() => setRenegociarOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Subcomponente do formulário de renegociação ──────────────────────────────
function RenegociarForm({
  emprestimo,
  form,
  onSubmit,
  isLoading,
  onCancel,
}: {
  emprestimo: Emprestimo
  form: ReturnType<typeof useForm<RenegociarValues>>
  onSubmit: (values: RenegociarValues) => Promise<void>
  isLoading: boolean
  onCancel: () => void
}) {
  const { control, register, handleSubmit, watch, formState: { errors } } = form
  const tipo = watch('tipo')
  const valorAmortizado = watch('valor_amortizado') ?? 0
  const novoPrincipal = tipo === 'amortizar' ? emprestimo.valor_principal - valorAmortizado : emprestimo.valor_principal
  const principalValido = novoPrincipal > 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
      {/* Tipo */}
      <div className="space-y-1.5">
        <Label>Tipo de renegociação</Label>
        <Controller
          name="tipo"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prorrogar">Prorrogar — estender prazo</SelectItem>
                <SelectItem value="amortizar">Amortizar — abater parte do principal</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Amortização parcial */}
      {tipo === 'amortizar' && (
        <div className="rounded-md border border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pagamento parcial do principal</p>

          <div className="space-y-1.5">
            <Label>Valor amortizado *</Label>
            <Controller
              name="valor_amortizado"
              control={control}
              render={({ field }) => (
                <InputMoeda value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
            {errors.valor_amortizado && <p className="text-xs text-destructive">{errors.valor_amortizado.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <DateInput {...register('data_amortizacao')} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Controller
                name="forma_pagamento_amortizacao"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Preview novo principal */}
          <div className={`rounded-md px-3 py-2 text-sm flex justify-between ${principalValido ? 'bg-secondary/50' : 'bg-destructive/10 text-destructive'}`}>
            <span>Novo principal</span>
            <span className="font-semibold">
              {principalValido
                ? formatCurrency(novoPrincipal)
                : 'Valor maior que o principal'}
            </span>
          </div>
        </div>
      )}

      {/* Nova taxa e vencimento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nova taxa mensal</Label>
          <Controller
            name="nova_taxa_juros_mensal"
            control={control}
            render={({ field }) => (
              <InputPorcentagem value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Novo vencimento *</Label>
          <DateInput {...register('nova_data_vencimento')} />
          {errors.nova_data_vencimento && <p className="text-xs text-destructive">{errors.nova_data_vencimento.message}</p>}
        </div>
      </div>

      <div className="rounded-md bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
        As parcelas pendentes/atrasadas serão removidas e novas parcelas serão geradas a partir de hoje até o novo vencimento.
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isLoading || !principalValido}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Confirmar renegociação
        </Button>
      </DialogFooter>
    </form>
  )
}
