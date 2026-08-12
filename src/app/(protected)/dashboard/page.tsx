import { getDashboardStats, getProximosVencimentos, getAlertasInadimplencia, getFluxoMensal } from '@/app/actions/dashboard'
import { getPreferencias } from '@/app/actions/preferencias'
import { StatCard } from '@/components/common/StatCard'
import { FluxoChart } from '@/components/dashboard/FluxoChart'
import { ProximosVencimentos } from '@/components/dashboard/ProximosVencimentos'
import { AlertasInadimplencia } from '@/components/dashboard/AlertasInadimplencia'
import {
  DollarSign,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  Percent,
  Plus,
} from 'lucide-react'
import { formatCurrency, formatPercent } from '@/utils/currency'
import Link from 'next/link'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  // Origem absoluta para montar o link do extrato dentro da mensagem de cobrança.
  const cabecalhos = headers()
  const origem = `${cabecalhos.get('x-forwarded-proto') ?? 'https'}://${cabecalhos.get('host')}`

  const prefs = await getPreferencias()
  const [stats, proximosVencimentos, alertas, fluxo] = await Promise.all([
    getDashboardStats(),
    getProximosVencimentos(prefs.dias_antecedencia),
    getAlertasInadimplencia(),
    getFluxoMensal(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral da sua carteira de empréstimos</p>
        </div>
        <Link
          href="/emprestimos/novo"
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo empréstimo</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          title="Capital em aberto"
          value={formatCurrency(stats.capitalEmAberto)}
          description={`${formatCurrency(stats.principalDevolvido)} já devolvidos`}
          icon={DollarSign}
        />
        <StatCard
          title="Juros recebidos"
          value={formatCurrency(stats.jurosRecebidosMes)}
          description="Mês atual"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="A receber (30 dias)"
          value={formatCurrency(stats.jurosAReceberProximos30)}
          description="Parcelas de juros pendentes"
          icon={CalendarClock}
        />
        <StatCard
          title="Inadimplentes"
          value={String(stats.contratosInadimplentes)}
          description={stats.contratosInadimplentes > 0 ? 'Atenção necessária' : 'Tudo em dia'}
          icon={AlertTriangle}
          trend={stats.contratosInadimplentes > 0 ? 'down' : 'up'}
          iconClassName={stats.contratosInadimplentes > 0 ? 'bg-danger/10' : undefined}
        />
        <StatCard
          title="Rentabilidade"
          value={formatPercent(stats.rentabilidadeMedia)}
          description="Média mensal da carteira"
          icon={Percent}
          trend="up"
        />
      </div>

      {/* Gráfico + listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FluxoChart data={fluxo} />
        </div>
        <div className="space-y-4">
          <ProximosVencimentos parcelas={proximosVencimentos} diasAntecedencia={prefs.dias_antecedencia} />
        </div>
      </div>

      {alertas.length > 0 && (
        <AlertasInadimplencia parcelas={alertas} origem={origem} />
      )}
    </div>
  )
}
