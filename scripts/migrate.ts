/**
 * Executor de migrações.
 *
 * Cada arquivo declara no cabeçalho o papel que deve executá-lo
 * (`-- @role: superuser` ou `-- @role: owner`). O runtime da aplicação nunca
 * aparece aqui: mecanix_app não executa DDL.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const DIR = join(process.cwd(), 'db', 'migrations');

function url(papel: 'superuser' | 'owner'): string {
  const chave = papel === 'superuser' ? 'DATABASE_URL_SUPERUSER' : 'DATABASE_URL_OWNER';
  const valor = process.env[chave];
  if (!valor) throw new Error(`${chave} não definida`);
  return valor;
}

function papelDe(sql: string, arquivo: string): 'superuser' | 'owner' {
  const m = sql.match(/^--\s*@role:\s*(superuser|owner)\s*$/m);
  if (!m) throw new Error(`${arquivo} não declara "-- @role:" no cabeçalho`);
  return m[1] as 'superuser' | 'owner';
}

async function main() {
  const reset = process.argv.includes('--reset');

  if (reset) {
    const su = new pg.Client({ connectionString: url('superuser') });
    await su.connect();
    // Derruba só os objetos da aplicação; os papéis são preservados porque
    // são globais ao cluster e recriados de forma idempotente por 0001.
    await su.query('DROP SCHEMA IF EXISTS public CASCADE');
    await su.query('CREATE SCHEMA public');
    await su.end();
    console.log('schema public recriado');
  }

  const su = new pg.Client({ connectionString: url('superuser') });
  await su.connect();
  await su.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao      text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )`);
  await su.query('GRANT SELECT ON schema_migrations TO PUBLIC');
  const { rows } = await su.query<{ versao: string }>('SELECT versao FROM schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.versao));

  const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const sql = readFileSync(join(DIR, arquivo), 'utf8');
    const papel = papelDe(sql, arquivo);

    const client = new pg.Client({ connectionString: url(papel) });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (erro) {
      await client.query('ROLLBACK');
      throw new Error(`falha em ${arquivo}: ${(erro as Error).message}`);
    } finally {
      await client.end();
    }

    await su.query('INSERT INTO schema_migrations (versao) VALUES ($1)', [arquivo]);
    console.log(`aplicada ${arquivo} (como ${papel})`);
  }

  await su.end();
  console.log('migrações em dia');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
