-- Adiciona modalidade 'parcelado' (parcelas fixas com ou sem juros - Tabela Price)
ALTER TABLE emprestimos
  DROP CONSTRAINT IF EXISTS emprestimos_modalidade_check;

ALTER TABLE emprestimos
  ADD CONSTRAINT emprestimos_modalidade_check
  CHECK (modalidade IN ('juros_mensais', 'sem_juros', 'parcelado'));
