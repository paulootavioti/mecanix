# Ambiente de desenvolvimento

## Requisitos
- Node 22
- PostgreSQL 14 (via `docker compose up -d db`, ou instância local na porta 5432)

O alvo é **PostgreSQL 14**. O código evita de propósito construções que só
existem a partir do 15 — a lista e os substitutos estão em `docs/PLANO.md`,
seção "Compatibilidade PostgreSQL 14", e `npm run lint:pg14` recusa o que
escapar.

## Subir do zero

```sh
docker compose up -d db
cp .env.example .env
npm install
npm run db:reset   # migrações + seeds
npm test
```

## Papéis do banco

São três conexões, com propósitos distintos, e a separação é o que sustenta
o isolamento:

| Variável | Papel | Para quê |
|---|---|---|
| `DATABASE_URL_SUPERUSER` | `postgres` | só o bootstrap que cria os dois papéis |
| `DATABASE_URL_OWNER` | `mecanix_owner` | migrações (DDL) e seeds |
| `DATABASE_URL` | `mecanix_app` | **a aplicação** — `NOBYPASSRLS`, sem DDL, não é dona de nenhuma tabela |

Nunca apontar a aplicação para `DATABASE_URL_OWNER`. O dono de uma tabela
contorna as policies de RLS se a tabela não usar `FORCE ROW LEVEL SECURITY`;
aqui todas usam, mas a separação de papéis é a primeira barreira e não deve
ser gasta à toa.

## Como acessar dados

Não existe acesso "solto" ao banco. `src/db/client.ts` expõe três portas:

```ts
comTenant(tenantId, fn)          // dados de domínio de um inquilino
comContexto(tenantId, userId, fn) // idem, com usuário — necessário para auditoria
comUsuario(userId, fn)            // só o vínculo do próprio usuário (login)
semTenant(fn)                     // só tabelas de plataforma
```

Todas abrem transação e definem `app.tenant_id` / `app.user_id` com
`set_config(..., true)`. O `true` faz o valor ser LOCAL: ele morre no COMMIT e
não vaza para a próxima requisição que pegar a mesma conexão do pool.

## Testes

```sh
npm test                                        # tudo
npx vitest run --exclude 'tests/pendencias*'    # sem a guarda de pendências
```

`tests/pendencias.test.ts` falha de propósito enquanto houver placeholder em
`db/seed-dados.ts` — é a regra combinada de não inventar conteúdo que faltou
no pacote de design.

Os testes rodam contra um Postgres real, nunca contra mock: o que está sendo
testado é a RLS do banco, e um mock provaria apenas que o mock funciona.

## Testes de ponta a ponta

```sh
npm run test:e2e
```

Sobem o build de produção na porta 3120 e dirigem o navegador. Cobrem o que os
testes de unidade não alcançam: os passos 2 a 4 do wizard renderizam
condicionalmente no cliente, então só um navegador exercita o fluxo inteiro.

O Chromium vem pré-instalado no ambiente e a versão dele pode não ser a que o
`@playwright/test` espera. Por isso `playwright.config.ts` aponta o executável
em vez de baixar; ajuste com `CHROMIUM_PATH` se o caminho for outro.
