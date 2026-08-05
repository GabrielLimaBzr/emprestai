import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/currency'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface AlertasInadimplenciaProps {
  parcelas: any[]
}

export function AlertasInadimplencia({ parcelas }: AlertasInadimplenciaProps) {
  return (
    <Card className="border-danger/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-danger">
          <AlertTriangle className="h-4 w-4" />
          Alertas de inadimplência ({parcelas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {parcelas.map((p) => {
            const diasAtraso = Math.floor(
              (Date.now() - new Date(p.data_vencimento).getTime()) / (1000 * 60 * 60 * 24)
            )
            return (
              <div key={p.id} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-danger/5 border border-danger/20">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.emprestimo?.tomador?.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Venc. {formatDate(p.data_vencimento)} · {diasAtraso} dias de atraso
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-danger">{formatCurrency(p.valor_esperado)}</p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                    <Link href={`/emprestimos/${p.emprestimo_id}`}>Ver</Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
