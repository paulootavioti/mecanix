/**
 * Prova de isolamento entre inquilinos.
 *
 * Estes testes rodam contra um PostgreSQL de verdade, pela conexão do RUNTIME
 * (mecanix_app) — a mesma que a aplicação usa. Um mock não provaria nada:
 * a barreira que está sendo testada é a RLS do banco, não o código.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { comTenant, comUsuario, semTenant, fecharPool } from '../src/db/client.ts';

let t1: string;
let t2: string;

beforeAll(async () => {
  // Escolhidos por slug, não por ordem: qualquer tenant criado por outra
  // suíte deslocaria uma seleção posicional.
  const { rows } = await semTenant((db) =>
    db.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM tenants WHERE slug IN ('vertentes','oficina-dois')"));
  t1 = rows.find((r) => r.slug === 'vertentes')!.id;
  t2 = rows.find((r) => r.slug === 'oficina-dois')!.id;
});

afterAll(async () => { await fecharPool(); });

describe('leitura', () => {
  it('sem contexto de tenant, nenhuma tabela de domínio devolve linha', async () => {
    const tabelas = ['clientes', 'veiculos', 'ordens_servico', 'os_itens', 'os_eventos', 'pecas'];
    for (const tabela of tabelas) {
      const { rows } = await semTenant((db) =>
        db.query<{ n: string }>(`SELECT count(*) AS n FROM ${tabela}`));
      expect(rows[0].n, `${tabela} vazou sem contexto`).toBe('0');
    }
  });

  it('cada tenant só enxerga as próprias OS', async () => {
    const de = async (t: string) =>
      (await comTenant(t, (db) =>
        db.query<{ tenant_id: string }>('SELECT DISTINCT tenant_id FROM ordens_servico'))).rows;

    const a = await de(t1);
    const b = await de(t2);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].tenant_id).toBe(t1);
    expect(b[0].tenant_id).toBe(t2);
  });

  it('filtrar explicitamente pelo tenant alheio não traz nada', async () => {
    const { rows } = await comTenant(t1, (db) =>
      db.query<{ n: string }>('SELECT count(*) AS n FROM clientes WHERE tenant_id = $1', [t2]));
    expect(rows[0].n).toBe('0');
  });

  it('nem por junção que atravesse tenants', async () => {
    const { rows } = await comTenant(t1, (db) =>
      db.query<{ n: string }>(
        `SELECT count(*) AS n FROM ordens_servico o
         JOIN clientes c ON c.id = o.cliente_id
         WHERE c.tenant_id <> o.tenant_id`));
    expect(rows[0].n).toBe('0');
  });
});

describe('escrita', () => {
  it('gravar com tenant_id alheio é recusado pelo WITH CHECK', async () => {
    await expect(
      comTenant(t1, (db) =>
        db.query(
          `INSERT INTO clientes (tenant_id, cpf_cnpj, tipo, nome)
           VALUES ($1, '99999999999', 'pf', 'invasor')`, [t2])),
    ).rejects.toThrow(/row-level security/i);
  });

  it('atualizar linha de outro tenant não afeta nada', async () => {
    const { rowCount } = await comTenant(t1, (db) =>
      db.query('UPDATE clientes SET nome = $1 WHERE tenant_id = $2', ['sequestrado', t2]));
    expect(rowCount).toBe(0);
  });

  it('apagar linha de outro tenant não afeta nada', async () => {
    const { rowCount } = await comTenant(t1, (db) =>
      db.query('DELETE FROM ordens_servico WHERE tenant_id = $1', [t2]));
    expect(rowCount).toBe(0);
  });
});

describe('carteira de clientes é privativa', () => {
  const DOC = '12345678000199';

  it('o mesmo CPF/CNPJ em dois tenants são dois registros independentes', async () => {
    const a = await comTenant(t1, (db) =>
      db.query<{ id: string; nome: string }>(
        'SELECT id, nome FROM clientes WHERE cpf_cnpj = $1', [DOC]));
    const b = await comTenant(t2, (db) =>
      db.query<{ id: string; nome: string }>(
        'SELECT id, nome FROM clientes WHERE cpf_cnpj = $1', [DOC]));

    expect(a.rows).toHaveLength(1);
    expect(b.rows).toHaveLength(1);
    expect(a.rows[0].id).not.toBe(b.rows[0].id);
    expect(a.rows[0].nome).not.toBe(b.rows[0].nome);
  });

  it('a unicidade do documento é por tenant, não global', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conname = 'clientes_tenant_doc_key'`));
    expect(rows[0].def).toBe('UNIQUE (tenant_id, cpf_cnpj)');
  });

  it('não existe índice único só por cpf_cnpj', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ n: string }>(
        `SELECT count(*) AS n FROM pg_indexes
         WHERE tablename = 'clientes' AND indexdef LIKE '%UNIQUE%'
           AND indexdef LIKE '%cpf_cnpj%' AND indexdef NOT LIKE '%tenant_id%'`));
    expect(rows[0].n).toBe('0');
  });
});

describe('numeração não colide entre inquilinos', () => {
  it('a unicidade do número da OS inclui tenant_id', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conname = 'ordens_servico_tenant_numero_key'`));
    expect(rows[0].def).toBe('UNIQUE (tenant_id, numero)');
  });

  it('a série fiscal é única por tenant, filial, modelo e série', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conname = 'series_fiscais_key'`));
    expect(rows[0].def).toBe('UNIQUE (tenant_id, filial_id, modelo, serie)');
  });
});

describe('identidade em N tenants', () => {
  it('o mesmo login alcança vários tenants com papéis distintos', async () => {
    const { rows: [u] } = await semTenant((db) =>
      db.query<{ id: string }>('SELECT id FROM users WHERE email = $1',
        ['rafael.souza@exemplo.com.br']));

    const { rows } = await comUsuario(u.id, (db) =>
      db.query<{ tenant_id: string; papel: string }>(
        'SELECT tenant_id, papel FROM tenant_users ORDER BY papel'));

    expect(rows.length).toBe(3);
    expect(new Set(rows.map((r) => r.papel)).size).toBe(3);
  });

  it('o contexto de usuário não abre nenhuma tabela de domínio', async () => {
    const { rows: [u] } = await semTenant((db) =>
      db.query<{ id: string }>('SELECT id FROM users LIMIT 1'));
    const { rows } = await comUsuario(u.id, (db) =>
      db.query<{ n: string }>('SELECT count(*) AS n FROM clientes'));
    expect(rows[0].n).toBe('0');
  });
});

describe('a conexão de runtime não consegue contornar a RLS', () => {
  it('mecanix_app não tem BYPASSRLS', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ rolbypassrls: boolean; rolsuper: boolean }>(
        'SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user'));
    expect(rows[0].rolbypassrls).toBe(false);
    expect(rows[0].rolsuper).toBe(false);
  });

  it('mecanix_app não é dono de nenhuma tabela', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ n: string }>(
        `SELECT count(*) AS n FROM pg_tables
         WHERE schemaname = 'public' AND tableowner = current_user`));
    expect(rows[0].n).toBe('0');
  });

  it('mecanix_app não consegue desligar a RLS de uma tabela', async () => {
    await expect(
      semTenant((db) => db.query('ALTER TABLE clientes DISABLE ROW LEVEL SECURITY')),
    ).rejects.toThrow(/must be owner/i);
  });

  it('mecanix_app não consegue criar tabela no schema public', async () => {
    await expect(
      semTenant((db) => db.query('CREATE TABLE fuga (id int)')),
    ).rejects.toThrow(/permission denied/i);
  });

  it('o contexto morre no fim da transação e não vaza pela conexão do pool', async () => {
    // Duas transações seguidas na mesma conexão: a segunda não pode herdar
    // o app.tenant_id da primeira. É o que torna seguro usar pool com RLS.
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1,$2,true)', ['app.tenant_id', t1]);
      const dentro = await client.query<{ n: string }>('SELECT count(*) AS n FROM clientes');
      await client.query('COMMIT');
      expect(Number(dentro.rows[0].n)).toBeGreaterThan(0);

      const fora = await client.query<{ n: string }>('SELECT count(*) AS n FROM clientes');
      expect(fora.rows[0].n).toBe('0');
    } finally {
      await client.end();
    }
  });
});
