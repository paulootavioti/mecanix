# Plano de implementação — Mecanix Cloud

Derivado de `README.md` (handoff de design). Toda referência de seção abaixo aponta para ele.

## 1. Fases

Ordem fixada pelo README ("Como usar este pacote").

### Fase 1 — Fundação multi-tenant
Base sobre a qual todo o resto assenta. Sem UI de produto.
- Scaffold: Next.js 15 (App Router) + TypeScript + Tailwind v4 + Drizzle.
- Design tokens do README como CSS custom properties (`@theme`), literais.
- Postgres: papéis `mecanix_owner` (migrações) e `mecanix_app` (runtime, `NOBYPASSRLS`, não é dono das tabelas).
- Schema de domínio com `tenant_id` + `ENABLE`/`FORCE ROW LEVEL SECURITY` + policy `USING`/`WITH CHECK`.
- Camada de acesso: toda query roda dentro de transação com `set_config('app.tenant_id', $1, true)`.
- Identidade: login único, `tenant_users` com papel por tenant, troca de contexto auditada.
- Planos e limites (§Arquitetura multi-tenancy) + contadores de uso.
- Auditoria: acesso a ficha de cliente e impersonation.
- Seeds: 3 tenants, OS-8390..OS-8412, catálogo de kits/peças/serviços, 6 conjuntos de painel.
- Testes: isolamento cruzado, guarda de metadados (nenhuma tabela com `tenant_id` sem RLS forçada), limites de plano.

### Fase 2 — App da oficina
Ordem interna do README: pátio/OS → wizard → cadastros/estoque → financeiro/fiscal → relacionamento/integrações.
- Chrome (§2): sidebar 226px, header sticky, dropdown de troca de tenant, toast 2,8s.
- Pátio & OS (§4): kanban de 5 colunas, card de OS, KPIs.
- Detalhe da OS (§5): duas colunas, checklist, itens, timeline, botão único de avanço.
- Máquina de estados `aprovação → execução → peça → pronto → entregue`.
- Wizard de orçamento (§6): 4 passos, buscas reais com carregamento/erro, validações.
- Dashboard (§3), telas de módulo em tabela (§7), integrações (§8).

### Fase 3 — Portal do cliente
- Acesso escopado a `tenant_id` + documento (§10). Status, aprovação, chat, agendamento, histórico, NPS.
- Aprovar no portal move a OS para "Em execução" e escreve na timeline.

### Fase 4 — Painéis de setor
- Modo TV (§11), 6 setores, relógio ao vivo, atualização por polling.
- Públicos (sala de espera, pátio): placa mascarada `RQK7•22`, sem valores, sem nome completo.
- Internos (pista, estoque, vendas, administrativa): OS, técnico e valores liberados.

### Fase 5 — Console do provedor
- Planos, tabela de tenants, uso agregado, impersonation auditada (§9).

### Fase 6 — Landing page
- Seções 1–12 da §12, planos com alternador mensal/anual, formulário de trial.
- Envio cria lead + provisiona tenant de trial de 14 dias, validando slug.
- Acréscimos fora do protótipo: `<title>`/meta, Open Graph, JSON-LD de produto/preço, consentimento LGPD, analytics, política de privacidade.

## 2. Stack

O repositório estava vazio (apenas `README.md`), então a stack é escolhida — o próprio README recomenda "React + TypeScript com backend multi-tenant, ex.: Postgres com RLS".

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node 22 | disponível no ambiente |
| Framework | Next.js 15 App Router + React 19 + TypeScript | back-office, painéis e landing com SEO no mesmo runtime |
| Banco | PostgreSQL 14 | RLS é requisito não negociável; versão fixada pelo ambiente de destino |
| ORM | Drizzle | controle explícito da transação onde `app.tenant_id` é setado |
| Estilo | Tailwind v4 (`@theme`) | tokens do README literais, media/container queries |
| Sessão | própria, server-side (tabela `sessions`, cookie httpOnly) | login único em N tenants + impersonation auditável |
| Filas | pg-boss | fila fiscal por tenant sem infra extra |
| Testes | Vitest + Postgres real; Playwright nos fluxos | isolamento não se prova com mock |

## 3. Isolamento

1. `tenant_id` em toda tabela de domínio.
2. `ENABLE` + `FORCE ROW LEVEL SECURITY` em cada uma. Sem `FORCE`, o dono da tabela ignora a policy.
3. Runtime conecta como `mecanix_app`: `NOBYPASSRLS`, sem ownership, sem DDL. Migrações usam `mecanix_owner`.
4. Policy única por tabela:
   `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`
   `WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)`
5. Sem contexto setado, `current_setting(...,true)` devolve NULL e a comparação nunca é verdadeira: **0 linhas**. Falha fechado.
6. `set_config(..., true)` é `LOCAL` — morre com a transação, não vaza entre requisições no pool.
7. Cliente: `UNIQUE (tenant_id, cpf_cnpj)`. Nunca índice global em `cpf_cnpj`.
8. Fiscal: `UNIQUE (tenant_id, filial_id, modelo, serie)` em `series_fiscais`; número alocado com `SELECT ... FOR UPDATE` na linha da série.

Verificado empiricamente antes de fixar a arquitetura: sem contexto retorna 0 linhas; escrita cruzada viola `WITH CHECK`; o papel de runtime não consegue desligar RLS.

### Compatibilidade PostgreSQL 14

O alvo é PG14. Tudo que a arquitetura usa existe desde o PG13 (`gen_random_uuid()` nativo, `FORCE ROW LEVEL SECURITY`, `current_setting(..., true)`, `set_config(..., true)`).

Recursos proibidos no código (existem só em PG15+ e seriam aceitos por engano se validados em versão mais nova):

| Recurso | Introduzido | Substituto adotado |
|---|---|---|
| `CREATE VIEW ... WITH (security_invoker=true)` | 15 | nenhuma view sobre tabela com RLS; consulta direta ou função `SECURITY INVOKER` |
| `MERGE` | 15 | `INSERT ... ON CONFLICT DO UPDATE` |
| `UNIQUE NULLS NOT DISTINCT` | 15 | coluna `NOT NULL` com valor sentinela explícito |
| `any_value()` | 16 | `min()`/`max()` explícito |

Hardening específico do PG14: até o PG14, `PUBLIC` tem `CREATE` no schema `public` por padrão (removido no PG15). A primeira migração executa `REVOKE CREATE ON SCHEMA public FROM PUBLIC` — sem isso o papel de runtime poderia criar tabelas próprias, sem RLS, dentro do schema da aplicação.

Guardas: `docker-compose.yml` fixado em `postgres:14`; teste que falha se `current_setting('server_version_num')` for `< 140000`; verificação em CI que rejeita as construções da tabela acima nas migrações.

## 4. Modelo de dados

### Plataforma (sem `tenant_id`)
`users` · `sessions` · `plans` · `tenants` · `tenant_users` · `provider_admins` · `leads`

### Domínio (com `tenant_id` + RLS)
`filiais` · `clientes` · `veiculos` · `ordens_servico` · `os_itens` · `os_eventos` · `checklists` · `checklist_itens` · `orcamentos` · `orcamento_itens` · `kits` · `kit_itens` · `pecas` · `servicos` · `insumos` · `movimentos_estoque` · `cotacoes` · `fornecedores` · `seguradoras` · `lancamentos_financeiros` · `titulos` · `documentos_fiscais` · `series_fiscais` · `certificados` · `campanhas` · `agendamentos` · `mensagens_portal` · `pesquisas_satisfacao` · `integracoes_credenciais` · `assinaturas` · `uso_tenant` · `auditoria` · `trocas_contexto` · `portal_sessoes`

Chaves e restrições que carregam regra:
- `clientes`: `UNIQUE (tenant_id, cpf_cnpj)`
- `ordens_servico`: `UNIQUE (tenant_id, numero)`
- `series_fiscais`: `UNIQUE (tenant_id, filial_id, modelo, serie)`
- `integracoes_credenciais`: `UNIQUE (tenant_id, provedor)`, segredo cifrado
- `tenant_users`: `UNIQUE (user_id, tenant_id)`, papel ∈ gerente/financeiro/consultor/tecnico

## 5. Rotas

| Rota | Superfície |
|---|---|
| `/` | Landing (§12) |
| `/politica-de-privacidade` | LGPD |
| `/login` | Login único (§1) |
| `/selecionar-oficina` | Seleção de tenant (§1) |
| `/app/[tenant]` | Dashboard gerencial (§3) |
| `/app/[tenant]/patio` | Pátio & OS (§4) |
| `/app/[tenant]/os/[numero]` | Detalhe da OS (§5) |
| `/app/[tenant]/orcamentos` · `/orcamentos/novo` | Wizard (§6) |
| `/app/[tenant]/cadastros` · `/estoque` · `/financeiro` · `/fiscal` · `/relacionamento` | Módulos (§7) |
| `/app/[tenant]/integracoes` | Integrações (§8) |
| `/app/[tenant]/paineis` | Índice de painéis |
| `/painel/[tenant]/[setor]` | Modo TV (§11) |
| `/portal/[tenant]` | Portal do cliente (§10) |
| `/provedor` | Console (§9) |

## 6. Integrações

Adaptadores com interface comum, credenciais por tenant, implementação mock plugável.
- Orçamentação/seguradoras: Cília, Audatex, Soma, I360
- Catálogos/peças: Peça Aí, PartsLink24, Catálogo Fraga
- Pagamentos/fiscal: Stone, Boleto Itaú, SEFAZ NF-e, SAT/MF-e
