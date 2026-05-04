'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface InputMoedaProps {
  value?: number
  onChange?: (value: number) => void
  onBlur?: () => void
  name?: string
  disabled?: boolean
  className?: string
}

// Mascaramento em centavos: o usuário digita dígitos da direita para a esquerda.
// Ex: 5 → "0,05" | 50 → "0,50" | 500 → "5,00" | 5000 → "50,00" | 500000 → "5.000,00"
export const InputMoeda = React.forwardRef<HTMLInputElement, InputMoedaProps>(
  ({ value, onChange, onBlur, name, disabled, className }, ref) => {
    const toCents = (v?: number) => Math.round((v ?? 0) * 100)
    const toDisplay = (c: number) =>
      (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const [cents, setCents] = React.useState(() => toCents(value))

    React.useEffect(() => {
      setCents(toCents(value))
    }, [value])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, '')
      const newCents = digits ? Math.min(parseInt(digits, 10), 9999999999) : 0
      setCents(newCents)
      onChange?.(newCents / 100)
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
          R$
        </span>
        <input
          ref={ref}
          name={name}
          type="text"
          inputMode="numeric"
          value={toDisplay(cents)}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        />
      </div>
    )
  }
)
InputMoeda.displayName = 'InputMoeda'
