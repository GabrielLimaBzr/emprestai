import type { Emprestimo, Parcela, Tomador, Transacao } from '@/types'

export type TipoPlanilha = 'contratos' | 'parcelas' | 'pagamentos'

export interface DadosPlanilha {
  emprestimos: (Emprestimo & { tomador?: Tomador | null })[]
  parcelas: Parcela[]
  transacoes: Transacao[]
  hoje: Date
}

type Celula = string | number | null | undefined

// Excel em pt-BR espera ';' como separador e ',' como decimal; o Google
// Planilhas lê o mesmo arquivo sem problema. Datas ficam em ISO, que ordenam
// corretamente e o Excel reconhece.
const SEPARADOR = ';'

function formatar(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return String(valor).replace('.', ',')

  // Texto livre digitado pelo usuário que comece com = + - @ vira fórmula ao
  // abrir na planilha. O apóstrofo força texto.
  const texto = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor

  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function csv(cabecalho: string[], linhas: Celula[][]): string {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(formatar).join(SEPARADOR))
  // BOM para o Excel reconhecer UTF-8 e não estragar os acentos.
  return '﻿' + corpo.join('\r\n') + '\r\n'
}

const saldo = (p: Parcela) => Math.max(0, p.valor_esperado - (p.valor_pago ?? 0))

function diasAtraso(p: Parcela, hoje: Date): number | null {
  if (p.status !== 'atrasado') return null
  return Math.floor((hoje.getTime() - new Date(`${p.data_vencimento}T00:00:00`).getTime()) / 86400000)
}

export function gerarCsv(tipo: TipoPlanilha, dados: DadosPlanilha): string {
  const { emprestimos, parcelas, transacoes, hoje } = dados
  const porId = new Map(emprestimos.map((e) => [e.id, e]))
  const parcelaPorId = new Map(parcelas.map((p) => [p.id, p]))

  if (tipo === 'contratos') {
    const doContrato = (id: string) => parcelas.filter((p) => p.emprestimo_id === id)
    const trxDoContrato = (id: string) => transacoes.filter((t) => t.emprestimo_id === id)

    // Estorno herda o tipo da parcela a que se refere.
    const liquido = (id: string, tipoParcela: 'juros' | 'principal') => {
      const entrada = tipoParcela === 'juros' ? 'juros_recebido' : 'principal_recebido'
      return trxDoContrato(id).reduce((s, t) => {
        if (t.tipo === entrada) return s + t.valor
        if (t.tipo === 'estorno' && t.parcela_id && parcelaPorId.get(t.parcela_id)?.tipo === tipoParcela) {
          return s - t.valor
        }
        return s
      }, 0)
    }

    return csv(
      [
        'Tomador', 'Status', 'Modalidade', 'Principal', 'Taxa mensal (%)', 'Início', 'Vencimento',
        'Principal restante', 'Principal devolvido', 'Juros recebidos', 'Parcelas em atraso',
        'Valor em atraso', 'Garantia', 'Descrição',
      ],
      emprestimos.map((e) => {
        const ps = doContrato(e.id)
        const atrasadas = ps.filter((p) => p.status === 'atrasado')
        return [
          e.tomador?.nome,
          e.status,
          e.modalidade,
          e.valor_principal,
          Math.round(e.taxa_juros_mensal * 10000) / 100,
          e.data_inicio,
          e.data_vencimento,
          ps.filter((p) => p.tipo === 'principal').reduce((s, p) => s + saldo(p), 0),
          liquido(e.id, 'principal'),
          liquido(e.id, 'juros'),
          atrasadas.length,
          atrasadas.reduce((s, p) => s + saldo(p), 0),
          e.garantia,
          e.descricao,
        ]
      })
    )
  }

  if (tipo === 'parcelas') {
    return csv(
      [
        'Tomador', 'Status do contrato', 'Parcela', 'Tipo', 'Vencimento', 'Valor esperado',
        'Valor pago', 'Saldo', 'Status', 'Data do pagamento', 'Dias de atraso',
      ],
      parcelas.map((p) => [
        porId.get(p.emprestimo_id)?.tomador?.nome,
        porId.get(p.emprestimo_id)?.status,
        p.numero,
        p.tipo,
        p.data_vencimento,
        p.valor_esperado,
        p.valor_pago ?? 0,
        saldo(p),
        p.status,
        p.data_pagamento,
        diasAtraso(p, hoje),
      ])
    )
  }

  return csv(
    ['Data', 'Tomador', 'Tipo', 'Valor', 'Forma de pagamento', 'Parcela', 'Observações'],
    transacoes.map((t) => [
      t.data,
      porId.get(t.emprestimo_id)?.tomador?.nome,
      t.tipo,
      t.valor,
      t.forma_pagamento,
      t.parcela_id ? parcelaPorId.get(t.parcela_id)?.numero : 'avulsa',
      t.observacoes,
    ])
  )
}
