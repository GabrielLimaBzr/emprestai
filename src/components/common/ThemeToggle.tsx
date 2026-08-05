'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)

  // O tema só é conhecido no cliente; renderizar antes disso trocaria o ícone
  // depois da hidratação.
  useEffect(() => setMontado(true), [])

  const escuro = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      aria-label={escuro ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {montado && !escuro ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  )
}
