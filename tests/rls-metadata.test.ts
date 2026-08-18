/**
 * Guarda estrutural.
 *
 * Os testes de isolamento provam que as tabelas de HOJE estão protegidas.
 * Estes provam a regra: qualquer tabela nova que ganhe tenant_id sem RLS
 * quebra a suíte no mesmo dia em que for criada.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { semTenant, fecharPool } from '../src/db/client.ts';

afterAll(async () => { await fecharPool(); });

/** Tabelas de plataforma: descrevem a plataforma, não um inquilino. */
const SEM_TENANT_ID = new Set([
  'users', 'sessions', 'plans', 'plan_features', 'tenants',
  'provider_admins', 'leads', 'schema_migrations',
]);

describe('cobertura de RLS', () => {
  it('toda tabela com tenant_id tem RLS habilitada E forçada', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ tabela: string; habilitada: boolean; forcada: boolean }>(
        `SELECT c.relname AS tabela, c.relrowsecurity AS habilitada, c.relforcerowsecurity AS forcada
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND a.attname = 'tenant_id' AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY c.relname`));

    expect(rows.length).toBeGreaterThan(0);
    const desprotegidas = rows.filter((r) => !r.habilitada || !r.forcada);
    expect(desprotegidas.map((r) => r.tabela)).toEqual([]);
  });

  it('toda tabela com tenant_id tem a policy de isolamento', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ tabela: string }>(
        `SELECT c.relname AS tabela
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND a.attname = 'tenant_id' AND a.attnum > 0 AND NOT a.attisdropped
           AND NOT EXISTS (
             SELECT 1 FROM pg_policy p
             WHERE p.polrelid = c.oid AND p.polname = 'tenant_isolation')
         ORDER BY c.relname`));
    expect(rows.map((r) => r.tabela)).toEqual([]);
  });

  it('nenhuma tabela fora da lista de plataforma deixou de ter tenant_id', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ tabela: string }>(
        `SELECT c.relname AS tabela
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND NOT EXISTS (
             SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = c.oid AND a.attname = 'tenant_id'
               AND a.attnum > 0 AND NOT a.attisdropped)
         ORDER BY c.relname`));

    const inesperadas = rows.map((r) => r.tabela).filter((t) => !SEM_TENANT_ID.has(t));
    expect(inesperadas,
      'tabela sem tenant_id que não está declarada como tabela de plataforma').toEqual([]);
  });

  it('a policy usa NULLIF, para falhar fechado também em conexão reaproveitada', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ tabela: string; expr: string }>(
        `SELECT c.relname AS tabela, pg_get_expr(p.polqual, p.polrelid) AS expr
         FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
         WHERE p.polname = 'tenant_isolation'`));

    const semNullif = rows.filter((r) => !r.expr.includes('NULLIF'));
    expect(semNullif.map((r) => r.tabela)).toEqual([]);
  });
});

describe('compatibilidade do servidor', () => {
  it('o servidor é PostgreSQL 14 ou superior', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ v: string }>("SELECT current_setting('server_version_num') AS v"));
    expect(Number(rows[0].v)).toBeGreaterThanOrEqual(140000);
  });
});
