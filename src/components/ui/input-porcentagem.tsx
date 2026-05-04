'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface InputPorcentagemProps {
  value?: number        // decimal: 0.05 = 5%
  onChange?: (value: number) => void
  onBlur?: () => void
  name?: string
  disabled?: boolean
  className?: string
  placeholder?: string
  max?: number          // percentual máximo, default 100
}

// O usuário digita a porcentagem (ex: "5" para 5% a.m.).
// O valor armazenado e passado ao onChange é sempre decimal (ex: 0.05).
export const InputPorcentagem = React.forwardRef<HTMLInputElement, InputPorcentagemProps>(
  ({ value, onChange, onBlur, name, disabled, className, placeholder = '0,00', max = 100 }, ref) => {
    // Converte decimal → percentual com 4 casas para não perder precisão
    const toDisplay = (v?: number) =>
      v != null && v > 0 ? +(v * 100).toFixed(4) : ''

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value
      if (raw === '') { onChange?.(0); return }
      const pct = parseFloat(raw.replace(',', '.'))
      if (!isNaN(pct)) onChange?.(Math.min(pct, max) / 100)
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          name={name}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max={max}
          value={toDisplay(value)}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background py-2 pl-3 pr-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            className
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
          %
        </span>
      </div>
    )
  }
)
InputPorcentagem.displayName = 'InputPorcentagem'
