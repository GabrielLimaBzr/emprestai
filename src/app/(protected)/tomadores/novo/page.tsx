'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TomadorForm } from '@/components/tomadores/TomadorForm'
import { createTomador } from '@/app/actions/tomadores'
import { toast } from '@/hooks/use-toast'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NovoTomadorPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(values: any) {
    setIsLoading(true)
    try {
      await createTomador(values)
      toast({ title: 'Tomador cadastrado!' })
      router.push('/tomadores')
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tomadores"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo tomador</h1>
          <p className="text-muted-foreground text-sm">Cadastre uma pessoa na sua carteira</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do tomador</CardTitle></CardHeader>
        <CardContent>
          <TomadorForm onSubmit={handleSubmit} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
