export type StatusEmprestimo = 'ativo' | 'quitado' | 'inadimplente' | 'renegociado'
export type ModalidadeEmprestimo = 'juros_mensais' | 'sem_juros' | 'parcelado'
export type StatusParcela = 'pendente' | 'pago' | 'atrasado' | 'isento'
export type TipoParcela = 'juros' | 'principal'
export type TipoTransacao = 'juros_recebido' | 'principal_recebido' | 'estorno'
export type FormaPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'cheque'

export interface Tomador {
  id: string
  user_id: string
  nome: string
  telefone: string | null
  email: string | null
  cpf: string | null
  eh_familiar: boolean
  observacoes: string | null
  criado_em: string
  atualizado_em: string
}

export interface Emprestimo {
  id: string
  user_id: string
  tomador_id: string
  valor_principal: number
  taxa_juros_mensal: number
  data_inicio: string
  data_vencimento: string
  status: StatusEmprestimo
  modalidade: ModalidadeEmprestimo
  descricao: string | null
  garantia: string | null
  token_extrato: string
  criado_em: string
  atualizado_em: string
  tomador?: Tomador
}

export interface Parcela {
  id: string
  user_id: string
  emprestimo_id: string
  numero: number
  tipo: TipoParcela
  valor_esperado: number
  data_vencimento: string
  data_pagamento: string | null
  valor_pago: number | null
  status: StatusParcela
  observacoes: string | null
  criado_em: string
}

export interface Transacao {
  id: string
  user_id: string
  emprestimo_id: string
  parcela_id: string | null
  tipo: TipoTransacao
  valor: number
  data: string
  forma_pagamento: string | null
  observacoes: string | null
  criado_em: string
}

export interface EmprestimoResumo {
  id: string
  user_id: string
  tomador: string
  tomador_id: string
  valor_principal: number
  taxa_juros_mensal: number
  data_inicio: string
  data_vencimento: string
  status: StatusEmprestimo
  modalidade: ModalidadeEmprestimo
  descricao: string | null
  garantia: string | null
  juros_pendentes: number
  valor_juros_pendente: number
  total_recebido: number
  parcelas_atrasadas: number
}

export interface DashboardStats {
  /** Principal ainda na rua — já descontado o que voltou. */
  capitalEmAberto: number
  /** Principal devolvido, em regime de caixa (inclui amortizações avulsas). */
  principalDevolvido: number
  jurosRecebidosMes: number
  jurosAReceberProximos30: number
  contratosInadimplentes: number
  rentabilidadeMedia: number
}

export interface FormPagamento {
  valor_pago: number
  data_pagamento: string
  forma_pagamento: FormaPagamento
  observacoes?: string
}
