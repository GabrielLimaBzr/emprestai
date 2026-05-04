-- Correção crítica: a view precisa de security_invoker para respeitar o RLS
-- Execute no SQL Editor do Supabase

CREATE OR REPLACE VIEW vw_emprestimos_resumo WITH (security_invoker = true) AS
SELECT
  e.id,
  e.user_id,
  t.nome AS tomador,
  t.id AS tomador_id,
  e.valor_principal,
  e.taxa_juros_mensal,
  e.data_inicio,
  e.data_vencimento,
  e.status,
  e.modalidade,
  e.descricao,
  e.garantia,
  COUNT(p.id) FILTER (WHERE p.tipo = 'juros' AND p.status = 'pendente') AS juros_pendentes,
  COALESCE(SUM(p.valor_esperado) FILTER (WHERE p.tipo = 'juros' AND p.status IN ('pendente', 'atrasado')), 0) AS valor_juros_pendente,
  COALESCE(SUM(tr.valor) FILTER (WHERE tr.tipo != 'estorno'), 0) AS total_recebido,
  COUNT(p.id) FILTER (WHERE p.status = 'atrasado') AS parcelas_atrasadas
FROM emprestimos e
JOIN tomadores t ON t.id = e.tomador_id
LEFT JOIN parcelas p ON p.emprestimo_id = e.id
LEFT JOIN transacoes tr ON tr.emprestimo_id = e.id
GROUP BY e.id, t.nome, t.id;
