'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { StatusEmprestimoBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import type { EmprestimoResumo } from '@/types'

type FiltroId = 'abertos' | 'atrasados' | 'quitados' | 'todos'

const FILTROS: { id: FiltroId; label: string; match: (e: EmprestimoResumo) => boolean }[] = [
  { id: 'abertos',   label: 'Em aberto', match: e => e.status !== 'quitado' },
  { id: 'atrasados', label: 'Em atraso', match: e => e.parcelas_atrasadas > 0 },
  { id: 'quitados',  label: 'Quitados',  match: e => e.status === 'quitado' },
  { id: 'todos',     label: 'Todos',     match: () => true },
]

export function EmprestimosLista({ emprestimos }: { emprestimos: EmprestimoResumo[] }) {
  const router = useRouter()
  const params = useSearchParams()

  const filtroParam = params.get('filtro')
  const filtro: FiltroId =
    FILTROS.some(f => f.id === filtroParam) ? (filtroParam as FiltroId) : 'abertos'

  function setFiltro(id: FiltroId) {
    const p = new URLSearchParams(params.toString())
    if (id === 'abertos') p.delete('filtro')
    else p.set('filtro', id)
    const qs = p.toString()
    router.replace(qs ? `/emprestimos?${qs}` : '/emprestimos')
  }

  const ativo = FILTROS.find(f => f.id === filtro)!

  // Quitados são histórico: mais recentes primeiro. Nos demais o que importa é
  // urgência — atrasados no topo, depois por vencimento mais próximo.
  const lista = emprestimos.filter(ativo.match).sort((a, b) => {
    if (filtro === 'quitados') {
      return a.data_vencimento < b.data_vencimento ? 1 : -1
    }
    if ((a.parcelas_atrasadas > 0) !== (b.parcelas_atrasadas > 0)) {
      return a.parcelas_atrasadas > 0 ? -1 : 1
    }
    return a.data_vencimento < b.data_vencimento ? -1 : 1
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(f => {
          const total = emprestimos.filter(f.match).length
          const selecionado = f.id === filtro
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                selecionado
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50'
              )}
            >
              {f.label}
              <span className={cn('tabular-nums', selecionado ? 'opacity-80' : 'opacity-60')}>
                {total}
              </span>
            </button>
          )
        })}
      </div>

      {lista.length === 0 ? (
        emprestimos.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nenhum empréstimo ainda"
            description="Crie seu primeiro contrato de empréstimo para começar a acompanhar sua carteira."
            action={{ label: 'Criar empréstimo', href: '/emprestimos/novo' }}
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum contrato em &ldquo;{ativo.label}&rdquo;.
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-3">
          {lista.map(e => (
            <Link key={e.id} href={`/emprestimos/${e.id}`} className="block">
              <Card
                className={cn(
                  'transition-colors hover:border-primary/50',
                  e.status === 'quitado' && 'opacity-70'
                )}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold">{e.tomador}</p>
                    <StatusEmprestimoBadge status={e.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="font-medium tabular-nums">{formatCurrency(e.valor_principal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa</p>
                      <p className="font-medium tabular-nums">{(e.taxa_juros_mensal * 100).toFixed(2)}% a.m.</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vencimento</p>
                      <p className="font-medium tabular-nums">{formatDate(e.data_vencimento)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Juros pendentes</p>
                      <p className={cn('font-medium tabular-nums', e.parcelas_atrasadas > 0 && 'text-red-400')}>
                        {formatCurrency(e.valor_juros_pendente)}
                        {e.parcelas_atrasadas > 0 && ` (${e.parcelas_atrasadas} atr.)`}
                      </p>
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
