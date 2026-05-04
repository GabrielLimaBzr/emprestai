import { Badge } from '@/components/ui/badge'
import type { StatusEmprestimo, StatusParcela } from '@/types'

const statusEmprestimoConfig: Record<StatusEmprestimo, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
  ativo: { label: 'Ativo', variant: 'warning' },
  quitado: { label: 'Quitado', variant: 'success' },
  inadimplente: { label: 'Inadimplente', variant: 'danger' },
  renegociado: { label: 'Renegociado', variant: 'muted' },
}

const statusParcelaConfig: Record<StatusParcela, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
  pendente: { label: 'Pendente', variant: 'warning' },
  pago: { label: 'Pago', variant: 'success' },
  atrasado: { label: 'Atrasado', variant: 'danger' },
  isento: { label: 'Isento', variant: 'muted' },
}

export function StatusEmprestimoBadge({ status }: { status: StatusEmprestimo }) {
  const config = statusEmprestimoConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export function StatusParcelaBadge({ status }: { status: StatusParcela }) {
  const config = statusParcelaConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
