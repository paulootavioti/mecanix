/**
 * Acesso ao banco.
 *
 * Regra única e inegociável: toda leitura ou escrita de dado de domínio passa
 * por `comTenant()`. Não existe caminho alternativo exposto por este módulo.
 *
 * `comTenant()` abre uma transação e define `app.tenant_id` com
 * `set_config(..., true)` — o `true` faz o valor ser LOCAL à transação, então
 * ele morre no COMMIT/ROLLBACK e não vaza para a próxima requisição que pegar
 * a mesma conexão do pool. É o detalhe que torna seguro usar pool com RLS.
 *
 * A barreira real está no banco (ver db/migrations/0004_rls.sql). Esta camada
 * é conveniência e legibilidade, não a proteção: mesmo que alguém escreva uma
 * query sem WHERE tenant_id, a policy do Postgres devolve zero linhas.
 */
import pg from 'pg';

let poolApp: pg.Pool | undefined;

function pool(): pg.Pool {
  if (!poolApp) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL não definida');
    poolApp = new pg.Pool({ connectionString, max: 10 });
  }
  return poolApp;
}

export interface Consulta {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    texto: string,
    valores?: unknown[],
  ): Promise<pg.QueryResult<T>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Executa `fn` dentro de uma transação com o contexto do inquilino definido.
 * Tudo que `fn` consultar enxerga apenas linhas daquele tenant.
 */
export async function comTenant<T>(
  tenantId: string,
  fn: (db: Consulta) => Promise<T>,
): Promise<T> {
  // Validado antes de ir ao banco: set_config recebe texto, e um valor
  // inesperado aqui significa bug de chamada, não dado de usuário.
  if (!UUID.test(tenantId)) throw new Error('tenantId inválido');

  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

/**
 * Acesso às tabelas de PLATAFORMA (users, sessions, plans, tenants,
 * tenant_users, leads) — as que não têm tenant_id.
 *
 * Nenhuma tabela de domínio é alcançável por aqui: sem `app.tenant_id`
 * definido, a policy de RLS devolve zero linhas para todas elas.
 */
export async function semTenant<T>(fn: (db: Consulta) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Executa `fn` com o contexto do USUÁRIO definido, sem contexto de tenant.
 *
 * Serve ao login e à tela de seleção de oficina: responde "a quais tenants
 * este usuário pertence?" antes de existir um tenant escolhido. A policy
 * `tenant_users_proprio_vinculo` limita o alcance às linhas do próprio
 * usuário — nenhuma outra tabela de domínio fica visível.
 */
export async function comUsuario<T>(
  userId: string,
  fn: (db: Consulta) => Promise<T>,
): Promise<T> {
  if (!UUID.test(userId)) throw new Error('userId inválido');
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

/**
 * Contexto completo: tenant + usuário. É o modo normal de operação da
 * aplicação depois que a oficina foi escolhida.
 */
export async function comContexto<T>(
  tenantId: string,
  userId: string,
  fn: (db: Consulta) => Promise<T>,
): Promise<T> {
  if (!UUID.test(tenantId)) throw new Error('tenantId inválido');
  if (!UUID.test(userId)) throw new Error('userId inválido');
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

export async function fecharPool(): Promise<void> {
  if (poolApp) {
    await poolApp.end();
    poolApp = undefined;
  }
}
