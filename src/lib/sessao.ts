/**
 * Sessão do usuário.
 *
 * Guardada no banco (tabela `sessions`) e referenciada por um cookie httpOnly.
 * Não é JWT de propósito: sessão em banco pode ser revogada na hora, o que
 * importa num produto onde o provedor personifica usuários e a troca de
 * contexto é auditada.
 */
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import { semTenant, comUsuario } from '../db/client.ts';
import { conferirSenha } from './senha.ts';

const COOKIE = 'mecanix_sessao';
const DURACAO_HORAS = 12;

/** O cookie leva o token; o banco guarda só o hash dele. */
function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
}

export interface TenantDoUsuario {
  id: string;
  slug: string;
  nome: string;
  unidade: string;
  cor: string;
  papel: string;
  plano: string;
}

/**
 * Confere e-mail e senha. Separada de `autenticar()` porque não toca em
 * cookies — então roda fora de um request e é testável de verdade.
 */
export async function verificarCredenciais(
  email: string, senha: string,
): Promise<string | null> {
  const { rows } = await semTenant((db) =>
    db.query<{ id: string; senha_hash: string; ativo: boolean }>(
      'SELECT id, senha_hash, ativo FROM users WHERE email = $1', [email.trim().toLowerCase()]));

  if (rows.length === 0) {
    // Confere contra um hash descartável mesmo sem usuário, para que o tempo
    // de resposta não revele quais e-mails existem.
    await conferirSenha(senha, 'scrypt$16384$8$1$AAAA$AAAA');
    return null;
  }
  const u = rows[0];
  if (!u.ativo) return null;
  if (!(await conferirSenha(senha, u.senha_hash))) return null;
  return u.id;
}

export async function autenticar(email: string, senha: string): Promise<string | null> {
  const userId = await verificarCredenciais(email, senha);
  if (!userId) return null;

  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACAO_HORAS * 3600_000);
  await semTenant((db) =>
    db.query('INSERT INTO sessions (id, user_id, expira_em) VALUES ($1, $2, $3)',
      [hashDoTokenComoUuid(token), userId, expira]));

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expira,
  });
  return userId;
}

/** `sessions.id` é uuid; deriva-se um uuid determinístico do hash do token. */
function hashDoTokenComoUuid(token: string): string {
  const h = hashDoToken(token);
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-');
}

export async function usuarioAtual(): Promise<UsuarioSessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const { rows } = await semTenant((db) =>
    db.query<{ id: string; nome: string; email: string }>(
      `SELECT u.id, u.nome, u.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expira_em > now() AND u.ativo`,
      [hashDoTokenComoUuid(token)]));

  return rows[0] ?? null;
}

/** Oficinas que este login alcança — a lista da tela de seleção (§1). */
export async function tenantsDoUsuario(userId: string): Promise<TenantDoUsuario[]> {
  const { rows } = await comUsuario(userId, (db) =>
    db.query<TenantDoUsuario>(
      `SELECT t.id, t.slug, t.nome, t.unidade, t.cor, tu.papel, p.codigo AS plano
       FROM tenant_users tu
       JOIN tenants t ON t.id = tu.tenant_id
       JOIN plans p ON p.id = t.plan_id
       ORDER BY t.nome`));
  return rows;
}

/** Confirma que o usuário pertence ao tenant do slug e devolve o vínculo. */
export async function acessoAoTenant(
  userId: string, slug: string,
): Promise<TenantDoUsuario | null> {
  const lista = await tenantsDoUsuario(userId);
  return lista.find((t) => t.slug === slug) ?? null;
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await semTenant((db) =>
      db.query('DELETE FROM sessions WHERE id = $1', [hashDoTokenComoUuid(token)]));
  }
  jar.delete(COOKIE);
}
