'use client'

import * as React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null)

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
      },
      [ref]
    )

    function openPicker() {
      const input = innerRef.current
      if (!input) return
      try {
        input.showPicker()
      } catch {
        input.focus()
        input.click()
      }
    }

    return (
      // Container overflow-hidden + focus-within ring prevents the native input's
      // intrinsic minimum width from overflowing the card on narrow screens.
      // The input is absolutely positioned so it never pushes the container wider.
      <div
        className={cn(
          'relative h-10 w-full overflow-hidden rounded-md border border-input bg-background',
          'ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        )}
      >
        <input
          type="date"
          ref={setRefs}
          className={cn(
            'absolute inset-0 h-full w-full bg-transparent px-3 py-2 pr-10 text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer',
            className
          )}
          {...props}
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
