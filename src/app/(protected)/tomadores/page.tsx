import Link from 'next/link'
import { getTomadores } from '@/app/actions/tomadores'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/utils/currency'
import { Plus, Users, Heart, Phone, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function TomadoresPage() {
  const tomadores = await getTomadores()

  // Buscar total emprestado por tomador
  const supabase = createClient()
  const { data: resumos } = await supabase
    .from('emprestimos')
    .select('tomador_id, valor_principal, status')
    .in('status', ['ativo', 'inadimplente'])

  function totalEmprestado(tomadorId: string) {
    return resumos?.filter(r => r.tomador_id === tomadorId).reduce((s, r) => s + r.valor_principal, 0) ?? 0
  }

  function qtdAtivos(tomadorId: string) {
    return resumos?.filter(r => r.tomador_id === tomadorId).length ?? 0
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tomadores</h1>
          <p className="text-muted-foreground text-sm">{tomadores.length} cadastrado{tomadores.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/tomadores/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo tomador
          </Link>
        </Button>
      </div>

      {tomadores.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum tomador cadastrado"
          description="Cadastre as pessoas que tomam emprestado de você para começar a gerenciar seus contratos."
          action={{ label: 'Cadastrar tomador', href: '/tomadores/novo' }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tomadores.map((t) => (
            <Link key={t.id} href={`/tomadores/${t.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{t.nome}</p>
                      {t.eh_familiar && (
                        <Badge variant="muted" className="mt-1 gap-1">
                          <Heart className="h-3 w-3" />
                          Familiar
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{qtdAtivos(t.id)} ativo{qtdAtivos(t.id) !== 1 ? 's' : ''}</p>
                      <p className="font-medium text-sm">{formatCurrency(totalEmprestado(t.id))}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {t.telefone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {t.telefone}
                      </div>
                    )}
                    {t.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" />
                        {t.email}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
