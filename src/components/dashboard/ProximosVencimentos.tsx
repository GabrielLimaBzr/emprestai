import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusParcelaBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/currency'
import { CalendarDays, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ProximosVencimentosProps {
  parcelas: any[]
  diasAntecedencia?: number
}

export function ProximosVencimentos({ parcelas, diasAntecedencia = 7 }: ProximosVencimentosProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Próximos {diasAntecedencia} dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {parcelas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum vencimento próximo</p>
        ) : (
          <div className="space-y-3">
            {parcelas.map((p) => {
              const empId = p.emprestimo?.id
              return (
                <div key={p.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.emprestimo?.tomador?.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.data_vencimento)}</p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-medium">{formatCurrency(p.valor_esperado)}</p>
                    <div className="flex items-center gap-2">
                      <StatusParcelaBadge status={p.status} />
                      {empId && (
                        <Link
                          href={`/emprestimos/${empId}`}
                          className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        >
                          Ver <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
