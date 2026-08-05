import Link from 'next/link'
import { Suspense } from 'react'
import { getEmprestimosResumo } from '@/app/actions/emprestimos'
import { Button } from '@/components/ui/button'
import { EmprestimosLista } from '@/components/emprestimos/EmprestimosLista'
import { Plus } from 'lucide-react'

export default async function EmprestimosPage() {
  const emprestimos = await getEmprestimosResumo()
  const emAberto = emprestimos.filter((e) => e.status !== 'quitado').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Empréstimos</h1>
          <p className="text-muted-foreground text-sm">
            {emAberto} em aberto · {emprestimos.length} no total
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/emprestimos/novo">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo empréstimo</span>
          </Link>
        </Button>
      </div>

      <Suspense>
        <EmprestimosLista emprestimos={emprestimos} />
      </Suspense>
    </div>
  )
}
