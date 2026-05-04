'use client'

import { usePrivacy } from '@/contexts/privacy'
import { cn } from '@/lib/utils'

interface ValorPrivadoProps {
  children: React.ReactNode
  className?: string
}

export function ValorPrivado({ children, className }: ValorPrivadoProps) {
  const { isPrivate } = usePrivacy()
  return (
    <span
      className={cn(
        'transition-[filter] duration-200',
        isPrivate && 'blur-sm select-none',
        className
      )}
    >
      {children}
    </span>
  )
}
