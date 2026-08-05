'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronsUpDown, Loader2, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComboboxOption {
  value: string
  label: string
  badge?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Cria um registro a partir do texto digitado e devolve o valor a selecionar. */
  onCreate?: (label: string) => Promise<string | void> | string | void
  /** Texto do atalho de criação, ex: `nome => \`Criar "${nome}"\``. */
  createLabel?: (label: string) => string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  onCreate,
  createLabel = (label) => `Criar "${label}"`,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [criando, setCriando] = React.useState(false)

  const selected = options.find(o => o.value === value)

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const termo = query.trim()
  const jaExiste = options.some(o => o.label.trim().toLowerCase() === termo.toLowerCase())
  const podeCriar = Boolean(onCreate) && termo.length > 0 && !jaExiste

  async function handleCreate() {
    if (!onCreate || criando) return
    setCriando(true)
    try {
      const novoValor = await onCreate(termo)
      if (typeof novoValor === 'string') onChange(novoValor)
      setOpen(false)
      setQuery('')
    } finally {
      setCriando(false)
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (criando) return
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground'
          )}
        >
          <span className="truncate">
            {selected ? (
              <>
                {selected.label}
                {selected.badge && (
                  <span className="ml-1.5 text-xs text-muted-foreground">({selected.badge})</span>
                )}
              </>
            ) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          align="start"
          sideOffset={4}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && podeCriar && filtered.length === 0) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              !podeCriar && (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
              )
            ) : (
              filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value === option.value && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {value === option.value && <Check className="h-4 w-4" />}
                  </span>
                  {option.label}
                  {option.badge && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({option.badge})</span>
                  )}
                </button>
              ))
            )}

            {podeCriar && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={criando}
                className={cn(
                  'mt-1 flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none',
                  'text-primary hover:bg-accent disabled:opacity-60',
                  filtered.length > 0 && 'border-t border-border/60 pt-2'
                )}
              >
                {criando
                  ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  : <Plus className="h-4 w-4 shrink-0" />}
                <span className="truncate">{createLabel(termo)}</span>
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
