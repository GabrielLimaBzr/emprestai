import Link from 'next/link'
import { getEmprestimosResumo } from '@/app/actions/emprestimos'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusEmprestimoBadge } from '@/components/common/StatusBadge'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { Plus, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default async function EmprestimosPage() {
  const emprestimos = await getEmprestimosResumo()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Empréstimos</h1>
          <p className="text-muted-foreground text-sm">{emprestimos.length} contrato{emprestimos.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/emprestimos/novo">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo empréstimo</span>
          </Link>
        </Button>
      </div>

      {emprestimos.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum empréstimo ainda"
          description="Crie seu primeiro contrato de empréstimo para começar a acompanhar sua carteira."
          action={{ label: 'Criar empréstimo', href: '/emprestimos/novo' }}
        />
      ) : (
        <div className="space-y-3">
          {emprestimos.map((e) => (
            <Link key={e.id} href={`/emprestimos/${e.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{e.tomador}</p>
                        <StatusEmprestimoBadge status={e.status} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Principal</p>
                          <p className="font-medium">{formatCurrency(e.valor_principal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Taxa</p>
                          <p className="font-medium">{(e.taxa_juros_mensal * 100).toFixed(2)}% a.m.</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Vencimento</p>
                          <p className="font-medium">{formatDate(e.data_vencimento)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Juros pendentes</p>
                          <p className={`font-medium ${e.parcelas_atrasadas > 0 ? 'text-red-400' : ''}`}>
                            {formatCurrency(e.valor_juros_pendente)}
                            {e.parcelas_atrasadas > 0 && ` (${e.parcelas_atrasadas} atr.)`}
                          </p>
                        </div>
                      </div>
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
