'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2, MailCheck } from 'lucide-react'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  function resetForm() {
    setError(null)
    setName('')
    setPassword('')
    setConfirm('')
  }

  function toggleMode() {
    setMode(m => m === 'login' ? 'register' : 'login')
    resetForm()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Se o Supabase confirmar automaticamente (sem email), já redireciona
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Caso contrário, mostra mensagem de confirmação
    setRegistered(true)
    setLoading(false)
  }

  // ── Tela pós-cadastro (aguardando confirmação de email) ────────────────────
  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold">Confirme seu email</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Enviamos um link de confirmação para <strong>{email}</strong>.
              Clique no link para ativar sua conta e depois faça login.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => { setRegistered(false); setMode('login') }}>
            Ir para o login
          </Button>
        </div>
      </div>
    )
  }

  // ── Formulário de login / cadastro ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight">emprestAI</span>
          </div>
          <p className="text-sm text-muted-foreground">Gestão inteligente de empréstimos</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Use suas credenciais para acessar o sistema'
                : 'Crie sua conta para começar a gerenciar seus empréstimos'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Seu nome</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="João Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={mode === 'login'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar senha</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading
                  ? mode === 'login' ? 'Entrando...' : 'Criando conta...'
                  : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {mode === 'login' ? (
                <p className="text-muted-foreground">
                  Não tem conta?{' '}
                  <button onClick={toggleMode} className="text-primary hover:underline font-medium">
                    Cadastre-se
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Já tem conta?{' '}
                  <button onClick={toggleMode} className="text-primary hover:underline font-medium">
                    Fazer login
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
