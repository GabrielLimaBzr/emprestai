-- emprestAI — schema inicial
-- Execute este arquivo no SQL Editor do Supabase

-- =============================================
-- TABELAS
-- =============================================

CREATE TABLE tomadores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  telefone      TEXT,
  email         TEXT,
  cpf           TEXT,
  eh_familiar   BOOLEAN DEFAULT FALSE,
  observacoes   TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emprestimos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tomador_id          UUID REFERENCES tomadores(id) ON DELETE RESTRICT,
  valor_principal     NUMERIC(12,2) NOT NULL,
  taxa_juros_mensal   NUMERIC(5,4) NOT NULL DEFAULT 0,
  data_inicio         DATE NOT NULL,
  data_vencimento     DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo', 'quitado', 'inadimplente', 'renegociado')),
  modalidade          TEXT NOT NULL DEFAULT 'juros_mensais'
                      CHECK (modalidade IN ('juros_mensais', 'sem_juros')),
  descricao           TEXT,
  garantia            TEXT,
  criado_em           TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE parcelas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emprestimo_id   UUID REFERENCES emprestimos(id) ON DELETE CASCADE,
  numero          INTEGER NOT NULL,
  tipo            TEXT NOT NULL
                  CHECK (tipo IN ('juros', 'principal')),
  valor_esperado  NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  valor_pago      NUMERIC(12,2),
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'pago', 'atrasado', 'isento')),
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emprestimo_id   UUID REFERENCES emprestimos(id) ON DELETE CASCADE,
  parcela_id      UUID REFERENCES parcelas(id),
  tipo            TEXT NOT NULL
                  CHECK (tipo IN ('juros_recebido', 'principal_recebido', 'estorno')),
  valor           NUMERIC(12,2) NOT NULL,
  data            DATE NOT NULL,
  forma_pagamento TEXT,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE tomadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_tomadores" ON tomadores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_emprestimos" ON emprestimos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_parcelas" ON parcelas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_transacoes" ON transacoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX idx_emprestimos_tomador ON emprestimos(tomador_id);
CREATE INDEX idx_emprestimos_status ON emprestimos(status);
CREATE INDEX idx_parcelas_emprestimo ON parcelas(emprestimo_id);
CREATE INDEX idx_parcelas_vencimento ON parcelas(data_vencimento);
CREATE INDEX idx_parcelas_status ON parcelas(status);
CREATE INDEX idx_transacoes_emprestimo ON transacoes(emprestimo_id);
CREATE INDEX idx_transacoes_data ON transacoes(data);

-- =============================================
-- TRIGGERS — updated_at automático
-- =============================================

CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tomadores_updated
  BEFORE UPDATE ON tomadores
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER trg_emprestimos_updated
  BEFORE UPDATE ON emprestimos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- =============================================
-- VIEW — resumo por empréstimo
-- =============================================

CREATE OR REPLACE VIEW vw_emprestimos_resumo AS
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
