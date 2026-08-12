'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sincronizarCronograma } from '@/lib/cronograma'
import type { Parcela, Transacao } from '@/types'

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function getParcelasByEmprestimo(emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', user.id)
    .order('numero')

  if (error) throw error
  return data as Parcela[]
}

export async function getAllParcelas(filtros?: { status?: string; proximosDias?: number }) {
  const supabase = createClient()
  const user = await getUser()
  let query = supabase
    .from('parcelas')
    .select('*, emprestimo:emprestimos(*, tomador:tomadores(nome))')
    .eq('user_id', user.id)
    .order('data_vencimento')

  if (filtros?.status) {
    query = query.eq('status', filtros.status)
  }

  if (filtros?.proximosDias) {
    const hoje = new Date().toISOString().split('T')[0]
    const limite = new Date()
    limite.setDate(limite.getDate() + filtros.proximosDias)
    const limiteStr = limite.toISOString().split('T')[0]
    query = query.gte('data_vencimento', hoje).lte('data_vencimento', limiteStr)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function registrarPagamento(
  parcelaId: string,
  emprestimoId: string,
  values: {
    valor_pago: number
    data_pagamento: string
    forma_pagamento: string
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_esperado, tipo')
    .eq('id', parcelaId)
    .eq('user_id', user.id)
    .single()

  if (!parcela) throw new Error('Parcela não encontrada')

  const novoPagamento = values.valor_pago >= parcela.valor_esperado ? 'pago' : 'atrasado'

  const { error: parcErr } = await supabase
    .from('parcelas')
    .update({
      status: novoPagamento,
      data_pagamento: values.data_pagamento,
      valor_pago: values.valor_pago,
      observacoes: values.observacoes,
    })
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (parcErr) throw parcErr

  const tipoTransacao = parcela.tipo === 'principal' ? 'principal_recebido' : 'juros_recebido'

  const { error: trxErr } = await supabase.from('transacoes').insert({
    user_id: user.id,
    emprestimo_id: emprestimoId,
    parcela_id: parcelaId,
    tipo: tipoTransacao,
    valor: values.valor_pago,
    data: values.data_pagamento,
    forma_pagamento: values.forma_pagamento,
    observacoes: values.observacoes,
  })

  if (trxErr) throw trxErr

  if (parcela.tipo === 'principal' && novoPagamento === 'pago') {
    const { data: pendentes } = await supabase
      .from('parcelas')
      .select('id')
      .eq('emprestimo_id', emprestimoId)
      .eq('user_id', user.id)
      .in('status', ['pendente', 'atrasado'])
      .limit(1)

    if (!pendentes || pendentes.length === 0) {
      await supabase
        .from('emprestimos')
        .update({ status: 'quitado' })
        .eq('id', emprestimoId)
        .eq('user_id', user.id)
    }
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function registrarAbatimentoPrincipal(
  parcelaId: string,
  emprestimoId: string,
  values: {
    valor_pago: number
    data_pagamento: string
    forma_pagamento: string
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_esperado, tipo')
    .eq('id', parcelaId)
    .eq('user_id', user.id)
    .single()

  if (!parcela) throw new Error('Parcela não encontrada')

  const { data: transacoes } = await supabase
    .from('transacoes')
    .select('valor')
    .eq('parcela_id', parcelaId)
    .eq('user_id', user.id)
    .eq('tipo', 'principal_recebido')

  const totalAnterior = (transacoes ?? []).reduce((acc, t) => acc + (t.valor as number), 0)
  const novoTotal = totalAnterior + values.valor_pago

  const { error: trxErr } = await supabase.from('transacoes').insert({
    user_id: user.id,
    emprestimo_id: emprestimoId,
    parcela_id: parcelaId,
    tipo: 'principal_recebido',
    valor: values.valor_pago,
    data: values.data_pagamento,
    forma_pagamento: values.forma_pagamento,
    observacoes: values.observacoes,
  })

  if (trxErr) throw trxErr

  const quitado = novoTotal >= parcela.valor_esperado
  const updateParcela: Record<string, unknown> = { valor_pago: novoTotal }
  if (quitado) {
    updateParcela.status = 'pago'
    updateParcela.data_pagamento = values.data_pagamento
  }

  const { error: parcErr } = await supabase
    .from('parcelas')
    .update(updateParcela)
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (parcErr) throw parcErr

  if (quitado) {
    const { data: pendentes } = await supabase
      .from('parcelas')
      .select('id')
      .eq('emprestimo_id', emprestimoId)
      .eq('user_id', user.id)
      .in('status', ['pendente', 'atrasado'])
      .limit(1)

    if (!pendentes || pendentes.length === 0) {
      await supabase
        .from('emprestimos')
        .update({ status: 'quitado' })
        .eq('id', emprestimoId)
        .eq('user_id', user.id)
    }
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function estornarPagamento(parcelaId: string, emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('valor_pago, data_pagamento')
    .eq('id', parcelaId)
    .eq('user_id', user.id)
    .single()

  if (!parcela) throw new Error('Parcela não encontrada')

  await supabase.from('transacoes').insert({
    user_id: user.id,
    emprestimo_id: emprestimoId,
    parcela_id: parcelaId,
    tipo: 'estorno',
    valor: parcela.valor_pago ?? 0,
    data: new Date().toISOString().split('T')[0],
    observacoes: 'Estorno',
  })

  await supabase
    .from('parcelas')
    .update({ status: 'pendente', data_pagamento: null, valor_pago: null })
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/dashboard')
}

export async function updateParcela(
  parcelaId: string,
  emprestimoId: string,
  values: {
    valor_esperado?: number
    data_vencimento?: string
    status?: Parcela['status']
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('parcelas')
    .update(values)
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function getTransacoesByEmprestimo(emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('transacoes')
    .select('*')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', user.id)
    .order('data', { ascending: false })

  if (error) throw error
  return data as Transacao[]
}

export async function deletarTransacao(transacaoId: string, emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()

  const { data: trx } = await supabase
    .from('transacoes')
    .select('*')
    .eq('id', transacaoId)
    .eq('user_id', user.id)
    .single()

  if (!trx) throw new Error('Transação não encontrada')

  if (trx.parcela_id) {
    if (trx.tipo === 'principal_recebido') {
      const { data: remaining } = await supabase
        .from('transacoes')
        .select('valor')
        .eq('parcela_id', trx.parcela_id)
        .eq('tipo', 'principal_recebido')
        .neq('id', transacaoId)
        .eq('user_id', user.id)

      const novoTotal = (remaining ?? []).reduce((acc, t) => acc + (t.valor as number), 0)

      if (novoTotal <= 0) {
        await supabase
          .from('parcelas')
          .update({ valor_pago: null, status: 'pendente', data_pagamento: null })
          .eq('id', trx.parcela_id)
          .eq('user_id', user.id)
      } else {
        const { data: parcela } = await supabase
          .from('parcelas')
          .select('valor_esperado')
          .eq('id', trx.parcela_id)
          .eq('user_id', user.id)
          .single()

        const novoStatus = parcela && novoTotal >= parcela.valor_esperado ? 'pago' : 'pendente'
        await supabase
          .from('parcelas')
          .update({ valor_pago: novoTotal, status: novoStatus })
          .eq('id', trx.parcela_id)
          .eq('user_id', user.id)
      }
    } else if (trx.tipo === 'juros_recebido') {
      await supabase
        .from('parcelas')
        .update({ valor_pago: null, status: 'pendente', data_pagamento: null })
        .eq('id', trx.parcela_id)
        .eq('user_id', user.id)
    }
  }

  const { error } = await supabase
    .from('transacoes')
    .delete()
    .eq('id', transacaoId)
    .eq('user_id', user.id)

  if (error) throw error

  const { data: parcelasAbertas } = await supabase
    .from('parcelas')
    .select('id')
    .eq('emprestimo_id', emprestimoId)
    .eq('user_id', user.id)
    .in('status', ['pendente', 'atrasado'])
    .limit(1)

  if (parcelasAbertas && parcelasAbertas.length > 0) {
    await supabase
      .from('emprestimos')
      .update({ status: 'ativo' })
      .eq('id', emprestimoId)
      .eq('user_id', user.id)
      .eq('status', 'quitado')
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function editarTransacao(
  transacaoId: string,
  emprestimoId: string,
  values: {
    valor: number
    data: string
    forma_pagamento?: string
    observacoes?: string
  }
) {
  const supabase = createClient()
  const user = await getUser()

  const { data: trx } = await supabase
    .from('transacoes')
    .select('tipo, parcela_id')
    .eq('id', transacaoId)
    .eq('user_id', user.id)
    .single()

  if (!trx) throw new Error('Transação não encontrada')

  const { error } = await supabase
    .from('transacoes')
    .update({
      valor: values.valor,
      data: values.data,
      forma_pagamento: values.forma_pagamento ?? null,
      observacoes: values.observacoes ?? null,
    })
    .eq('id', transacaoId)
    .eq('user_id', user.id)

  if (error) throw error

  if (trx.parcela_id && trx.tipo === 'principal_recebido') {
    const { data: todas } = await supabase
      .from('transacoes')
      .select('valor')
      .eq('parcela_id', trx.parcela_id)
      .eq('tipo', 'principal_recebido')
      .eq('user_id', user.id)

    const novoTotal = (todas ?? []).reduce((acc, t) => acc + (t.valor as number), 0)

    const { data: parcela } = await supabase
      .from('parcelas')
      .select('valor_esperado')
      .eq('id', trx.parcela_id)
      .eq('user_id', user.id)
      .single()

    if (parcela) {
      const novoStatus = novoTotal >= parcela.valor_esperado ? 'pago' : 'pendente'
      await supabase
        .from('parcelas')
        .update({ valor_pago: novoTotal, status: novoStatus })
        .eq('id', trx.parcela_id)
        .eq('user_id', user.id)
    }
  }

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function deleteParcela(parcelaId: string, emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()
  const { error } = await supabase
    .from('parcelas')
    .delete()
    .eq('id', parcelaId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
}

export async function regenerarParcelasPendentes(emprestimoId: string) {
  const supabase = createClient()
  const user = await getUser()

  const { data: emp } = await supabase
    .from('emprestimos')
    .select('*')
    .eq('id', emprestimoId)
    .eq('user_id', user.id)
    .single()

  if (!emp) throw new Error('Empréstimo não encontrado')

  await sincronizarCronograma(emprestimoId, user.id, {
    valor_principal: emp.valor_principal,
    taxa_juros_mensal: emp.taxa_juros_mensal,
    data_inicio: emp.data_inicio,
    data_vencimento: emp.data_vencimento,
    modalidade: emp.modalidade,
  })

  revalidatePath(`/emprestimos/${emprestimoId}`)
  revalidatePath('/parcelas')
  revalidatePath('/dashboard')
}

export async function sincronizarStatusParcelas() {
  const supabase = createClient()
  const user = await getUser()
  const hoje = new Date().toISOString().split('T')[0]

  const [vencidas, reagendadas] = await Promise.all([
    supabase
      .from('parcelas')
      .update({ status: 'atrasado' })
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .lt('data_vencimento', hoje),
    // Simétrico: vencimento empurrado para frente tira a parcela do atraso.
    supabase
      .from('parcelas')
      .update({ status: 'pendente' })
      .eq('user_id', user.id)
      .eq('status', 'atrasado')
      .gte('data_vencimento', hoje),
  ])

  if (vencidas.error) throw vencidas.error
  if (reagendadas.error) throw reagendadas.error

  revalidatePath('/dashboard')
  revalidatePath('/parcelas')
  revalidatePath('/emprestimos')
}
