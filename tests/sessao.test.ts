/**
 * Identidade: senha, credenciais e alcance do login a N tenants (§1).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { gerarHash, conferirSenha } from '../src/lib/senha.ts';
import { verificarCredenciais, tenantsDoUsuario, acessoAoTenant } from '../src/lib/sessao.ts';
import { semTenant, fecharPool } from '../src/db/client.ts';

const EMAIL = 'rafael.souza@exemplo.com.br';
const SENHA = 'mecanix-dev';

let userId: string;

beforeAll(async () => {
  const { rows } = await semTenant((db) =>
    db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [EMAIL]));
  userId = rows[0].id;
});

afterAll(async () => { await fecharPool(); });

describe('hash de senha', () => {
  it('confere a senha correta', async () => {
    const h = await gerarHash('segredo');
    expect(await conferirSenha('segredo', h)).toBe(true);
  });

  it('recusa a senha errada', async () => {
    const h = await gerarHash('segredo');
    expect(await conferirSenha('Segredo', h)).toBe(false);
    expect(await conferirSenha('', h)).toBe(false);
  });

  it('o mesmo texto gera hashes diferentes (salt aleatório)', async () => {
    expect(await gerarHash('igual')).not.toBe(await gerarHash('igual'));
  });

  it('guarda os parâmetros de custo junto do hash', async () => {
    expect(await gerarHash('x')).toMatch(/^scrypt\$16384\$8\$1\$/);
  });

  it('não quebra com hash malformado', async () => {
    for (const ruim of ['', 'abc', 'scrypt$1$2', 'bcrypt$a$b$c$d$e']) {
      expect(await conferirSenha('x', ruim), ruim).toBe(false);
    }
  });
});

describe('verificação de credenciais', () => {
  it('aceita e-mail e senha corretos', async () => {
    expect(await verificarCredenciais(EMAIL, SENHA)).toBe(userId);
  });

  it('ignora caixa e espaços no e-mail', async () => {
    expect(await verificarCredenciais(`  ${EMAIL.toUpperCase()}  `, SENHA)).toBe(userId);
  });

  it('recusa senha errada', async () => {
    expect(await verificarCredenciais(EMAIL, 'errada')).toBeNull();
  });

  it('recusa e-mail inexistente', async () => {
    expect(await verificarCredenciais('ninguem@exemplo.com', SENHA)).toBeNull();
  });

  it('recusa usuário inativo', async () => {
    await semTenant((db) => db.query('UPDATE users SET ativo = false WHERE id = $1', [userId]));
    try {
      expect(await verificarCredenciais(EMAIL, SENHA)).toBeNull();
    } finally {
      await semTenant((db) => db.query('UPDATE users SET ativo = true WHERE id = $1', [userId]));
    }
  });
});

describe('um login, N tenants (§1)', () => {
  it('lista as três oficinas do usuário', async () => {
    const lista = await tenantsDoUsuario(userId);
    expect(lista).toHaveLength(3);
  });

  it('cada oficina traz o papel do usuário naquele inquilino', async () => {
    const lista = await tenantsDoUsuario(userId);
    expect(new Set(lista.map((t) => t.papel)).size).toBe(3);
  });

  it('traz slug, cor e plano para montar o botão da tela', async () => {
    const lista = await tenantsDoUsuario(userId);
    for (const t of lista) {
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(t.cor).toBeTruthy();
      expect(['iniciante', 'intermediaria', 'profissional']).toContain(t.plano);
    }
  });

  it('o slug "vertentes" do README está entre elas', async () => {
    const lista = await tenantsDoUsuario(userId);
    expect(lista.some((t) => t.slug === 'vertentes')).toBe(true);
  });
});

describe('acesso a um tenant pelo slug', () => {
  it('devolve o vínculo quando o usuário pertence à oficina', async () => {
    const acesso = await acessoAoTenant(userId, 'vertentes');
    expect(acesso?.slug).toBe('vertentes');
  });

  it('devolve nulo para slug inexistente', async () => {
    expect(await acessoAoTenant(userId, 'oficina-que-nao-existe')).toBeNull();
  });

  it('devolve nulo para oficina à qual o usuário não pertence', async () => {
    // Cria um tenant sem vincular o usuário: ele não pode alcançá-lo.
    const { rows: [plano] } = await semTenant((db) =>
      db.query<{ id: string }>("SELECT id FROM plans WHERE codigo = 'iniciante'"));
    const slug = `alheia-${Math.floor(Math.random() * 1e6)}`;
    await semTenant((db) =>
      db.query(
        `INSERT INTO tenants (slug, nome, unidade, cor, plan_id)
         VALUES ($1, 'Alheia', 'Matriz', '#16181c', $2)`, [slug, plano.id]));

    try {
      expect(await acessoAoTenant(userId, slug)).toBeNull();
    } finally {
      // Sem esta limpeza o tenant sobra no banco e desloca a ordenação por
      // slug de que outras suítes dependiam.
      await semTenant((db) => db.query('DELETE FROM tenants WHERE slug = $1', [slug]));
    }
  });
});
