import { createClient } from '@supabase/supabase-js'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { notFound } from 'next/navigation'

interface ParcelaExtrato {
  id: string
  numero: number
  tipo: 'juros' | 'principal'
  valor_esperado: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'atrasado' | 'isento'
}

interface ExtratoData {
  tomador_nome: string
  valor_principal: number
  taxa_juros_mensal: number
  data_inicio: string
  data_vencimento: string
  status: string
  modalidade: string
  descricao: string | null
  garantia: string | null
  parcelas: ParcelaExtrato[]
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago:         { label: 'Pago',         cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    pendente:     { label: 'Pendente',     cls: 'bg-blue-500/10   text-blue-400   border-blue-500/20' },
    atrasado:     { label: 'Atrasado',     cls: 'bg-red-500/15    text-red-400    border-red-500/30' },
    isento:       { label: 'Isento',       cls: 'bg-zinc-500/15   text-zinc-400   border-zinc-500/30' },
    ativo:        { label: 'Ativo',        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    quitado:      { label: 'Quitado',      cls: 'bg-blue-500/10   text-blue-400   border-blue-500/20' },
    inadimplente: { label: 'Inadimplente', cls: 'bg-red-500/15    text-red-400    border-red-500/30' },
    renegociado:  { label: 'Renegociado',  cls: 'bg-amber-500/15  text-amber-400  border-amber-500/30' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export default async function ExtratoPage({ params }: { params: { token: string } }) {
  // Cliente público (anon key) — a função RPC usa SECURITY DEFINER,
  // então acessa os dados sem precisar de autenticação.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase
    .rpc('get_extrato_by_token', { p_token: params.token })

  if (error || !data) notFound()

  const ext = data as ExtratoData
  const lista = ext.parcelas ?? []

  const totalParcelas = lista.length
  const pagas         = lista.filter(p => p.status === 'pago').length
  const atrasadas     = lista.filter(p => p.status === 'atrasado').length
  const totalPago     = lista.reduce((s, p) => s + (p.valor_pago ?? 0), 0)
  const proximaAberta = lista.find(p => p.status === 'pendente' || p.status === 'atrasado')

  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Cabeçalho */}
      <div className="border-b border-border/60 bg-card px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="text-base font-bold tracking-tight">EmprestAI</span>
          <span className="text-xs text-muted-foreground">Extrato de empréstimo</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        {/* Identidade */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tomador</p>
              <p className="text-lg font-bold break-words">{ext.tomador_nome}</p>
            </div>
            <StatusBadge status={ext.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-xs text-muted-foreground">Principal</p>
              <p className="font-semibold tabular-nums">{formatCurrency(ext.valor_principal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa mensal</p>
              <p className="font-semibold">{(ext.taxa_juros_mensal * 100).toFixed(2)}% a.m.</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Início</p>
              <p className="font-semibold">{formatDate(ext.data_inicio)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-semibold">{formatDate(ext.data_vencimento)}</p>
            </div>
          </div>

          {ext.descricao && (
            <p className="text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2">
              {ext.descricao}
            </p>
          )}
        </div>

        {/* Resumo numérico */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total pago',     value: formatCurrency(totalPago),  color: 'text-emerald-400' },
            { label: 'Pagas',          value: `${pagas}/${totalParcelas}`, color: '' },
            { label: 'Em atraso',      value: String(atrasadas),           color: atrasadas > 0 ? 'text-red-400' : '' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`font-bold mt-0.5 tabular-nums text-sm ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {proximaAberta && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Próximo vencimento</p>
              <p className="font-semibold">{formatDate(proximaAberta.data_vencimento)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-bold tabular-nums text-primary">{formatCurrency(proximaAberta.valor_esperado)}</p>
            </div>
          </div>
        )}

        {/* Lista de parcelas */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <p className="text-sm font-semibold">Parcelas ({totalParcelas})</p>
          </div>
          <div className="divide-y divide-border/60">
            {lista.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      #{p.numero} — {p.tipo === 'juros' ? 'Juros' : 'Principal'}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Venc. {formatDate(p.data_vencimento)}
                    {p.data_pagamento && ` · Pago em ${formatDate(p.data_pagamento)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums">
                    {p.valor_pago != null
                      ? formatCurrency(p.valor_pago)
                      : p.status === 'isento'
                      ? 'Isento'
                      : formatCurrency(p.valor_esperado)}
                  </p>
                  {p.valor_pago != null && p.valor_pago !== p.valor_esperado && (
                    <p className="text-xs text-muted-foreground">Esp: {formatCurrency(p.valor_esperado)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Gerado em {hoje} · EmprestAI
        </p>
      </div>
    </div>
  )
}
