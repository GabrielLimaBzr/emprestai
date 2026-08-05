'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

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

export function FluxoChart({ data }: FluxoChartProps) {
  const cores = useCoresGrafico()

  const chartData = {
    labels: data.map((d) => d.mes),
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
        <CardTitle className="text-base">Fluxo de caixa mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <Bar data={chartData} options={options as any} />
      </CardContent>
    </Card>
  )
}
