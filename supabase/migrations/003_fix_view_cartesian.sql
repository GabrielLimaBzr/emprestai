-- Correção: produto cartesiano entre parcelas e transacoes no JOIN duplo.
-- O JOIN paralelo de duas tabelas sem pré-agregação multiplica as contagens:
-- ex: 2 parcelas atrasadas × 4 transações = 8 (errado, correto seria 2).
-- Solução: agregar cada tabela em subquery antes do JOIN principal.
-- Usamos DROP + CREATE para evitar restrição de reordenação de colunas
-- do CREATE OR REPLACE VIEW.

DROP VIEW IF EXISTS vw_emprestimos_resumo;

CREATE VIEW vw_emprestimos_resumo WITH (security_invoker = true) AS
SELECT
  e.id,
  e.user_id,
  t.nome          AS tomador,
  t.id            AS tomador_id,
  e.valor_principal,
  e.taxa_juros_mensal,
  e.data_inicio,
  e.data_vencimento,
  e.status,
  e.modalidade,
  e.descricao,
  e.garantia,
  COALESCE(pa.juros_pendentes,      0) AS juros_pendentes,
  COALESCE(pa.valor_juros_pendente, 0) AS valor_juros_pendente,
  COALESCE(tr.total_recebido,       0) AS total_recebido,
  COALESCE(pa.parcelas_atrasadas,   0) AS parcelas_atrasadas
FROM emprestimos e
JOIN tomadores t ON t.id = e.tomador_id
LEFT JOIN (
  SELECT
    emprestimo_id,
    COUNT(*) FILTER (WHERE tipo = 'juros' AND status = 'pendente')                           AS juros_pendentes,
    SUM(valor_esperado) FILTER (WHERE tipo = 'juros' AND status IN ('pendente', 'atrasado')) AS valor_juros_pendente,
    COUNT(*) FILTER (WHERE status = 'atrasado')                                              AS parcelas_atrasadas
  FROM parcelas
  GROUP BY emprestimo_id
) pa ON pa.emprestimo_id = e.id
LEFT JOIN (
  SELECT
    emprestimo_id,
    SUM(valor) FILTER (WHERE tipo != 'estorno') AS total_recebido
  FROM transacoes
  GROUP BY emprestimo_id
) tr ON tr.emprestimo_id = e.id;
