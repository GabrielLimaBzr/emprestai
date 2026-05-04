import { getDashboardStats, getProximosVencimentos, getAlertasInadimplencia, getFluxoMensal } from '@/app/actions/dashboard'
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
} from 'lucide-react'
import { formatCurrency, formatPercent } from '@/utils/currency'

export default async function DashboardPage() {
  const [stats, proximosVencimentos, alertas, fluxo] = await Promise.all([
    getDashboardStats(),
    getProximosVencimentos(),
    getAlertasInadimplencia(),
    getFluxoMensal(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua carteira de empréstimos</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          title="Capital emprestado"
          value={formatCurrency(stats.capitalEmprestado)}
          description="Total em contratos ativos"
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
          iconClassName={stats.contratosInadimplentes > 0 ? 'bg-red-500/10' : undefined}
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
          <ProximosVencimentos parcelas={proximosVencimentos} />
        </div>
      </div>

      {alertas.length > 0 && (
        <AlertasInadimplencia parcelas={alertas} />
      )}
    </div>
  )
}
