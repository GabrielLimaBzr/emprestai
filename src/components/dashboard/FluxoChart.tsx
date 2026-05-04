'use client'

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

export function FluxoChart({ data }: FluxoChartProps) {
  const chartData = {
    labels: data.map((d) => d.mes),
    datasets: [
      {
        label: 'Esperado',
        data: data.map((d) => d.esperado),
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.5)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Recebido',
        data: data.map((d) => d.recebido),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: 'rgb(16, 185, 129)',
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
        labels: { color: 'hsl(210, 40%, 85%)' },
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
        ticks: { color: 'hsl(215, 20%, 55%)' },
        grid: { color: 'hsl(222, 30%, 18%)' },
      },
      y: {
        ticks: {
          color: 'hsl(215, 20%, 55%)',
          callback: (v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}`,
        },
        grid: { color: 'hsl(222, 30%, 18%)' },
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
