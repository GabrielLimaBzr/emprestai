import Link from 'next/link'
import { Suspense } from 'react'
import { getEmprestimosResumo } from '@/app/actions/emprestimos'
import { Button } from '@/components/ui/button'
import { EmprestimosLista } from '@/components/emprestimos/EmprestimosLista'
import { Download, Plus } from 'lucide-react'

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
        <div className="flex shrink-0 items-center gap-2">
        <details className="group relative">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Planilha</span>
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md">
            {[
              ['contratos', 'Contratos', 'um por empréstimo'],
              ['parcelas', 'Parcelas', 'cronograma completo'],
              ['pagamentos', 'Pagamentos', 'tudo que já entrou'],
            ].map(([tipo, nome, desc]) => (
              <a
                key={tipo}
                href={`/api/exportar/planilha?tipo=${tipo}`}
                download
                className="block rounded-sm px-3 py-2 text-sm hover:bg-accent"
              >
                {nome}
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </a>
            ))}
          </div>
        </details>
        <Button asChild>
          <Link href="/emprestimos/novo">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo empréstimo</span>
          </Link>
        </Button>
        </div>
      </div>

      <Suspense>
        <EmprestimosLista emprestimos={emprestimos} />
      </Suspense>
    </div>
  )
}
