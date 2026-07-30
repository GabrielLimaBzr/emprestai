import { createClient } from '@/lib/supabase/server'
import { gerarParcelas } from '@/utils/juros'
import type { Parcela } from '@/types'

export interface ContratoCronograma {
  valor_principal: number
  taxa_juros_mensal: number
  data_inicio: string
  data_vencimento: string
  modalidade: 'juros_mensais' | 'sem_juros' | 'parcelado'
}

/**
 * Reconstrói o cronograma de parcelas de um empréstimo a partir dos dados
 * atuais do contrato, sem destruir histórico financeiro.
 *
 * Regras:
 * - Parcelas com dinheiro envolvido (pagas, com pagamento parcial ou com
 *   transação vinculada) NUNCA são removidas. Além de apagar histórico, a FK
 *   `transacoes.parcela_id` faria o DELETE em massa falhar — era o que
 *   duplicava o cronograma, porque o erro não era verificado e o INSERT
 *   seguia mesmo assim.
 * - Cada (tipo, mês de vencimento) ocupa um único slot: parcelas geradas que
 *   caem num slot já preservado são descartadas em vez de duplicar.
 * - Nas modalidades com principal único, a parcela do principal preservada é
 *   remanejada (novo vencimento/valor) em vez de recriada.
 * - Ao final tudo é renumerado por data, garantindo numeração única.
 */
export async function sincronizarCronograma(
  emprestimoId: string,
  userId: string,
  contrato: ContratoCronograma,
  opcoes?: { dataInicioGeracao?: string }
) {
  const supabase = createClient()

  const { data: existentes, error: listErr } = await supabase
    .from('parcelas')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', userId)

  if (listErr) throw listErr

  const { data: trx, error: trxErr } = await supabase
    .from('transacoes')
    .select('parcela_id')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', userId)
    .not('parcela_id', 'is', null)

  if (trxErr) throw trxErr

  const comTransacao = new Set((trx ?? []).map((t) => t.parcela_id as string))
  const temDinheiro = (p: Parcela) =>
    p.status === 'pago' || (p.valor_pago ?? 0) > 0 || comTransacao.has(p.id)

  const preservadas = ((existentes ?? []) as Parcela[]).filter(temDinheiro)
  const removiveis = ((existentes ?? []) as Parcela[]).filter((p) => !temDinheiro(p))

  if (removiveis.length > 0) {
    const { error } = await supabase
      .from('parcelas')
      .delete()
      .in('id', removiveis.map((p) => p.id))
      .eq('user_id', userId)

    if (error) throw error
  }

  const geradas = gerarParcelas(
    contrato.valor_principal,
    contrato.taxa_juros_mensal,
    opcoes?.dataInicioGeracao ?? contrato.data_inicio,
    contrato.data_vencimento,
    contrato.modalidade
  )

  // Nas modalidades juros_mensais/sem_juros existe um único principal.
  // Se ele já recebeu algo, remanejamos em vez de criar um segundo.
  const principalPreservado =
    contrato.modalidade === 'parcelado'
      ? undefined
      : preservadas.find((p) => p.tipo === 'principal')

  if (principalPreservado && principalPreservado.status !== 'pago') {
    const principalGerado = geradas.find((p) => p.tipo === 'principal')
    if (principalGerado) {
      const { error } = await supabase
        .from('parcelas')
        .update({
          data_vencimento: principalGerado.data_vencimento,
          valor_esperado: principalGerado.valor_esperado,
        })
        .eq('id', principalPreservado.id)
        .eq('user_id', userId)

      if (error) throw error
      principalPreservado.data_vencimento = principalGerado.data_vencimento
      principalPreservado.valor_esperado = principalGerado.valor_esperado
    }
  }

  const slot = (tipo: string, dataVencimento: string) =>
    `${tipo}|${dataVencimento.substring(0, 7)}`
  const ocupados = new Set(preservadas.map((p) => slot(p.tipo, p.data_vencimento)))

  const aInserir = geradas.filter((p) => {
    if (p.tipo === 'principal' && principalPreservado) return false
    return !ocupados.has(slot(p.tipo, p.data_vencimento))
  })

  if (aInserir.length > 0) {
    const { error } = await supabase
      .from('parcelas')
      .insert(aInserir.map((p) => ({ ...p, emprestimo_id: emprestimoId, user_id: userId })))

    if (error) throw error
  }

  await renumerarParcelas(emprestimoId, userId)
}

/** Renumera as parcelas por data de vencimento (juros antes do principal). */
async function renumerarParcelas(emprestimoId: string, userId: string) {
  const supabase = createClient()

  const { data: todas, error } = await supabase
    .from('parcelas')
    .select('id, numero, tipo, data_vencimento')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', userId)

  if (error) throw error
  if (!todas) return

  const ordenadas = [...todas].sort((a, b) => {
    if (a.data_vencimento !== b.data_vencimento) {
      return a.data_vencimento < b.data_vencimento ? -1 : 1
    }
    if (a.tipo === b.tipo) return 0
    return a.tipo === 'juros' ? -1 : 1
  })

  await Promise.all(
    ordenadas
      .map((p, i) => ({ p, numero: i + 1 }))
      .filter(({ p, numero }) => p.numero !== numero)
      .map(({ p, numero }) =>
        supabase.from('parcelas').update({ numero }).eq('id', p.id).eq('user_id', userId)
      )
  )
}
