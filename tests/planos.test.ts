/**
 * Planos, limites e matriz de funcionalidades.
 * Confere o código contra a tabela do README e contra docs/DECISOES.md.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PLANOS, PAPEIS, temFeature, exigirDentroDoLimite, cabeNoLimite,
  LimiteDoPlanoExcedido,
} from '../src/lib/planos.ts';
import { semTenant, fecharPool } from '../src/db/client.ts';

afterAll(async () => { await fecharPool(); });

const GB = 1024 * 1024 * 1024;

describe('limites conforme o README', () => {
  it('Iniciante: R$ 249 · 5 usuários · 1 CNPJ · 20 GB · 300 OS/mês', () => {
    const p = PLANOS.iniciante;
    expect(p.precoMensalCentavos).toBe(24900);
    expect(p.maxUsuarios).toBe(5);
    expect(p.maxCnpjs).toBe(1);
    expect(p.maxArmazenamentoBytes).toBe(20 * GB);
    expect(p.maxOsMes).toBe(300);
  });

  it('Intermediária: R$ 589 · 15 usuários · 2 CNPJs · 50 GB · 1.500 OS/mês', () => {
    const p = PLANOS.intermediaria;
    expect(p.precoMensalCentavos).toBe(58900);
    expect(p.maxUsuarios).toBe(15);
    expect(p.maxCnpjs).toBe(2);
    expect(p.maxArmazenamentoBytes).toBe(50 * GB);
    expect(p.maxOsMes).toBe(1500);
  });

  it('Profissional: R$ 1.290 · usuários, CNPJs e OS ilimitados · 100 GB', () => {
    const p = PLANOS.profissional;
    expect(p.precoMensalCentavos).toBe(129000);
    expect(p.maxUsuarios).toBeNull();
    expect(p.maxCnpjs).toBeNull();
    expect(p.maxOsMes).toBeNull();
    expect(p.maxArmazenamentoBytes).toBe(100 * GB);
  });

  it('preço anual da landing: 199 / 471 / 1.032', () => {
    expect(PLANOS.iniciante.precoAnualCentavos).toBe(19900);
    expect(PLANOS.intermediaria.precoAnualCentavos).toBe(47100);
    expect(PLANOS.profissional.precoAnualCentavos).toBe(103200);
  });

  it('o MRR do console (R$ 2.128) é a soma dos três mensais', () => {
    const soma = Object.values(PLANOS).reduce((s, p) => s + p.precoMensalCentavos, 0);
    expect(soma).toBe(212800);
  });
});

describe('bloqueio ao exceder', () => {
  it('aceita até o limite e recusa o seguinte', () => {
    expect(cabeNoLimite('iniciante', 'usuarios', 4)).toBe(true);
    expect(cabeNoLimite('iniciante', 'usuarios', 5)).toBe(false);
    expect(() => exigirDentroDoLimite('iniciante', 'usuarios', 5))
      .toThrow(LimiteDoPlanoExcedido);
  });

  it('bloqueia CNPJ, armazenamento e OS/mês', () => {
    expect(cabeNoLimite('iniciante', 'cnpjs', 1)).toBe(false);
    expect(cabeNoLimite('intermediaria', 'cnpjs', 1)).toBe(true);
    expect(cabeNoLimite('iniciante', 'os_mes', 300)).toBe(false);
    expect(cabeNoLimite('iniciante', 'os_mes', 299)).toBe(true);
    expect(cabeNoLimite('intermediaria', 'armazenamento', 50 * GB)).toBe(false);
  });

  it('limite nulo é ilimitado e nunca bloqueia', () => {
    expect(cabeNoLimite('profissional', 'usuarios', 10_000)).toBe(true);
    expect(cabeNoLimite('profissional', 'os_mes', 1_000_000)).toBe(true);
  });

  it('o armazenamento da Profissional é limitado mesmo assim', () => {
    expect(cabeNoLimite('profissional', 'armazenamento', 100 * GB)).toBe(false);
  });

  it('a mensagem de erro diz o recurso e o uso', () => {
    try {
      exigirDentroDoLimite('iniciante', 'usuarios', 5);
      expect.unreachable();
    } catch (e) {
      const erro = e as LimiteDoPlanoExcedido;
      expect(erro.recurso).toBe('usuarios');
      expect(erro.limite).toBe(5);
      expect(erro.message).toContain('Iniciante');
    }
  });
});

describe('funcionalidades por plano (coluna "Destaques")', () => {
  it('a Iniciante NÃO emite NF-e', () => {
    expect(temFeature('iniciante', 'nfe_conjugada_devolucao')).toBe(false);
  });

  it('a Iniciante emite NFC-e e NFS-e', () => {
    expect(temFeature('iniciante', 'nfce_nfse')).toBe(true);
  });

  it('a NF-e entra na Intermediária e segue na Profissional', () => {
    expect(temFeature('intermediaria', 'nfe_conjugada_devolucao')).toBe(true);
    expect(temFeature('profissional', 'nfe_conjugada_devolucao')).toBe(true);
  });

  it('os planos são cumulativos', () => {
    for (const f of PLANOS.iniciante.features) {
      expect(temFeature('intermediaria', f), f).toBe(true);
      expect(temFeature('profissional', f), f).toBe(true);
    }
    for (const f of PLANOS.intermediaria.features) {
      expect(temFeature('profissional', f), f).toBe(true);
    }
  });

  it('multiempresa e white-label são exclusivos da Profissional', () => {
    for (const f of ['multiempresa_transferencia', 'portal_whitelabel_dominio']) {
      expect(temFeature('iniciante', f)).toBe(false);
      expect(temFeature('intermediaria', f)).toBe(false);
      expect(temFeature('profissional', f)).toBe(true);
    }
  });
});

describe('perfis de acesso (decisão D-003)', () => {
  it('os quatro papéis existem, e existem em todos os planos', () => {
    expect([...PAPEIS].sort()).toEqual(['consultor', 'financeiro', 'gerente', 'tecnico']);
  });

  it('o banco aceita os quatro papéis independentemente do plano', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conname = 'tenant_users_papel_check'`));
    for (const papel of PAPEIS) expect(rows[0].def).toContain(papel);
  });
});

describe('o banco reflete o catálogo de planos', () => {
  it('os três planos estão gravados com os mesmos limites do código', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ codigo: string; max_usuarios: number | null; max_os_mes: number | null }>(
        'SELECT codigo, max_usuarios, max_os_mes FROM plans ORDER BY ordem'));
    expect(rows.map((r) => r.codigo)).toEqual(['iniciante', 'intermediaria', 'profissional']);
    for (const r of rows) {
      const p = PLANOS[r.codigo as keyof typeof PLANOS];
      expect(r.max_usuarios).toBe(p.maxUsuarios);
      expect(r.max_os_mes).toBe(p.maxOsMes);
    }
  });

  it('as features gravadas conferem com a matriz do código', async () => {
    const { rows } = await semTenant((db) =>
      db.query<{ codigo: string; feature: string }>(
        `SELECT p.codigo, f.feature FROM plan_features f
         JOIN plans p ON p.id = f.plan_id`));
    for (const [codigo, plano] of Object.entries(PLANOS)) {
      const gravadas = rows.filter((r) => r.codigo === codigo).map((r) => r.feature).sort();
      expect(gravadas).toEqual([...plano.features].sort());
    }
  });
});

describe('rastreabilidade com o README', () => {
  it('os preços do código aparecem literalmente no README', () => {
    const readme = readFileSync('README.md', 'utf8');
    for (const preco of ['R$ 249', 'R$ 589', 'R$ 1.290']) {
      expect(readme, preco).toContain(preco);
    }
    for (const anual of ['249→199', '589→471', '1.290→1.032']) {
      expect(readme, anual).toContain(anual);
    }
  });
});
