import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { ValorPrivado } from '@/components/ui/valor-privado'

interface StatCardProps {
  title: string
  value: string
  description?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  className?: string
  iconClassName?: string
}

export function StatCard({ title, value, description, icon: Icon, trend, className, iconClassName }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold break-words"><ValorPrivado>{value}</ValorPrivado></p>
            {description && (
              <p className={cn(
                'text-xs',
                trend === 'up' && 'text-emerald-400',
                trend === 'down' && 'text-red-400',
                trend === 'neutral' && 'text-muted-foreground',
                !trend && 'text-muted-foreground'
              )}>{description}</p>
            )}
          </div>
          <div className={cn('shrink-0 p-2.5 rounded-lg bg-primary/10', iconClassName)}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
