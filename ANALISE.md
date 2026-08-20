# Análise do repositório — Mecanix Cloud

Levantamento feito por leitura direta do código em `claude/mecanix-cloud-multitenant-nod18q`
(commit `f5d6245`). Toda afirmação abaixo aponta arquivo e, quando cabe, linha.

---

## 1. Stack e arquitetura

### Linguagens e frameworks

| Camada | Escolha | Versão | Onde |
|---|---|---|---|
| Runtime | Node.js | 22 | `docs/DESENVOLVIMENTO.md` |
| Framework | Next.js (App Router) | 15.5.4 | `package.json`, `next.config.ts` |
| UI | React | 19.1.1 | `package.json` |
| Linguagem | TypeScript (`strict: true`) | 5.9.2 | `tsconfig.json` |
| Banco | PostgreSQL | **14** (alvo) | `docker-compose.yml` |
| Driver | `pg` puro, sem ORM | 8.16.3 | `src/db/client.ts` |
| Estilo | CSS Modules + custom properties | — | `src/styles/` |
| Testes | Vitest 3.2.4 + Playwright 1.55 | — | `vitest.config.ts`, `playwright.config.ts` |

Não há ORM. As queries são SQL escrito à mão com parâmetros posicionais (`$1`),
sempre parametrizados — não encontrei concatenação de string em cláusula SQL.

O alvo PostgreSQL 14 é imposto por dois mecanismos: `docker-compose.yml` fixa
`image: postgres:14`, e `scripts/check-pg14.ts` falha o build se alguma migração
usar construção de PG15+ (`MERGE`, `security_invoker`, `NULLS NOT DISTINCT`,
`any_value()`).

### Estrutura de pastas

```
db/migrations/     7 migrações SQL numeradas, cada uma declarando o papel que a executa
db/seed-dados.ts   dados de seed separados do script que os aplica
src/app/           rotas do App Router (6 páginas)
src/components/    7 componentes; os de cliente marcados com 'use client'
src/lib/           regra de negócio — 17 módulos, 1.984 linhas
src/lib/integracoes/  adaptadores de serviços externos
src/db/client.ts   única porta de acesso ao banco
src/styles/        tokens + 5 CSS Modules
scripts/           migrate, seed, checagem de compatibilidade PG14
tests/             11 suítes Vitest contra Postgres real
e2e/               1 suíte Playwright
docs/              plano, checklist de aceite, decisões de negócio
```

### Como front e back se comunicam

**Não existe API REST nem GraphQL.** Não há `route.ts` em lugar nenhum de
`src/app/`. A comunicação usa dois mecanismos do Next:

1. **React Server Components** — as páginas são `async` e consultam o banco
   direto. Ex.: `src/app/app/[tenant]/patio/page.tsx:23` chama
   `cartoesDoPatio(tenant.id)`.
2. **Server Actions** — mutações vêm de funções `'use server'`:
   `src/lib/acoes-sessao.ts`, `src/lib/acoes-os.ts`, `src/lib/acoes-wizard.ts`.
   Os componentes de cliente as invocam por `useActionState`/`useTransition`
   (`src/components/Wizard.tsx`, `src/components/BotaoAvanco.tsx`).

Consequência prática: **não há superfície HTTP pública para dados** além das
próprias páginas. Reduz área de ataque, mas amarra o produto ao Next — um app
móvel nativo ou integração de terceiro exigiria construir a API do zero.

---

## 2. Modelo de dados

26 tabelas, todas em `db/migrations/`. Dividem-se em dois grupos com regras
diferentes.

### Plataforma — sem `tenant_id`, sem RLS (`0002_plataforma.sql`)

| Tabela | Papel | Chaves |
|---|---|---|
| `users` | identidade global; um login alcança N oficinas | `UNIQUE (email)` |
| `sessions` | sessão server-side | FK → `users` |
| `plans` | catálogo dos 3 planos | `UNIQUE (codigo)` |
| `plan_features` | matriz plano × funcionalidade | PK `(plan_id, feature)` |
| `tenants` | inquilinos | `UNIQUE (slug)`, `UNIQUE (dominio)` |
| `tenant_users` | vínculo usuário × oficina, com papel | PK `(user_id, tenant_id)` |
| `provider_admins` | super-admin do provedor | PK `user_id` |
| `leads` | lead da landing, antes de existir tenant | FK opcional → `tenants` |

`tenant_users` é a exceção que confirma a regra: **tem** `tenant_id` e **tem**
RLS, porque quem trabalha numa oficina é dado do inquilino.

### Domínio — com `tenant_id` e RLS (`0003_dominio.sql`, `0006_documentos_fiscais.sql`)

`filiais` · `clientes` · `veiculos` · `pecas` · `servicos` · `kits` ·
`kit_itens` · `ordens_servico` · `os_itens` · `os_eventos` · `checklist_itens` ·
`series_fiscais` · `documentos_fiscais` · `inutilizacoes` ·
`integracoes_credenciais` · `uso_tenant` · `auditoria` · `trocas_contexto`

### Relacionamentos principais

- **21 FKs apontam para `tenants(id)`** — toda tabela de domínio se ancora no inquilino.
- `clientes` → `veiculos` → `ordens_servico` → (`os_itens`, `os_eventos`, `checklist_itens`)
- `filiais` → `series_fiscais` → `documentos_fiscais` → `inutilizacoes`
- `plans` → `plan_features` e `plans` → `tenants`
- `users` ← `tenant_users` → `tenants`

### Restrições que carregam regra de negócio

| Restrição | Onde | Por quê |
|---|---|---|
| `UNIQUE (tenant_id, cpf_cnpj)` | `0003_dominio.sql:40` | carteira de clientes privativa por oficina |
| `UNIQUE (tenant_id, numero)` | `0003_dominio.sql:131` | numeração de OS não colide entre inquilinos |
| `UNIQUE (tenant_id, filial_id, modelo, serie)` | `0003_dominio.sql:190` | séries fiscais por inquilino |
| `UNIQUE (tenant_id, serie_id, numero)` | `0006_documentos_fiscais.sql:30` | numeração fiscal por inquilino |
| `CHECK (length(justificativa) >= 15)` | `0006_documentos_fiscais.sql:57` | mínimo exigido pela SEFAZ na inutilização |
| `CHECK (slug ~ '^[a-z0-9]...')` | `0002_plataforma.sql:64` | slug vira subdomínio |

**Ausente**: a tabela `certificados` (certificado A1 por tenant) está prevista em
`docs/PLANO.md` mas **não foi criada**. `documentos_fiscais` não tem como
referenciar o certificado que assinaria a nota.

---

## 3. Multi-tenancy

**Sim, existe isolamento, e é a parte mais sólida do repositório.**

### Como está implementado

Três camadas empilhadas, nesta ordem de importância:

**1. Row-Level Security forçada no banco.** `db/migrations/0007_funcao_rls.sql`
define `aplicar_rls_multitenant()`, que varre o catálogo do Postgres e, para
**toda** tabela do schema `public` com coluna `tenant_id`, aplica:

```sql
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
ALTER TABLE ... FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ... USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
```

Aplicar por varredura, e não por lista fixa, é o que impede tabela nova nascer
desprotegida. O `FORCE` estende a RLS ao **dono** da tabela — sem ele,
`mecanix_owner` leria tudo de todos os inquilinos.

O `NULLIF` cobre um caso não óbvio: `set_config(..., true)` é LOCAL e, no COMMIT,
o valor volta a **string vazia**, não NULL. Sem o `NULLIF`, `''::uuid` lançaria
erro de sintaxe em vez de simplesmente não casar, e a mesma query se comportaria
diferente em conexão nova e em conexão reaproveitada do pool.

**2. Separação de papéis do banco.** `db/migrations/0001_bootstrap.sql` cria
`mecanix_owner` (DDL, migrações) e `mecanix_app` (runtime). O runtime é
`NOBYPASSRLS`, não é dono de nenhuma tabela e não tem `CREATE` no schema
`public` — o `REVOKE CREATE ON SCHEMA public FROM PUBLIC` da linha 40 é
necessário especificamente no PG14, já que o PG15 passou a fazê-lo sozinho.

**3. Camada de aplicação.** `src/db/client.ts` expõe **quatro portas e nenhuma
outra**:

| Função | Contexto definido | Alcança |
|---|---|---|
| `comTenant(tenantId, fn)` | `app.tenant_id` | domínio de um inquilino |
| `comContexto(tenantId, userId, fn)` | ambos | idem, com auditoria |
| `comUsuario(userId, fn)` | `app.user_id` | só o vínculo do próprio usuário |
| `semTenant(fn)` | nenhum | só tabelas de plataforma |

Todas abrem transação e usam `set_config(..., true)`, que é LOCAL — morre no
COMMIT e não vaza para a próxima requisição do pool.

### Auditoria de queries sem filtro de tenant

Varri todas as 36 chamadas de acesso a banco em `src/`. **Não encontrei nenhuma
query de dado de domínio sem contexto de inquilino.**

`semTenant` — a única porta sem contexto de tenant — aparece em **exatamente um
arquivo**, `src/lib/sessao.ts`, e toca **apenas** `users` e `sessions`, ambas
tabelas de plataforma sem `tenant_id`:

```
DELETE FROM sessions | FROM sessions | FROM users | INTO sessions
```

Mesmo que alguém escrevesse uma query de domínio ali por engano, a RLS devolveria
zero linhas — `tests/isolamento.test.ts` prova isso para 6 tabelas.

### Ressalvas honestas

Não são vazamentos, mas são pontos onde o isolamento depende de disciplina:

- **`scripts/seed.ts` grava em vários inquilinos na mesma execução**, usando o
  papel `owner`. Não contorna a RLS (as tabelas usam `FORCE`), porque o script
  define `app.tenant_id` a cada bloco — mas é código com credencial de DDL, e
  deve ficar fora de qualquer imagem de produção.
- **Não existe `middleware.ts`.** A verificação de acesso mora em
  `src/app/app/[tenant]/layout.tsx:26` (`acessoAoTenant` → `notFound()`) e é
  repetida em cada página. Layouts do App Router cobrem rotas filhas, então hoje
  está correto — mas uma futura rota fora de `app/[tenant]/`, ou um `route.ts`,
  não herdaria nada. A barreira final continua sendo a RLS, não o middleware.
- **Não há job nem cron algum no repositório**, então não há trabalho em segundo
  plano acessando dados sem contexto. A fila fiscal por inquilino prevista em
  `docs/PLANO.md` não foi implementada.

---

## 4. Autenticação e autorização

### Autenticação

- **Senha**: scrypt em `src/lib/senha.ts`, sem dependência externa. Parâmetros
  (N=16384, r=8, p=1) gravados no próprio hash, para poder aumentá-los sem
  invalidar senhas existentes. Comparação com `timingSafeEqual`.
- **Contra enumeração de e-mails**: `src/lib/sessao.ts:52` confere a senha contra
  um hash descartável quando o usuário não existe, para o tempo de resposta não
  revelar quais e-mails têm conta.
- **Sessão**: server-side em `sessions`, referenciada por cookie `httpOnly`,
  `sameSite: 'lax'`, `secure` em produção, 12 h de validade. O cookie leva o
  token; o banco guarda o SHA-256 dele.

Escolha deliberada por sessão em banco em vez de JWT: o produto prevê
impersonation pelo provedor, e sessão em banco pode ser revogada na hora.

### Autorização

**É aqui que está o buraco.** `tenant_users.papel` aceita
`gerente | financeiro | consultor | tecnico` (CHECK em `0002_plataforma.sql:76`),
o papel é carregado em `tenantsDoUsuario` (`src/lib/sessao.ts:107`) e é
**exibido** em `src/app/selecionar-oficina/page.tsx:48`.

**Nenhum ponto do código decide qualquer coisa com base no papel.** Um `tecnico`
tem exatamente os mesmos poderes de um `gerente`: pode avançar OS, gerar
orçamento, ver limite de crédito do cliente. A autorização hoje é binária —
pertence ou não pertence ao inquilino.

Ausente também:
- **Nenhuma proteção contra força bruta** no login — sem rate limit, sem
  bloqueio por tentativas, sem CAPTCHA.
- **Sessões expiradas nunca são apagadas.** `DELETE FROM sessions` só ocorre no
  logout explícito (`src/lib/sessao.ts:128`). A tabela cresce indefinidamente.
- **Sem recuperação de senha, sem troca de senha, sem 2FA.**
- **`provider_admins` existe como tabela e não tem uma linha de código** — o
  console do provedor e a impersonation não foram implementados.

Proteção contra CSRF vem de fábrica nos Server Actions do Next, não de código
próprio.

---

## 5. Cobrança

**Não existe cobrança.** Nenhum gateway de pagamento, nenhuma integração de
faturamento, nenhuma tabela `assinaturas`, nenhum webhook.

O que existe é a **modelagem comercial**, sem nada que cobre:

- `src/lib/planos.ts` define os três planos com preço mensal e anual em
  centavos, limites e matriz de funcionalidades.
- `plans` e `plan_features` guardam isso no banco; `tenants.plan_id` associa o
  inquilino a um plano.
- `tenants.trial_expira_em` existe na coluna e **nunca é lido nem escrito** por
  código algum.

### Aplicação dos limites — parcial

De quatro limites definidos, **um** é aplicado:

| Limite | Aplicado? | Onde |
|---|---|---|
| OS/mês | **sim** | `src/lib/orcamento-servidor.ts:57`, com `FOR UPDATE` no contador |
| Usuários | não | nenhum chamador de `exigirDentroDoLimite('usuarios', ...)` |
| CNPJs | não | idem |
| Armazenamento | não | `uso_tenant.armazenamento_bytes` **nunca é atualizado** |

A matriz de funcionalidades (`temFeature`) tem 20 testes e **nenhum chamador em
produção**: nada no app verifica se o plano libera NF-e antes de emitir.

---

## 6. Testes

**219 testes**: 214 de unidade/integração em Vitest e 5 de ponta a ponta em
Playwright. Rodam contra **PostgreSQL real**, nunca contra mock —
`tests/global-setup.ts` recria o banco antes da suíte.

| Suíte | Testes | Cobre |
|---|---|---|
| `tests/tokens.test.ts` | 56 | cada cor, sombra e espaçamento do README existe no CSS; rejeita a volta do `@theme` |
| `tests/orcamento.test.ts` | 23 | margem, validação de placa/documento, bloqueios do wizard |
| `tests/busca.test.ts` | 20 | busca em dois estágios, numeração de OS, limite de plano |
| `tests/fiscal.test.ts` | 20 | rejeição, inutilização, proibição de reuso de numeração |
| `tests/planos.test.ts` | 20 | limites, matriz de features, preços conferidos contra o README |
| `tests/isolamento.test.ts` | 19 | isolamento entre inquilinos, leitura e escrita |
| `tests/os-estado.test.ts` | 19 | grafo de transições, rótulos, gravação na timeline |
| `tests/sessao.test.ts` | 17 | hash, credenciais, um login em N tenants |
| `tests/auditoria.test.ts` | 7 | acesso a ficha e impersonation |
| `tests/pendencias.test.ts` | 6 | **falha de propósito** enquanto houver placeholder |
| `tests/rls-metadata.test.ts` | 5 | guarda estrutural: toda tabela com `tenant_id` tem RLS forçada |
| `e2e/wizard.spec.ts` | 5 | wizard no navegador, incluindo o sigilo entre oficinas |

### O que os testes provam de verdade

`tests/isolamento.test.ts` cobre os caminhos reais de vazamento: sem contexto
retorna zero linhas; filtrar explicitamente pelo tenant alheio não traz nada;
junção que atravessa inquilinos não traz nada; escrita cruzada viola
`WITH CHECK`; o papel de runtime não consegue desligar a RLS nem criar tabela; e
o contexto não vaza entre transações da mesma conexão do pool.

`tests/rls-metadata.test.ts` é a guarda que **já cobrou uma vez**: quando
`documentos_fiscais` e `inutilizacoes` foram criadas sem RLS, ela falhou
nomeando as duas tabelas.

### O que NÃO é testado

- Nenhum componente React tem teste unitário.
- Nenhuma página além do wizard tem E2E — pátio e detalhe da OS não têm.
- Sem teste de carga, de concorrência real ou de migração para trás.
- **Não há CI.** Não existe `.github/workflows/`; nada roda os testes
  automaticamente.

---

## 7. Dívida técnica — 10 problemas por risco real

**1. Papéis não são aplicados em lugar nenhum.** *(segurança — o mais grave)*
`tenant_users.papel` existe, é validado por CHECK, é lido e exibido, e não decide
nada. Um técnico acessa limite de crédito de cliente, gera orçamento e avança OS
como um gerente. Em ERP de oficina isso é acesso indevido a informação comercial
por quem não deveria tê-lo.

**2. Login sem qualquer proteção contra força bruta.** *(segurança)*
`src/lib/acoes-sessao.ts` e `src/lib/sessao.ts` não têm rate limit, contador de
tentativas nem bloqueio temporário. O scrypt encarece cada tentativa, mas não
impede a enésima.

**3. Credenciais de integração sem cifragem.** *(segurança)*
`integracoes_credenciais.segredo_cifrado` é `bytea` e **nenhuma linha de código
a lê ou escreve**. Quando o primeiro provedor real for plugado, não há função de
cifragem, nem gerenciamento de chave, nem rotação — só uma coluna com nome
sugestivo.

**4. Senhas de banco fixas em arquivo versionado.** *(segurança)*
`db/migrations/0001_bootstrap.sql:24,27` criam os papéis com `PASSWORD 'owner'` e
`PASSWORD 'app'`. Há comentário dizendo que produção deve criar os papéis fora
da migração, mas nada **impede** rodar como está.

**5. Sessões expiradas nunca são removidas.** *(perda de dados / crescimento)*
`sessions` só perde linha no logout explícito. Sem job de limpeza — e não há job
nenhum no repositório — a tabela cresce sem limite. `auditoria` tem o mesmo
problema, agravado por `src/lib/os.ts:113` gravar um registro **a cada abertura de
OS**: uma oficina movimentada gera milhares de linhas por dia, sem retenção nem
particionamento.

**6. Três dos quatro limites de plano não são aplicados.** *(receita)*
Só OS/mês bloqueia. Usuários, CNPJs e armazenamento passam livres, e
`uso_tenant.armazenamento_bytes` nunca é sequer calculado. A matriz de
funcionalidades tem 20 testes e zero chamadores: **nada impede um plano Iniciante
de emitir NF-e**, que é exatamente a diferenciação comercial declarada.

**7. Sem CI.** *(processo)*
Existem 219 testes, um linter de compatibilidade PG14 e um typecheck — e nada os
executa automaticamente. A garantia toda depende de alguém lembrar de rodar
`npm test` antes de commitar.

**8. Ausência de índice para a busca por documento e placa.** *(desempenho)*
`clientes` e `veiculos` têm índice só em `tenant_id`
(`0003_dominio.sql:44` e `:62`). As restrições `UNIQUE (tenant_id, cpf_cnpj)` e
`UNIQUE (tenant_id, placa)` criam índices que atendem as buscas atuais, mas
`os_itens` é consultado por `os_id` com subselect de soma em
`src/lib/patio.ts:41` para **cada** cartão do kanban — com centenas de OS
abertas isso degrada.

**9. Certificado A1 previsto e não modelado.** *(bloqueio funcional)*
`docs/PLANO.md` lista a tabela `certificados`; ela não existe em nenhuma
migração. Sem ela não há como armazenar o certificado por inquilino, e a
emissão fiscal real não sai do papel — hoje `src/lib/fiscal.ts` só faz a
máquina de estados, sem transmitir nada.

**10. Sujeira de repositório e dependência morta.** *(higiene)*
`test-results/.last-run.json` foi versionado (saída do Playwright, deveria estar
no `.gitignore`); `zod` está em `dependencies` e **nunca é importado** — toda
validação é feita à mão em `src/lib/orcamento.ts`; `next-env.d.ts`, que é
gerado, também está versionado.

---

## 8. Genérico vs. específico

### Reaproveitável em qualquer SaaS multi-inquilino

Este é o material mais valioso do repositório fora do nicho:

| O quê | Arquivos | Por que se sustenta sozinho |
|---|---|---|
| **Isolamento por RLS** | `0001_bootstrap.sql`, `0004_rls.sql`, `0007_funcao_rls.sql`, `src/db/client.ts` | Não menciona oficina em lugar nenhum. A função `aplicar_rls_multitenant()` serve a qualquer schema com `tenant_id`. |
| **Guarda estrutural de RLS** | `tests/rls-metadata.test.ts` | Varre o catálogo do Postgres; independe do domínio. |
| **Suíte de isolamento** | `tests/isolamento.test.ts` | Trocando nomes de tabela, vale para qualquer produto. |
| **Identidade em N inquilinos** | `src/lib/sessao.ts`, `src/lib/senha.ts`, `0005_vinculo_do_usuario.sql` | Login único com papel por inquilino é padrão de SaaS B2B. A policy de "próprio vínculo" resolve um problema que todo produto multi-tenant encontra. |
| **Planos e limites** | `src/lib/planos.ts` | A estrutura (limite `null` = ilimitado, features cumulativas, erro tipado) é genérica; só os valores são do produto. |
| **Auditoria** | `src/lib/auditoria.ts`, tabela `auditoria` | Registro na mesma transação da leitura é padrão aplicável a qualquer dado sensível. |
| **Adaptadores de integração** | `src/lib/integracoes/tipos.ts` | Interface com credencial por inquilino e mock plugável. |
| **Compatibilidade de versão de banco** | `scripts/check-pg14.ts` | Útil em qualquer projeto que desenvolva numa versão e implante em outra. |
| **Tokens verificados contra a especificação** | `tests/tokens.test.ts` | A técnica — reler a spec e comparar com o CSS — vale para qualquer design system. |

### Exclusivo de oficina mecânica

| O quê | Arquivos |
|---|---|
| Máquina de estados da OS (`aprovação → execução → peça → pronto → entregue`) | `src/lib/os-status.ts`, `src/lib/os-estado.ts` |
| Numeração fiscal brasileira: rejeição, reenvio com mesmo número, inutilização de faixa | `src/lib/fiscal.ts`, `0006_documentos_fiscais.sql` |
| Carteira de clientes privativa com chave `(tenant_id, cpf_cnpj)` | `0003_dominio.sql:40` |
| Busca em dois estágios (base interna vs. consulta pública de CPF/CNPJ) | `src/lib/busca.ts`, `src/lib/integracoes/consulta-publica.ts` |
| Margem sobre custo de peça + custo/hora de mão de obra | `src/lib/orcamento.ts` |
| Kanban de pátio, checklist de entrada, veículo com chassi/renavam/placa | `src/lib/patio.ts`, `src/lib/os.ts` |
| Catálogo de kits/peças/serviços com estoque e tempo de serviço | `src/lib/busca.ts` |

**Fronteira interessante**: "cadastro de clientes" costuma ser genérico, mas aqui
**não é**. A regra de que o mesmo CPF/CNPJ em duas oficinas gera dois registros
independentes, sem deduplicação, é decisão de sigilo comercial do nicho. Um CRM
genérico faria o oposto.

Agenda, notificações e financeiro **não existem** no código — só como tabelas
previstas em `docs/PLANO.md`.

---

## 9. Estado: MVP parcial, longe de produção

**Não é esqueleto** — há regra de negócio real, testada, rodando contra banco de
verdade. **Não é MVP funcional completo** — falta metade das telas e
funcionalidades declaradas. **Não está pronto para produção**, por motivos
concretos.

### O que sustenta "mais que esqueleto"

- 219 testes contra PostgreSQL real, não mocks.
- Isolamento multi-tenant implementado no banco e demonstrado por teste, com
  três achados reais corrigidos durante a construção (tabela nova sem RLS,
  string vazia no `current_setting`, `@theme` do Tailwind comendo 71 dos 75 tokens).
- Regras fiscais e financeiras confirmadas com o responsável antes de codificar,
  registradas em `docs/DECISOES.md` (D-001 a D-008), com 5 pendências ainda
  abertas e explicitamente não presumidas.
- Fluxos que funcionam ponta a ponta no navegador: login → seleção de oficina →
  pátio → detalhe da OS → avanço de etapa → wizard → geração de OS.

### O que impede "pronto para produção"

**Funcionalidade**: 6 rotas existem de ~15 previstas. A sidebar
(`src/lib/navegacao.ts`) lista 10 itens; **9 apontam para rotas que retornam
404** — só "Pátio & OS" resolve. Dashboard, orçamentos, cadastros, estoque,
financeiro, fiscal, relacionamento, integrações e painéis não existem. O rodapé linka `/portal` e `/provedor`,
que também não existem. Das 6 fases do plano, 1 está completa e 1 está pela
metade.

**Segurança**: papéis não aplicados (item 1 da dívida), login sem rate limit
(item 2), credenciais de integração sem cifragem (item 3).

**Operação**: sem CI, sem qualquer job em segundo plano, sem limpeza de sessão
ou retenção de auditoria, sem observabilidade, sem tratamento de erro global —
uma exceção em Server Component vira erro genérico do Next.

**Comercial**: sem cobrança, e 3 dos 4 limites de plano não bloqueiam nada.

**Conteúdo**: `tests/pendencias.test.ts` falha de propósito — nomes de duas das
três oficinas de exemplo, itens do catálogo, textos de 3 toasts e 1 botão são
placeholders explícitos, porque as capturas e os protótipos `.dc.html` do pacote
de design não chegaram ao repositório (o commit `ed782cd` trouxe a pasta como
gitlink vazio, sem `.gitmodules`).

### Avaliação

A **fundação** está em qualidade de produção: o isolamento multi-tenant é a parte
mais difícil de acertar depois, e está certa, provada e protegida contra
regressão. O que falta é volume de tela e as arestas operacionais — trabalho
extenso, mas de risco baixo, porque a barreira que protege dado de cliente já
está no lugar e testada.

Ordem sugerida para chegar a produção: aplicar papéis → rate limit no login →
cifrar credenciais → CI → limites restantes de plano → telas faltantes.
