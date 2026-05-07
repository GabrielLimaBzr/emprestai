'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusParcelaBadge } from '@/components/common/StatusBadge'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/common/EmptyState'

export default function ParcelasPage() {
  const [parcelas, setParcelas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroBusca, setFiltroBusca] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('parcelas')
        .select('*, emprestimo:emprestimos(id, valor_principal, tomador:tomadores(nome))')
        .order('data_vencimento')
      setParcelas(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const parcelasFiltradas = parcelas.filter(p => {
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    const matchBusca = !filtroBusca || p.emprestimo?.tomador?.nome?.toLowerCase().includes(filtroBusca.toLowerCase())
    return matchStatus && matchBusca
  })

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Parcelas</h1>
        <p className="text-muted-foreground text-sm">{parcelas.length} parcela{parcelas.length !== 1 ? 's' : ''} no total</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por tomador..."
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="isento">Isentos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {parcelasFiltradas.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhuma parcela encontrada"
          description="Tente ajustar os filtros."
        />
      ) : (
        <div className="space-y-2">
          {parcelasFiltradas.map(p => (
            <Link key={p.id} href={`/emprestimos/${p.emprestimo_id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{p.emprestimo?.tomador?.nome}</p>
                        <StatusParcelaBadge status={p.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        #{p.numero} — {p.tipo === 'juros' ? 'Juros' : 'Principal'} · Venc. {formatDate(p.data_vencimento)}
                        {p.data_pagamento && ` · Pago ${formatDate(p.data_pagamento)}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{p.status === 'isento' ? 'Isento' : formatCurrency(p.valor_esperado)}</p>
                      {p.valor_pago != null && <p className="text-xs text-emerald-400">Pago: {formatCurrency(p.valor_pago)}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
