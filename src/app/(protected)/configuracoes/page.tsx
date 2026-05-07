'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { sincronizarStatusParcelas } from '@/app/actions/parcelas'
import { getPreferencias, salvarPreferencias, type Preferencias } from '@/app/actions/preferencias'
import { sendTestNotification, dispararAlertasAgora } from '@/app/actions/notifications'
import { useNotifications } from '@/hooks/useNotifications'
import { RefreshCw, Loader2, Bell, BellRing, CheckCircle2, Zap } from 'lucide-react'

export default function ConfiguracoesPage() {
  const [syncLoading, setSyncLoading] = useState(false)
  const [prefLoading, setPrefLoading] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [testingNotif, setTestingNotif] = useState(false)
  const [disparando, setDisparando] = useState(false)
  const [prefs, setPrefs] = useState<Preferencias>({
    taxa_padrao: 0.015,
    dia_vencimento: 10,
    dias_antecedencia: 3,
  })

  const { suportado, permissao, inscrito, loading: notifLoading, inscrever, cancelarInscricao } = useNotifications()

  useEffect(() => {
    getPreferencias().then((p) => {
      setPrefs(p)
      setPrefLoading(false)
    })
  }, [])

  async function handleSalvarPrefs() {
    setSavingPrefs(true)
    try {
      await salvarPreferencias(prefs)
      toast({ title: 'Preferências salvas!', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSavingPrefs(false)
    }
  }

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

  async function handleToggleNotificacoes(ativar: boolean) {
    try {
      if (ativar) await inscrever()
      else await cancelarInscricao()
      toast({ title: ativar ? 'Notificações ativadas!' : 'Notificações desativadas.' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  async function handleDispararAlertas() {
    setDisparando(true)
    try {
      const { enviadas } = await dispararAlertasAgora()
      if (enviadas === 0) {
        toast({ title: 'Sem alertas no momento', description: 'Nenhuma parcela vencendo ou em atraso nos próximos dias.' })
      } else {
        toast({ title: `${enviadas} alerta${enviadas > 1 ? 's' : ''} enviado${enviadas > 1 ? 's' : ''}!`, variant: 'success' })
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setDisparando(false)
    }
  }

  async function handleTestarNotificacao() {
    setTestingNotif(true)
    try {
      await sendTestNotification()
      toast({ title: 'Notificação enviada!', description: 'Verifique as notificações do seu browser.' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setTestingNotif(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">Preferências do sistema</p>
      </div>

      {/* Padrões de contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrões de contrato</CardTitle>
          <CardDescription>Valores pré-preenchidos ao criar novos contratos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando preferências...</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Taxa padrão de juros (a.m.)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={prefs.taxa_padrao}
                  onChange={(e) => setPrefs(p => ({ ...p, taxa_padrao: parseFloat(e.target.value) || 0 }))}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Será pré-preenchida nos novos contratos</p>
              </div>
              <div className="space-y-2">
                <Label>Dia padrão de vencimento das parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={prefs.dia_vencimento}
                  onChange={(e) => setPrefs(p => ({ ...p, dia_vencimento: parseInt(e.target.value) || 1 }))}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Dia do mês em que as parcelas vencem por padrão</p>
              </div>
              <div className="space-y-2">
                <Label>Alertar vencimento com antecedência (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={prefs.dias_antecedencia}
                  onChange={(e) => setPrefs(p => ({ ...p, dias_antecedencia: parseInt(e.target.value) || 1 }))}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Controla o dashboard "Próximos vencimentos" e os alertas push
                </p>
              </div>
              <Button onClick={handleSalvarPrefs} disabled={savingPrefs}>
                {savingPrefs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Salvar preferências
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notificações Push */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Receba alertas de vencimentos e atrasos diretamente no browser, mesmo com a aba minimizada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!suportado ? (
            <p className="text-sm text-muted-foreground">
              Seu browser não suporta notificações push. Tente no Chrome ou Edge.
            </p>
          ) : (
            <>
              {permissao === 'denied' && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive">
                    Permissão de notificação bloqueada. Clique no ícone de cadeado na barra de endereços para liberar.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {inscrito ? 'Notificações ativas' : 'Notificações inativas'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inscrito
                      ? 'Você receberá alertas de vencimentos e atrasos'
                      : 'Ative para receber alertas automáticos'}
                  </p>
                </div>
                <Switch
                  checked={inscrito}
                  onCheckedChange={handleToggleNotificacoes}
                  disabled={notifLoading || permissao === 'denied'}
                />
              </div>

              {inscrito && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Tipos de alerta ativos:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-2">
                    <li>📅 Vencimento próximo — {prefs.dias_antecedencia} dias antes</li>
                    <li>⚠️ Parcela em atraso — no dia seguinte ao vencimento</li>
                    <li>📊 Resumo semanal — toda segunda-feira às 08h</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestarNotificacao}
                      disabled={testingNotif || disparando}
                    >
                      {testingNotif
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Bell className="h-4 w-4 mr-2" />}
                      Enviar teste
                    </Button>
                    {process.env.NODE_ENV === 'development' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDispararAlertas}
                        disabled={testingNotif || disparando}
                      >
                        {disparando
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <Zap className="h-4 w-4 mr-2" />}
                        Disparar alertas agora
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Manutenção */}
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
