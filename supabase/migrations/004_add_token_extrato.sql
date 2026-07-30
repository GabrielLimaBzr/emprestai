-- Adiciona token público único por empréstimo para compartilhar extrato
-- sem expor o ID interno nem exigir login do cliente.

ALTER TABLE emprestimos
  ADD COLUMN IF NOT EXISTS token_extrato UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS emprestimos_token_extrato_idx ON emprestimos (token_extrato);

-- Função RPC pública que retorna os dados do extrato pelo token único.
-- SECURITY DEFINER: executa com privilégios do owner, bypassando RLS.
-- Seguro: só expõe dados do empréstimo com exatamente esse token UUID.
CREATE OR REPLACE FUNCTION get_extrato_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'tomador_nome',        t.nome,
    'valor_principal',     e.valor_principal,
    'taxa_juros_mensal',   e.taxa_juros_mensal,
    'data_inicio',         e.data_inicio,
    'data_vencimento',     e.data_vencimento,
    'status',              e.status,
    'modalidade',          e.modalidade,
    'descricao',           e.descricao,
    'garantia',            e.garantia,
    'parcelas', COALESCE(
      (SELECT json_agg(
         json_build_object(
           'id',              p.id,
           'numero',          p.numero,
           'tipo',            p.tipo,
           'valor_esperado',  p.valor_esperado,
           'valor_pago',      p.valor_pago,
           'data_vencimento', p.data_vencimento,
           'data_pagamento',  p.data_pagamento,
           'status',          p.status
         ) ORDER BY p.numero
       )
       FROM parcelas p
       WHERE p.emprestimo_id = e.id),
      '[]'::json
    )
  )
  INTO v_result
  FROM emprestimos e
  JOIN tomadores t ON t.id = e.tomador_id
  WHERE e.token_extrato = p_token;

  RETURN v_result;
END;
$$;

-- Libera execução da função para o role anon (usuários sem login)
GRANT EXECUTE ON FUNCTION get_extrato_by_token(UUID) TO anon;
