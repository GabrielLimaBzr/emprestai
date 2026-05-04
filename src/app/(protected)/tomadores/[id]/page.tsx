'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getTomadorById, updateTomador, deleteTomador } from '@/app/actions/tomadores'
import { TomadorForm } from '@/components/tomadores/TomadorForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft, Pencil, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { StatusEmprestimoBadge } from '@/components/common/StatusBadge'
import type { Tomador, Emprestimo } from '@/types'

export default function TomadorDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [tomador, setTomador] = useState<Tomador | null>(null)
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const t = await getTomadorById(id)
      setTomador(t)

      const supabase = createClient()
      const { data } = await supabase
        .from('emprestimos')
        .select('*')
        .eq('tomador_id', id)
        .order('criado_em', { ascending: false })
      setEmprestimos(data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave(values: any) {
    setSaveLoading(true)
    try {
      await updateTomador(id, values)
      toast({ title: 'Tomador atualizado!' })
      setEditMode(false)
      const t = await getTomadorById(id)
      setTomador(t)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteTomador(id)
      toast({ title: 'Tomador removido' })
      router.push('/tomadores')
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!tomador) return <p className="text-center text-muted-foreground py-10">Tomador não encontrado.</p>

  const totalEmprestado = emprestimos.filter(e => e.status === 'ativo').reduce((s, e) => s + e.valor_principal, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tomadores"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tomador.nome}</h1>
          <p className="text-sm text-muted-foreground">{tomador.eh_familiar ? 'Familiar' : 'Externo'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover tomador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Só é possível remover se não houver empréstimos vinculados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive">Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {editMode && (
        <Card>
          <CardHeader><CardTitle className="text-base">Editar dados</CardTitle></CardHeader>
          <CardContent>
            <TomadorForm defaultValues={tomador} onSubmit={handleSave} isLoading={saveLoading} />
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Contratos totais', value: String(emprestimos.length) },
          { label: 'Ativos', value: String(emprestimos.filter(e => e.status === 'ativo').length) },
          { label: 'Capital ativo', value: formatCurrency(totalEmprestado) },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Histórico de empréstimos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de empréstimos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {emprestimos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum empréstimo ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {emprestimos.map(e => (
                <Link key={e.id} href={`/emprestimos/${e.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-secondary/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(e.valor_principal)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.data_inicio)} → {formatDate(e.data_vencimento)}</p>
                  </div>
                  <div className="text-right">
                    <StatusEmprestimoBadge status={e.status} />
                    <p className="text-xs text-muted-foreground mt-1">{(e.taxa_juros_mensal * 100).toFixed(2)}% a.m.</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
