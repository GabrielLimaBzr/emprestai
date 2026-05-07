'use client'

import * as React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, onChange, onBlur, name, id, defaultValue, disabled }, ref) => {
    const hiddenRef = React.useRef<HTMLInputElement>(null)

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        (hiddenRef as React.MutableRefObject<HTMLInputElement | null>).current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
      },
      [ref]
    )

    const [display, setDisplay] = React.useState(() => isoToDisplay((defaultValue || '') as string))

    function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
      let masked = digits
      if (digits.length > 2) masked = `${digits.slice(0, 2)}/${digits.slice(2)}`
      if (digits.length > 4) masked = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
      setDisplay(masked)

      const hidden = hiddenRef.current
      if (!hidden) return

      if (digits.length === 8) {
        const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8)
        hidden.value = `${y}-${m}-${d}`
      } else {
        hidden.value = ''
      }
      onChange?.({ ...e, target: hidden, currentTarget: hidden })
    }

    function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
      setDisplay(isoToDisplay(e.target.value))
      onChange?.(e)
    }

    function openPicker() {
      const hidden = hiddenRef.current
      if (!hidden) return
      try {
        hidden.showPicker()
      } catch {
        hidden.focus()
        hidden.click()
      }
    }

    return (
      <div className="relative w-full">
        <input
          type="date"
          ref={setRefs}
          name={name}
          defaultValue={defaultValue}
          onChange={handlePickerChange}
          onBlur={onBlur}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 opacity-0 pointer-events-none"
        />
        <input
          type="text"
          id={id}
          value={display}
          onChange={handleTextChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        />
        <button
          type="button"
          onClick={openPicker}
          tabIndex={-1}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto z-10"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
    )
  }
)
DateInput.displayName = 'DateInput'

export { DateInput }
