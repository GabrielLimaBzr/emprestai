/**
 * Monta links wa.me a partir do telefone cadastrado do tomador.
 * O campo é livre — aceita "(11) 99999-9999", "11999999999", etc. — então
 * precisa ser normalizado antes de virar URL.
 */

export function normalizarTelefone(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')

  // DDD + 8 (fixo) ou DDD + 9 (celular): falta o código do país.
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`

  // Já veio com código do país (55 + 10/11) ou é um número estrangeiro.
  if (digitos.length === 12 || digitos.length === 13) return digitos

  return null
}

export function linkWhatsApp(
  telefone: string | null | undefined,
  mensagem: string
): string | null {
  const numero = normalizarTelefone(telefone)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0]
}

export function mensagemExtrato(nome: string, urlExtrato: string): string {
  return `Olá, ${primeiroNome(nome)}! Segue o extrato atualizado do seu empréstimo:\n\n${urlExtrato}`
}

export function mensagemCobranca(
  nome: string,
  valor: string,
  vencimento: string,
  urlExtrato: string
): string {
  return (
    `Olá, ${primeiroNome(nome)}! Passando para lembrar da parcela de ${valor}, ` +
    `que venceu em ${vencimento}.\n\n` +
    `Se já tiver pago, pode desconsiderar esta mensagem. ` +
    `O extrato atualizado está sempre aqui:\n\n${urlExtrato}`
  )
}
