import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusParcelaBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/currency'
import { CalendarDays } from 'lucide-react'

interface ProximosVencimentosProps {
  parcelas: any[]
}

export function ProximosVencimentos({ parcelas }: ProximosVencimentosProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Próximos 7 dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {parcelas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum vencimento próximo</p>
        ) : (
          <div className="space-y-3">
            {parcelas.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.emprestimo?.tomador?.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.data_vencimento)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{formatCurrency(p.valor_esperado)}</p>
                  <StatusParcelaBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
