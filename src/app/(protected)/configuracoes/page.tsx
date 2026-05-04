'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { sincronizarStatusParcelas } from '@/app/actions/parcelas'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function ConfiguracoesPage() {
  const [syncLoading, setSyncLoading] = useState(false)

  async function handleSyncParcelas() {
    setSyncLoading(true)
    try {
      await sincronizarStatusParcelas()
      toast({ title: 'Status sincronizado!', description: 'Parcelas vencidas marcadas como atrasado.' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">Preferências do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrões de contrato</CardTitle>
          <CardDescription>Valores pré-preenchidos ao criar novos contratos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Taxa padrão de juros (a.m.)</Label>
            <Input type="number" step="0.001" defaultValue="0.05" placeholder="0.05" className="max-w-xs" />
            <p className="text-xs text-muted-foreground">Será pré-preenchida nos novos contratos</p>
          </div>
          <div className="space-y-2">
            <Label>Dia padrão de vencimento das parcelas</Label>
            <Input type="number" min="1" max="28" defaultValue="1" placeholder="1" className="max-w-xs" />
            <p className="text-xs text-muted-foreground">Dia do mês em que as parcelas vencem por padrão</p>
          </div>
          <div className="space-y-2">
            <Label>Alertar vencimento com antecedência (dias)</Label>
            <Input type="number" min="1" max="30" defaultValue="7" placeholder="7" className="max-w-xs" />
          </div>
          <Button>Salvar preferências</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manutenção</CardTitle>
          <CardDescription>Operações administrativas do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Sincronizar status das parcelas</p>
            <p className="text-xs text-muted-foreground mb-3">
              Marca como "atrasado" todas as parcelas pendentes com data de vencimento no passado.
              Execute manualmente quando necessário.
            </p>
            <Button variant="outline" onClick={handleSyncParcelas} disabled={syncLoading}>
              {syncLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sincronizar parcelas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
