'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
)

interface FluxoChartProps {
  data: { mes: string; recebido: number; esperado: number }[]
}

interface CoresGrafico {
  texto: string
  suave: string
  grade: string
  barra: string
  barraFundo: string
  barraFraca: string
  barraFracaBorda: string
}

// O Chart.js pinta em canvas e não entende var(--x), então os tokens do tema
// precisam ser resolvidos em runtime e relidos a cada troca de tema.
const CORES_ESCURO: CoresGrafico = {
  texto: 'hsl(210 40% 95%)',
  suave: 'hsl(215 20% 55%)',
  grade: 'hsl(222 30% 18%)',
  barra: 'hsl(160 84% 39%)',
  barraFundo: 'hsl(160 84% 39% / 0.7)',
  barraFraca: 'hsl(160 84% 39% / 0.2)',
  barraFracaBorda: 'hsl(160 84% 39% / 0.5)',
}

function useCoresGrafico(): CoresGrafico {
  const { resolvedTheme } = useTheme()
  const [cores, setCores] = useState(CORES_ESCURO)

  useEffect(() => {
    const estilo = getComputedStyle(document.documentElement)
    const token = (nome: string) => estilo.getPropertyValue(nome).trim()
    const cor = (nome: string, alpha?: number) =>
      alpha === undefined ? `hsl(${token(nome)})` : `hsl(${token(nome)} / ${alpha})`

    setCores({
      texto: cor('--foreground'),
      suave: cor('--muted-foreground'),
      grade: cor('--border'),
      barra: cor('--primary'),
      barraFundo: cor('--primary', 0.7),
      barraFraca: cor('--primary', 0.2),
      barraFracaBorda: cor('--primary', 0.5),
    })
  }, [resolvedTheme])

  return cores
}

type Visao = 'mensal' | 'acumulado'

export function FluxoChart({ data }: FluxoChartProps) {
  const cores = useCoresGrafico()
  const [visao, setVisao] = useState<Visao>('mensal')

  const rotulos = data.map((d) => d.mes)

  // Acumulado responde "quanto essa carteira já rendeu", que as barras mensais
  // não mostram — cada barra é um mês isolado.
  const acumulado = data.reduce<number[]>((serie, d, i) => {
    serie.push((serie[i - 1] ?? 0) + d.recebido)
    return serie
  }, [])

  const dadosMensal = {
    labels: rotulos,
    datasets: [
      {
        label: 'Esperado',
        data: data.map((d) => d.esperado),
        backgroundColor: cores.barraFraca,
        borderColor: cores.barraFracaBorda,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Recebido',
        data: data.map((d) => d.recebido),
        backgroundColor: cores.barraFundo,
        borderColor: cores.barra,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }

  const dadosAcumulado = {
    labels: rotulos,
    datasets: [
      {
        label: 'Juros acumulados',
        data: acumulado,
        borderColor: cores.barra,
        backgroundColor: cores.barraFraca,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: cores.barra,
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: cores.texto },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            ` ${ctx.dataset.label}: R$ ${ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: cores.suave },
        grid: { color: cores.grade },
      },
      y: {
        ticks: {
          color: cores.suave,
          callback: (v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`,
        },
        grid: { color: cores.grade },
      },
    },
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {visao === 'mensal' ? 'Juros por mês' : 'Juros acumulados'}
          </CardTitle>
          <div className="flex gap-1 rounded-md bg-secondary p-0.5">
            {([['mensal', 'Mensal'], ['acumulado', 'Acumulado']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVisao(id)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  visao === id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visao === 'mensal'
          ? <Bar data={dadosMensal} options={options as any} />
          : <Line data={dadosAcumulado} options={options as any} />}
      </CardContent>
    </Card>
  )
}
