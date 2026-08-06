-- Passa a devolver, em cada parcela, os pagamentos que a compõem.
-- Serve para o extrato detalhar quando e quanto entrou na parcela do
-- principal, que costuma ser quitada em várias parcelas ao longo do tempo.
--
-- Estornos ficam de fora: o saldo da parcela já reflete a reversão, e listar
-- a entrada e o estorno lado a lado só confunde quem lê o extrato.

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
           'status',          p.status,
           'pagamentos', COALESCE(
             (SELECT json_agg(
                json_build_object(
                  'id',              tr.id,
                  'valor',           tr.valor,
                  'data',            tr.data,
                  'forma_pagamento', tr.forma_pagamento
                ) ORDER BY tr.data, tr.criado_em
              )
              FROM transacoes tr
              WHERE tr.parcela_id = p.id
                AND tr.tipo <> 'estorno'),
             '[]'::json
           )
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

GRANT EXECUTE ON FUNCTION get_extrato_by_token(UUID) TO anon;
