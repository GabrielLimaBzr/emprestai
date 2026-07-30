-- Adiciona token público único por empréstimo para compartilhar extrato
-- sem expor o ID interno nem exigir login do cliente.

ALTER TABLE emprestimos
  ADD COLUMN IF NOT EXISTS token_extrato UUID NOT NULL DEFAULT gen_random_uuid();

-- Índice para busca rápida por token
CREATE UNIQUE INDEX IF NOT EXISTS emprestimos_token_extrato_idx ON emprestimos (token_extrato);
