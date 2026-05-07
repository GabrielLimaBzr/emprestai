'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmprestimoForm } from '@/components/emprestimos/EmprestimoForm'
import { getTomadores } from '@/app/actions/tomadores'
import { createEmprestimo } from '@/app/actions/emprestimos'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect } from 'react'
import type { Tomador } from '@/types'

export default function NovoEmprestimoPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [tomadores, setTomadores] = useState<Tomador[]>([])

  useEffect(() => {
    getTomadores().then(setTomadores)
  }, [])

  async function handleSubmit(values: any) {
    setIsLoading(true)
    try {
      const emprestimo = await createEmprestimo(values)
      toast({ title: 'Empréstimo criado!', description: 'Parcelas geradas automaticamente.', variant: 'success' as any })
      router.push(`/emprestimos/${emprestimo.id}`)
    } catch (err: any) {
      toast({ title: 'Erro ao criar empréstimo', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emprestimos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Novo empréstimo</h1>
          <p className="text-muted-foreground text-sm">Preencha os dados do contrato</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do contrato</CardTitle></CardHeader>
        <CardContent>
          <EmprestimoForm
            tomadores={tomadores}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
