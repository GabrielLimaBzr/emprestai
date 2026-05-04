# emprestAI — Product Requirements Document (MVP)

> Documento de especificação completo para construção do MVP do app **emprestAI** — sistema de gestão de empréstimos pessoais.
> Este documento serve como base para a IA (Claude/Cursor/etc.) construir o projeto completo.

---

## 1. Visão Geral

**emprestAI** é uma aplicação web para gerenciamento de empréstimos pessoais feitos pelo próprio usuário (credor). O sistema permite acompanhar saldo devedor, pagamentos de juros mensais, status de cada contrato e gerar alertas de vencimentos.

### Modelo de negócio dos empréstimos

O credor (usuário) empresta um valor principal a tomadores. O modelo funciona assim:

- **O tomador paga juros mensais fixos** (calculado sobre o principal) todos os meses
- **O principal é devolvido integralmente no vencimento** do contrato
- **Não há amortização mensal** — cada parcela mensal é 100% juros
- **Taxa de juros**: definida por contrato (ex: 5% a.m.)
- Empréstimos para **familiares** podem ter taxa 0% (sem juros)

---

## 2. Stack Tecnológica

### Frontend
- **Framework**: Vue 3 + Vite
- **Estado global**: Pinia
- **UI**: PrimeVue + TailwindCSS
- **Roteamento**: Vue Router
- **Charts**: Chart.js ou ApexCharts
- **Ícones**: Lucide Vue ou Heroicons

### Backend / Persistência
- **Supabase** (free tier — 500 MB, auth incluso)
  - PostgreSQL como banco de dados
  - Supabase Auth para autenticação (login único do dono)
  - Row Level Security (RLS) habilitado
  - Realtime opcional

### Deploy
- **Frontend**: Vercel (free) ou Netlify (free)
- **Backend**: Supabase Cloud (free tier)

### Outros
- `.env` para variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

---

## 3. Estrutura do Repositório

```
emprestai/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppHeader.vue
│   │   │   ├── AppSidebar.vue
│   │   │   ├── StatCard.vue
│   │   │   ├── EmptyState.vue
│   │   │   └── ConfirmDialog.vue
│   │   ├── emprestimos/
│   │   │   ├── EmprestimoCard.vue
│   │   │   ├── EmprestimoForm.vue
│   │   │   ├── EmprestimoTable.vue
│   │   │   └── EmprestimoTimeline.vue
│   │   ├── pagamentos/
│   │   │   ├── PagamentoForm.vue
│   │   │   ├── PagamentoList.vue
│   │   │   └── PagamentoStatusBadge.vue
│   │   ├── tomadores/
│   │   │   ├── TomadorCard.vue
│   │   │   └── TomadorForm.vue
│   │   └── dashboard/
│   │       ├── ResumoPatrimonio.vue
│   │       ├── ProximosVencimentos.vue
│   │       ├── GraficoFluxo.vue
│   │       └── AlertasInadimplencia.vue
│   ├── pages/
│   │   ├── Dashboard.vue
│   │   ├── Emprestimos.vue
│   │   ├── EmprestimoDetalhe.vue
│   │   ├── Tomadores.vue
│   │   ├── TomadorDetalhe.vue
│   │   ├── Pagamentos.vue
│   │   ├── Relatorios.vue
│   │   └── Login.vue
│   ├── stores/
│   │   ├── auth.store.js
│   │   ├── emprestimos.store.js
│   │   ├── pagamentos.store.js
│   │   └── tomadores.store.js
│   ├── services/
│   │   ├── supabase.js           # cliente Supabase inicializado
│   │   ├── emprestimos.service.js
│   │   ├── pagamentos.service.js
│   │   └── tomadores.service.js
│   ├── utils/
│   │   ├── currency.js           # formatação BRL/USD
│   │   ├── date.js               # helpers de data
│   │   ├── juros.js              # cálculos financeiros
│   │   └── validators.js
│   ├── router/
│   │   └── index.js
│   ├── App.vue
│   └── main.js
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                  # dados iniciais opcionais
├── .env.example
├── .gitignore
├── vite.config.js
├── tailwind.config.js
├── package.json
└── README.md
```

---

## 4. Banco de Dados (Supabase / PostgreSQL)

### 4.1 Tabelas

#### `tomadores`
```sql
CREATE TABLE tomadores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  email       TEXT,
  cpf         TEXT,
  eh_familiar BOOLEAN DEFAULT FALSE,  -- se true, juros podem ser 0%
  observacoes TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
```

#### `emprestimos`
```sql
CREATE TABLE emprestimos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tomador_id       UUID REFERENCES tomadores(id) ON DELETE RESTRICT,
  valor_principal  NUMERIC(12,2) NOT NULL,
  taxa_juros_mensal NUMERIC(5,4) NOT NULL DEFAULT 0, -- ex: 0.05 = 5% a.m.
  data_inicio      DATE NOT NULL,
  data_vencimento  DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'quitado', 'inadimplente', 'renegociado')),
  modalidade       TEXT NOT NULL DEFAULT 'juros_mensais'
                   CHECK (modalidade IN ('juros_mensais', 'sem_juros')),
  -- juros_mensais: tomador paga juros todo mês + principal no fim
  -- sem_juros: familiar, sem cobrança
  descricao        TEXT,
  garantia         TEXT,          -- ex: "cheque pré-datado", "nota promissória"
  criado_em        TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);
```

#### `parcelas`
> Geradas automaticamente ao criar o empréstimo (uma por mês de duração).

```sql
CREATE TABLE parcelas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emprestimo_id   UUID REFERENCES emprestimos(id) ON DELETE CASCADE,
  numero          INTEGER NOT NULL,         -- 1, 2, 3...
  tipo            TEXT NOT NULL
                  CHECK (tipo IN ('juros', 'principal')),
  -- tipo juros: parcelas mensais de juros
  -- tipo principal: última parcela = devolução do capital
  valor_esperado  NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,                     -- NULL = não pago ainda
  valor_pago      NUMERIC(12,2),
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'pago', 'atrasado', 'isento')),
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);
```

#### `transacoes`
> Log imutável de cada pagamento recebido.

```sql
CREATE TABLE transacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emprestimo_id   UUID REFERENCES emprestimos(id) ON DELETE CASCADE,
  parcela_id      UUID REFERENCES parcelas(id),
  tipo            TEXT NOT NULL
                  CHECK (tipo IN ('juros_recebido', 'principal_recebido', 'estorno')),
  valor           NUMERIC(12,2) NOT NULL,
  data            DATE NOT NULL,
  forma_pagamento TEXT,                     -- ex: "pix", "dinheiro", "transferência"
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 RLS (Row Level Security)

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE tomadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário só vê seus próprios dados
CREATE POLICY "users_own_data" ON tomadores
  USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON emprestimos
  USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON parcelas
  USING (auth.uid() = user_id);

CREATE POLICY "users_own_data" ON transacoes
  USING (auth.uid() = user_id);
```

### 4.3 Views úteis (opcional)

```sql
-- Situação consolidada por empréstimo
CREATE VIEW vw_emprestimos_resumo AS
SELECT
  e.id,
  t.nome AS tomador,
  e.valor_principal,
  e.taxa_juros_mensal,
  e.data_vencimento,
  e.status,
  COUNT(p.id) FILTER (WHERE p.tipo = 'juros' AND p.status = 'pendente') AS juros_pendentes,
  SUM(p.valor_esperado) FILTER (WHERE p.tipo = 'juros' AND p.status = 'pendente') AS valor_juros_pendente,
  COALESCE(SUM(tr.valor), 0) AS total_recebido
FROM emprestimos e
JOIN tomadores t ON t.id = e.tomador_id
LEFT JOIN parcelas p ON p.emprestimo_id = e.id
LEFT JOIN transacoes tr ON tr.emprestimo_id = e.id AND tr.tipo != 'estorno'
GROUP BY e.id, t.nome;
```

---

## 5. Funcionalidades do MVP

### 5.1 Autenticação
- Login com email/senha via Supabase Auth
- Sem cadastro público — apenas o dono do sistema acessa
- Sessão persistida com localStorage
- Redirecionamento automático para `/login` se não autenticado

### 5.2 Dashboard (página inicial)

**Cards de resumo:**
- 💰 Capital total emprestado (soma dos principals ativos)
- 📈 Juros recebidos no mês atual
- 📅 Juros a receber nos próximos 30 dias
- ⚠️ Contratos em atraso (inadimplentes)
- 📊 Rentabilidade média da carteira de empréstimos (% a.m.)

**Componentes:**
- Lista de **próximos vencimentos** (parcelas de juros dos próximos 7 dias)
- **Alertas de inadimplência** (parcelas atrasadas há mais de X dias)
- Gráfico de **fluxo de caixa mensal** (juros recebidos vs esperados, últimos 6 meses)
- Gráfico de **distribuição por tomador** (pie chart — % do capital por pessoa)

### 5.3 Gestão de Tomadores

**Listagem:**
- Tabela com: nome, telefone, quantidade de empréstimos ativos, total emprestado, status geral
- Filtros: ativos/inativos, familiares/não-familiares
- Busca por nome

**Cadastro/Edição:**
- Campos: nome*, telefone, email, CPF, é familiar (toggle), observações
- Validação de CPF opcional

**Detalhe do tomador:**
- Todos os empréstimos do tomador (ativos e históricos)
- Total emprestado, total recebido, saldo pendente
- Timeline de pagamentos

### 5.4 Gestão de Empréstimos

**Listagem:**
- Tabela com: tomador, valor principal, taxa, vencimento, status, próximo vencimento de juros
- Filtros: status (ativo/quitado/inadimplente), tomador, período
- Ordenação por: vencimento, valor, tomador

**Criação de empréstimo:**

Formulário com:
- Tomador (dropdown buscável)
- Valor principal (R$)
- Taxa de juros mensal (% — se tomador for familiar, preenche 0% automaticamente)
- Data de início
- Data de vencimento (ou número de meses — calculado automaticamente)
- Modalidade: juros mensais / sem juros
- Descrição / finalidade
- Garantia (campo texto livre)

Ao confirmar:
1. Cria o registro de `emprestimos`
2. **Gera automaticamente todas as `parcelas`**:
   - N parcelas de `tipo: 'juros'` (uma por mês, valor = principal × taxa)
   - 1 parcela de `tipo: 'principal'` (na data de vencimento, valor = principal)
3. Exibe resumo das parcelas geradas antes de salvar

**Detalhe do empréstimo:**

- Informações do contrato
- Timeline completa de parcelas (passadas e futuras)
- Status de cada parcela com badge colorido
- Botão "Registrar pagamento" por parcela
- Total recebido / total esperado / rendimento atual
- Histórico de transações

**Ações disponíveis:**
- Marcar parcela como paga (com data e forma de pagamento)
- Registrar pagamento parcial
- Estornar pagamento
- Alterar status do contrato (ativo → inadimplente → quitado)
- Renegociar empréstimo (encerra atual, cria novo com novo valor/prazo)

### 5.5 Registro de Pagamentos

**Fluxo de registro de pagamento de juros:**
1. Usuário clica em "Registrar pagamento" na parcela
2. Modal abre com:
   - Valor esperado (pré-preenchido)
   - Valor pago (editável — pode ser diferente)
   - Data do pagamento (default: hoje)
   - Forma de pagamento: PIX, dinheiro, transferência, cheque
   - Observações
3. Sistema registra na tabela `transacoes` e atualiza `parcelas.status`
4. Se valor_pago < valor_esperado → status: `atrasado` (parcial)
5. Se valor_pago >= valor_esperado → status: `pago`

**Fluxo de quitação (recebimento do principal):**
- Similar ao acima, mas para a parcela do tipo `principal`
- Ao quitar o principal → empréstimo muda para status `quitado`

### 5.6 Relatórios

- **Extrato mensal**: todos os recebimentos de um mês específico, por categoria (juros/principal)
- **Rentabilidade da carteira**: % médio mensal dos contratos ativos
- **Projeção de recebimentos**: juros esperados para os próximos 3/6/12 meses (baseado em contratos ativos)
- **Histórico por tomador**: todo o histórico financeiro de um tomador
- **Inadimplência**: contratos com parcelas em atraso, dias de atraso, valor em risco

---

## 6. Regras de Negócio

### 6.1 Cálculo de juros

```
juros_mensal = valor_principal × taxa_juros_mensal
```

Exemplo:
- Principal: R$ 5.000
- Taxa: 5% a.m. (0.05)
- Juros mensais: R$ 250,00 por mês

### 6.2 Geração de parcelas

Ao criar um empréstimo com início em `2024-01-01` e vencimento em `2024-06-01` (5 meses):

| # | Tipo | Data | Valor |
|---|------|------|-------|
| 1 | juros | 2024-02-01 | R$ 250 |
| 2 | juros | 2024-03-01 | R$ 250 |
| 3 | juros | 2024-04-01 | R$ 250 |
| 4 | juros | 2024-05-01 | R$ 250 |
| 5 | juros | 2024-06-01 | R$ 250 |
| 6 | principal | 2024-06-01 | R$ 5.000 |

> Observação: A parcela de juros do último mês e a parcela do principal têm a mesma data.

### 6.3 Status de parcelas

| Status | Condição |
|--------|----------|
| `pendente` | data_vencimento >= hoje e não pago |
| `atrasado` | data_vencimento < hoje e não pago |
| `pago` | valor_pago registrado |
| `isento` | empréstimos a familiar com taxa 0% |

### 6.4 Status do empréstimo

| Status | Condição |
|--------|----------|
| `ativo` | em andamento, em dia |
| `inadimplente` | possui parcelas atrasadas há mais de 30 dias |
| `quitado` | parcela do principal foi recebida |
| `renegociado` | encerrado para criar novo contrato |

### 6.5 Inadimplência

- Parcela passa de `pendente` para `atrasado` automaticamente após a data de vencimento
- Empréstimo passa para `inadimplente` se houver parcela com >30 dias de atraso
- Sistema não bloqueia nenhuma ação — usuário tem controle total

---

## 7. Design e UX

### Identidade Visual
- **Nome**: emprestAI
- **Tom**: profissional, financeiro, limpo — não deve parecer app de banco, mas sim ferramenta pessoal de controle
- **Paleta sugerida**: tons escuros com acento verde/teal (remete a dinheiro/crescimento)
- **Tipografia**: display moderna, corpo legível

### Layout Geral
- Sidebar fixa à esquerda (desktop) / bottom nav (mobile)
- Header com nome do usuário e logout
- Conteúdo central com máximo de 1200px

### Navegação (Sidebar)
```
📊 Dashboard
💸 Empréstimos
👥 Tomadores
📅 Parcelas
📈 Relatórios
⚙️  Configurações
```

### Cores de status
- Verde: `pago`, `quitado`
- Amarelo/laranja: `pendente`, `ativo`
- Vermelho: `atrasado`, `inadimplente`
- Cinza: `isento`, `renegociado`

---

## 8. Configurações do usuário

- Taxa padrão de juros (pré-preenchida nos novos contratos)
- Dia padrão de vencimento das parcelas (ex: todo dia 10)
- Alertas: quantos dias antes do vencimento notificar (visual)
- Moeda padrão (BRL — fixo no MVP)

---

## 9. Variáveis de Ambiente

```env
# .env.example
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 10. Setup inicial do Supabase

### Passo a passo

1. Criar projeto em [supabase.com](https://supabase.com) (free tier)
2. Copiar `Project URL` e `anon key` para `.env`
3. Executar o arquivo `supabase/migrations/001_initial_schema.sql` no SQL Editor do Supabase
4. Habilitar autenticação por email/senha em **Authentication → Providers**
5. Criar o primeiro usuário manualmente em **Authentication → Users → Add user**
6. Rodar o projeto: `npm run dev`

---

## 11. Scripts de desenvolvimento

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .vue,.js",
    "format": "prettier --write src/"
  }
}
```

---

## 12. Dependências principais

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "@supabase/supabase-js": "^2.43.0",
    "primevue": "^4.0.0",
    "@primevue/themes": "^4.0.0",
    "primeicons": "^7.0.0",
    "apexcharts": "^3.49.0",
    "vue3-apexcharts": "^1.4.0",
    "lucide-vue-next": "^0.378.0",
    "dayjs": "^1.11.11",
    "vee-validate": "^4.12.0",
    "yup": "^1.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "eslint": "^9.0.0",
    "prettier": "^3.2.0"
  }
}
```

---

## 13. Fora do escopo do MVP (futuro)

- Notificações por WhatsApp/email (via Resend ou Twilio)
- Contrato PDF gerado automaticamente
- Assinatura digital do tomador
- Multi-usuário (ex: cônjuge)
- Exportação para Excel/CSV
- App mobile nativo
- Integração com carteira de investimentos (emprestAI ↔ carteira.html)
- Cobrança automática via Open Banking

---

## 14. Considerações de Segurança

- RLS habilitado em todas as tabelas — usuário nunca vê dados de outros
- Nunca expor a `service_role` key no frontend
- Usar apenas a `anon key` com RLS
- CPF de tomadores: armazenar mascarado ou criptografado (opcional no MVP)
- HTTPS obrigatório (Vercel/Netlify garantem isso)

---

## 15. Checklist de entrega do MVP

### Infraestrutura
- [ ] Projeto Supabase criado e configurado
- [ ] Schema SQL executado com sucesso
- [ ] RLS configurado e testado
- [ ] Deploy frontend no Vercel/Netlify
- [ ] Variáveis de ambiente configuradas no deploy

### Funcionalidades
- [ ] Login/logout funcionando
- [ ] CRUD completo de tomadores
- [ ] Criação de empréstimos com geração automática de parcelas
- [ ] Visualização de parcelas por empréstimo
- [ ] Registro de pagamento (juros e principal)
- [ ] Dashboard com cards e gráficos
- [ ] Alertas de vencimento próximo e inadimplência
- [ ] Relatório de fluxo mensal
- [ ] Projeção de recebimentos futuros

### Qualidade
- [ ] Responsivo (mobile e desktop)
- [ ] Estados vazios (empty states) implementados
- [ ] Loading states em todas as queries
- [ ] Tratamento de erros com feedback ao usuário
- [ ] Confirmação antes de ações destrutivas

---

*Documento gerado para o projeto emprestAI — versão MVP*
*Última atualização: Maio 2026*
