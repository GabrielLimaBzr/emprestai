import type { Emprestimo, Parcela, Tomador, Transacao } from '@/types'

export interface DadosCarteira {
  geradoEm: Date
  emprestimos: (Emprestimo & { tomador?: Tomador | null })[]
  parcelas: Parcela[]
  transacoes: Transacao[]
}

const dinheiro = (v: number) => v.toFixed(2)
const pct = (fracao: number) => `${(fracao * 100).toFixed(2)}%`

const ROTULO_STATUS_EMPRESTIMO: Record<string, string> = {
  ativo: 'ativo',
  quitado: 'quitado',
  inadimplente: 'inadimplente',
  renegociado: 'renegociado',
}

const ROTULO_MODALIDADE: Record<string, string> = {
  juros_mensais: 'juros mensais + principal no fim',
  sem_juros: 'sem juros',
  parcelado: 'parcelado (Price)',
}

function saldoAberto(p: Parcela): number {
  return Math.max(0, p.valor_esperado - (p.valor_pago ?? 0))
}

function diasEntre(de: string, ate: Date): number {
  return Math.floor((ate.getTime() - new Date(`${de}T00:00:00`).getTime()) / 86400000)
}

function tabela(cabecalho: string[], linhas: (string | number)[][]): string {
  if (linhas.length === 0) return '_Nenhum registro._\n'
  const sep = cabecalho.map(() => '---')
  return [
    `| ${cabecalho.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...linhas.map((l) => `| ${l.join(' | ')} |`),
  ].join('\n') + '\n'
}

/**
 * Monta um dossiê da carteira em Markdown, pensado para ser lido por um modelo
 * de linguagem. Por isso o documento carrega o próprio dicionário: sem as
 * convenções abaixo, uma IA calcula "capital emprestado" ou "juros recebidos"
 * de forma plausível e errada.
 */
export function gerarMarkdownCarteira(dados: DadosCarteira): string {
  const { geradoEm, emprestimos, parcelas, transacoes } = dados

  const parcelasPor = new Map<string, Parcela[]>()
  for (const p of parcelas) {
    if (!parcelasPor.has(p.emprestimo_id)) parcelasPor.set(p.emprestimo_id, [])
    parcelasPor.get(p.emprestimo_id)!.push(p)
  }
  for (const lista of Array.from(parcelasPor.values())) {
    lista.sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : 1))
  }

  const transacoesPor = new Map<string, Transacao[]>()
  for (const t of transacoes) {
    if (!transacoesPor.has(t.emprestimo_id)) transacoesPor.set(t.emprestimo_id, [])
    transacoesPor.get(t.emprestimo_id)!.push(t)
  }
  for (const lista of Array.from(transacoesPor.values())) {
    lista.sort((a, b) => (a.data < b.data ? -1 : 1))
  }

  const tipoDaParcela = new Map(parcelas.map((p) => [p.id, p.tipo]))

  // Estorno não guarda o tipo do que reverteu; é atribuído pela parcela ligada.
  const recebidoLiquido = (linhas: Transacao[], tipo: 'juros' | 'principal') => {
    const entrada = tipo === 'juros' ? 'juros_recebido' : 'principal_recebido'
    return linhas.reduce((s, t) => {
      if (t.tipo === entrada) return s + t.valor
      if (t.tipo === 'estorno' && t.parcela_id && tipoDaParcela.get(t.parcela_id) === tipo) {
        return s - t.valor
      }
      return s
    }, 0)
  }

  const capitalEmAberto = parcelas
    .filter((p) => p.tipo === 'principal')
    .reduce((s, p) => s + saldoAberto(p), 0)

  const principalDevolvido = recebidoLiquido(transacoes, 'principal')
  const jurosRecebidos = recebidoLiquido(transacoes, 'juros')

  const atrasadas = parcelas.filter((p) => p.status === 'atrasado')
  const totalAtrasado = atrasadas.reduce((s, p) => s + saldoAberto(p), 0)

  const emCurso = emprestimos.filter((e) => e.status !== 'quitado')
  const baseRentabilidade = emCurso.reduce((s, e) => s + e.valor_principal, 0)
  const rentabilidade =
    baseRentabilidade > 0
      ? emCurso.reduce((s, e) => s + e.taxa_juros_mensal * e.valor_principal, 0) / baseRentabilidade
      : 0

  const iso = geradoEm.toISOString().slice(0, 10)
  const partes: string[] = []

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  partes.push(`# Carteira de empréstimos — emprestAI

Dossiê completo da carteira, exportado para análise.

- **Gerado em:** ${geradoEm.toISOString()}
- **Moeda:** BRL. Valores em decimal com ponto — \`4500.00\` são quatro mil e quinhentos reais.
- **Datas:** ISO 8601 (\`AAAA-MM-DD\`).
- **Escopo:** ${emprestimos.length} contrato(s), ${parcelas.length} parcela(s), ${transacoes.length} transação(ões).
`)

  // ── Dicionário ─────────────────────────────────────────────────────────────
  partes.push(`---

## 1. Como ler este documento

Um **empréstimo** (contrato) tem um **cronograma de parcelas**. Cada parcela é de
\`juros\` ou de \`principal\`. Os pagamentos ficam em **transações**, que podem ou
não estar ligadas a uma parcela.

| Termo | Significado |
| --- | --- |
| \`valor_principal\` | Valor de face do contrato, o capital emprestado. |
| \`taxa_mensal\` | Juros ao mês sobre o principal. |
| \`valor_esperado\` | Quanto a parcela deveria receber. |
| \`valor_pago\` | Quanto já entrou nessa parcela. Pode ser menor que o esperado. |
| \`saldo\` | \`valor_esperado - valor_pago\`, nunca negativo. O que falta receber. |
| \`isento\` | Parcela de juros dispensada (empréstimo sem juros). Vale 0. |

### Convenções que mudam o resultado do cálculo

Estas quatro regras não são óbvias a partir dos dados. Ignorá-las produz
números plausíveis e errados.

1. **Parcela \`pendente\` pode ter \`valor_pago > 0\`.** O principal costuma ser
   quitado aos poucos; a parcela só vira \`pago\` quando o saldo zera. Para saber
   quanto ainda está na rua, use o **saldo**, nunca o \`valor_esperado\`.

2. **Não deduza o principal devolvido do \`valor_principal\`.** Uma amortização
   reduz o \`valor_principal\` do contrato **e** registra uma transação. Subtrair
   as transações do valor de face conta a mesma devolução duas vezes. O capital
   em aberto neste documento vem do **saldo das parcelas de principal**, que é a
   fonte consistente.

3. **\`estorno\` não registra o que reverteu.** O tipo é inferido pela parcela
   vinculada. Um estorno sem parcela ligada não é atribuível a juros nem a
   principal e fica de fora dos totais líquidos.

4. **Juros e principal são dinheiros diferentes.** Juros são o ganho; principal
   é capital voltando. Somar os dois como "recebido" mistura receita com
   devolução de patrimônio.
`)

  // ── Resumo ─────────────────────────────────────────────────────────────────
  partes.push(`---

## 2. Resumo da carteira

${tabela(
  ['Indicador', 'Valor', 'Como é calculado'],
  [
    ['Capital em aberto', dinheiro(capitalEmAberto), 'Soma do saldo das parcelas de principal'],
    ['Principal devolvido', dinheiro(principalDevolvido), 'Transações de principal, líquidas de estorno'],
    ['Juros recebidos (total)', dinheiro(jurosRecebidos), 'Transações de juros, líquidas de estorno'],
    ['Total em atraso', dinheiro(totalAtrasado), `Saldo das ${atrasadas.length} parcela(s) com status atrasado`],
    ['Contratos', String(emprestimos.length), `${emCurso.length} em curso, ${emprestimos.length - emCurso.length} quitado(s)`],
    ['Rentabilidade média', pct(rentabilidade), 'Taxa mensal ponderada pelo principal dos contratos em curso'],
  ]
)}`)

  // ── Concentração ───────────────────────────────────────────────────────────
  const porTomador = new Map<string, { nome: string; contratos: number; aberto: number; atrasado: number }>()
  for (const e of emprestimos) {
    const nome = e.tomador?.nome ?? 'Desconhecido'
    const atual = porTomador.get(nome) ?? { nome, contratos: 0, aberto: 0, atrasado: 0 }
    const doContrato = parcelasPor.get(e.id) ?? []
    atual.contratos += 1
    atual.aberto += doContrato.filter((p) => p.tipo === 'principal').reduce((s, p) => s + saldoAberto(p), 0)
    atual.atrasado += doContrato.filter((p) => p.status === 'atrasado').reduce((s, p) => s + saldoAberto(p), 0)
    porTomador.set(nome, atual)
  }

  const concentracao = Array.from(porTomador.values()).sort((a, b) => b.aberto - a.aberto)

  partes.push(`---

## 3. Concentração por tomador

Risco de contraparte: quanto da carteira depende de cada pessoa.

${tabela(
  ['Tomador', 'Contratos', 'Capital em aberto', '% da carteira', 'Em atraso'],
  concentracao.map((t) => [
    t.nome,
    t.contratos,
    dinheiro(t.aberto),
    capitalEmAberto > 0 ? pct(t.aberto / capitalEmAberto) : '0.00%',
    dinheiro(t.atrasado),
  ])
)}`)

  // ── Contratos ──────────────────────────────────────────────────────────────
  partes.push(`---

## 4. Contratos
`)

  const ordenados = [...emprestimos].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'quitado' ? 1 : -1
    return a.data_vencimento < b.data_vencimento ? -1 : 1
  })

  for (const e of ordenados) {
    const doContrato = parcelasPor.get(e.id) ?? []
    const trx = transacoesPor.get(e.id) ?? []
    const abertoContrato = doContrato
      .filter((p) => p.tipo === 'principal')
      .reduce((s, p) => s + saldoAberto(p), 0)

    partes.push(`### ${e.tomador?.nome ?? 'Desconhecido'} — ${dinheiro(e.valor_principal)} (${ROTULO_STATUS_EMPRESTIMO[e.status] ?? e.status})

- Modalidade: ${ROTULO_MODALIDADE[e.modalidade] ?? e.modalidade}
- Taxa mensal: ${pct(e.taxa_juros_mensal)}
- Período: ${e.data_inicio} → ${e.data_vencimento}
- Capital em aberto: ${dinheiro(abertoContrato)}
- Juros recebidos neste contrato: ${dinheiro(recebidoLiquido(trx, 'juros'))}
- Principal devolvido neste contrato: ${dinheiro(recebidoLiquido(trx, 'principal'))}
${e.garantia ? `- Garantia: ${e.garantia}\n` : ''}
#### Cronograma

${tabela(
  ['#', 'Tipo', 'Vencimento', 'Esperado', 'Pago', 'Saldo', 'Status', 'Dias de atraso'],
  doContrato.map((p) => [
    p.numero,
    p.tipo,
    p.data_vencimento,
    dinheiro(p.valor_esperado),
    p.valor_pago != null ? dinheiro(p.valor_pago) : '0.00',
    dinheiro(saldoAberto(p)),
    p.status,
    p.status === 'atrasado' ? diasEntre(p.data_vencimento, geradoEm) : '—',
  ])
)}
#### Pagamentos registrados

${tabela(
  ['Data', 'Tipo', 'Valor', 'Forma', 'Parcela', 'Observação'],
  trx.map((t) => [
    t.data,
    t.tipo,
    dinheiro(t.valor),
    t.forma_pagamento ?? '—',
    t.parcela_id ? String(doContrato.find((p) => p.id === t.parcela_id)?.numero ?? '?') : 'avulsa',
    (t.observacoes ?? '—').replace(/\|/g, '\\|'),
  ])
)}`)
  }

  // ── Série mensal ───────────────────────────────────────────────────────────
  const meses = new Map<string, { jurosEsperado: number; jurosRecebido: number; principalRecebido: number }>()
  const balde = (chave: string) => {
    if (!meses.has(chave)) meses.set(chave, { jurosEsperado: 0, jurosRecebido: 0, principalRecebido: 0 })
    return meses.get(chave)!
  }

  for (const p of parcelas) {
    if (p.tipo === 'juros') balde(p.data_vencimento.slice(0, 7)).jurosEsperado += p.valor_esperado
  }
  for (const t of transacoes) {
    const b = balde(t.data.slice(0, 7))
    const tipoParcela = t.parcela_id ? tipoDaParcela.get(t.parcela_id) : undefined
    if (t.tipo === 'juros_recebido') b.jurosRecebido += t.valor
    else if (t.tipo === 'principal_recebido') b.principalRecebido += t.valor
    else if (t.tipo === 'estorno' && tipoParcela === 'juros') b.jurosRecebido -= t.valor
    else if (t.tipo === 'estorno' && tipoParcela === 'principal') b.principalRecebido -= t.valor
  }

  partes.push(`---

## 5. Série mensal

Juros esperados pela data de vencimento da parcela; recebidos pela data do
pagamento. Os dois não batem quando há atraso ou adiantamento — a diferença é
justamente o sinal a observar.

${tabela(
  ['Mês', 'Juros esperados', 'Juros recebidos', 'Principal devolvido'],
  Array.from(meses.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mes, v]) => [
      mes,
      dinheiro(v.jurosEsperado),
      dinheiro(v.jurosRecebido),
      dinheiro(v.principalRecebido),
    ])
)}`)

  // ── Fatos objetivos ────────────────────────────────────────────────────────
  const fatos: string[] = []

  if (atrasadas.length > 0) {
    const maisAntiga = [...atrasadas].sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : 1))[0]
    fatos.push(
      `${atrasadas.length} parcela(s) em atraso, somando ${dinheiro(totalAtrasado)}. ` +
        `A mais antiga venceu em ${maisAntiga.data_vencimento} (${diasEntre(maisAntiga.data_vencimento, geradoEm)} dias).`
    )
  }

  const maior = concentracao[0]
  if (maior && capitalEmAberto > 0) {
    fatos.push(
      `${maior.nome} concentra ${pct(maior.aberto / capitalEmAberto)} do capital em aberto (${dinheiro(maior.aberto)}).`
    )
  }

  const vencidosNaoQuitados = emprestimos.filter(
    (e) => e.status !== 'quitado' && e.data_vencimento < iso
  )
  if (vencidosNaoQuitados.length > 0) {
    fatos.push(
      `${vencidosNaoQuitados.length} contrato(s) passaram da data de vencimento sem estar quitados: ` +
        vencidosNaoQuitados.map((e) => `${e.tomador?.nome ?? '?'} (venceu ${e.data_vencimento})`).join(', ') + '.'
    )
  }

  const semTelefone = emprestimos.filter((e) => e.status !== 'quitado' && !e.tomador?.telefone)
  if (semTelefone.length > 0) {
    fatos.push(`${semTelefone.length} contrato(s) em curso têm tomador sem telefone cadastrado.`)
  }

  partes.push(`---

## 6. Fatos objetivos

${fatos.length > 0 ? fatos.map((f) => `- ${f}`).join('\n') : '- Nenhum ponto de atenção identificado automaticamente.'}

---

_Documento gerado automaticamente pelo emprestAI em ${iso}. Os totais seguem as
convenções da seção 1._
`)

  return partes.join('\n')
}
