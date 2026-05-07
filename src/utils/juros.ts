import { addMonths, monthsBetween } from './date'
import type { Parcela } from '@/types'

export interface ParcelaGerada {
  numero: number
  tipo: 'juros' | 'principal'
  valor_esperado: number
  data_vencimento: string
  status: 'pendente' | 'isento'
}

export function calcularJurosMensal(principal: number, taxa: number): number {
  return Math.round(principal * taxa * 100) / 100
}

export function gerarParcelas(
  valorPrincipal: number,
  taxaJurosMensal: number,
  dataInicio: string,
  dataVencimento: string,
  modalidade: 'juros_mensais' | 'sem_juros' | 'parcelado'
): ParcelaGerada[] {
  const parcelas: ParcelaGerada[] = []
  const meses = monthsBetween(dataInicio, dataVencimento)

  if (modalidade === 'parcelado') {
    // Tabela Price: parcelas fixas com ou sem juros
    // PMT = PV × r(1+r)^n / [(1+r)^n − 1]  (r=0 → PMT = PV/n)
    let pmt: number
    const n = Math.max(meses, 1)
    if (taxaJurosMensal === 0) {
      pmt = Math.round((valorPrincipal / n) * 100) / 100
    } else {
      const r = taxaJurosMensal
      pmt = Math.round(valorPrincipal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) * 100) / 100
    }
    for (let i = 1; i <= meses; i++) {
      parcelas.push({
        numero: i,
        tipo: 'principal',
        valor_esperado: pmt,
        data_vencimento: addMonths(dataInicio, i),
        status: 'pendente',
      })
    }
    return parcelas
  }

  const jurosMensal = calcularJurosMensal(valorPrincipal, taxaJurosMensal)
  const isIsento = modalidade === 'sem_juros' || taxaJurosMensal === 0

  for (let i = 1; i <= meses; i++) {
    const dataVenc = addMonths(dataInicio, i)
    parcelas.push({
      numero: i,
      tipo: 'juros',
      valor_esperado: isIsento ? 0 : jurosMensal,
      data_vencimento: dataVenc,
      status: isIsento ? 'isento' : 'pendente',
    })
  }

  // Parcela do principal no vencimento
  parcelas.push({
    numero: meses + 1,
    tipo: 'principal',
    valor_esperado: valorPrincipal,
    data_vencimento: dataVencimento,
    status: 'pendente',
  })

  return parcelas
}

export function calcularRentabilidadeMedia(emprestimos: { taxa_juros_mensal: number; valor_principal: number }[]): number {
  if (emprestimos.length === 0) return 0
  const totalCapital = emprestimos.reduce((sum, e) => sum + e.valor_principal, 0)
  if (totalCapital === 0) return 0
  const rentabilidadePonderada = emprestimos.reduce(
    (sum, e) => sum + e.taxa_juros_mensal * e.valor_principal,
    0
  )
  return rentabilidadePonderada / totalCapital
}

export function calcularProjecaoRecebimentos(
  parcelas: Parcela[],
  meses: number
): { mes: string; valor: number }[] {
  const hoje = new Date()
  const resultado: { mes: string; valor: number }[] = []

  for (let i = 0; i < meses; i++) {
    const mes = addMonths(hoje.toISOString(), i)
    const mesStr = mes.substring(0, 7) // YYYY-MM
    const valor = parcelas
      .filter(
        (p) =>
          p.status === 'pendente' &&
          p.tipo === 'juros' &&
          p.data_vencimento.startsWith(mesStr)
      )
      .reduce((sum, p) => sum + p.valor_esperado, 0)
    resultado.push({ mes: mesStr, valor })
  }

  return resultado
}
