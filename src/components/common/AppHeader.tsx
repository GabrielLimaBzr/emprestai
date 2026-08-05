'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Menu, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, TrendingUp, Users, CalendarDays, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrivacy } from '@/contexts/privacy'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/emprestimos', label: 'Empréstimos', icon: TrendingUp },
  { href: '/tomadores', label: 'Tomadores', icon: Users },
  { href: '/parcelas', label: 'Parcelas', icon: CalendarDays },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

interface AppHeaderProps {
  userEmail?: string
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isPrivate, toggle } = usePrivacy()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b border-border bg-card" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile logo */}
        <div className="flex md:hidden items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="font-bold">emprestAI</span>
        </div>

        <div className="hidden md:block" />

        {/* User + logout */}
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="hidden sm:block text-sm text-muted-foreground">{userEmail}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            title={isPrivate ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden px-3 pb-3 space-y-1 border-t border-border pt-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
