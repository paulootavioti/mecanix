import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  lerFichaCliente, registrarImpersonation, registrarTrocaContexto, listarAuditoria,
} from '../src/lib/auditoria.ts';
import { comTenant, semTenant, fecharPool } from '../src/db/client.ts';

let t1: string, t2: string, userId: string, clienteT1: string;

beforeAll(async () => {
  const { rows: tenants } = await semTenant((db) =>
    db.query<{ id: string }>('SELECT id FROM tenants ORDER BY slug'));
  t1 = tenants[0].id; t2 = tenants[1].id;
  const { rows: users } = await semTenant((db) =>
    db.query<{ id: string }>('SELECT id FROM users LIMIT 1'));
  userId = users[0].id;
  const { rows: clientes } = await comTenant(t1, (db) =>
    db.query<{ id: string }>('SELECT id FROM clientes LIMIT 1'));
  clienteT1 = clientes[0].id;
});

afterAll(async () => { await fecharPool(); });

describe('acesso a ficha de cliente', () => {
  it('lê a ficha e registra o acesso', async () => {
    const antes = (await listarAuditoria(t1)).length;
    const ficha = await lerFichaCliente(t1, userId, clienteT1);
    expect(ficha).not.toBeNull();

    const depois = await listarAuditoria(t1);
    expect(depois.length).toBe(antes + 1);
    expect(depois[0]).toMatchObject({
      acao: 'cliente.ficha.acesso',
      entidade: 'clientes',
      entidade_id: clienteT1,
      user_id: userId,
    });
    expect(depois[0].criado_em).toBeInstanceOf(Date);
  });

  it('a ficha de um cliente de outro tenant não é alcançável', async () => {
    const ficha = await lerFichaCliente(t2, userId, clienteT1);
    expect(ficha).toBeNull();
  });

  it('tentativa frustrada não gera registro de acesso', async () => {
    const antes = (await listarAuditoria(t2)).length;
    await lerFichaCliente(t2, userId, clienteT1);
    expect((await listarAuditoria(t2)).length).toBe(antes);
  });
});

describe('impersonation do provedor', () => {
  it('fica registrada e visível na auditoria do próprio tenant', async () => {
    await registrarImpersonation(t1, userId, 'Entrar como — suporte');
    const [ultimo] = await listarAuditoria(t1);
    expect(ultimo).toMatchObject({
      acao: 'provedor.impersonation.inicio',
      impersonacao: true,
    });
  });

  it('a impersonation em um tenant não aparece na auditoria do outro', async () => {
    const doOutro = await listarAuditoria(t2);
    expect(doOutro.filter((r) => r.acao === 'provedor.impersonation.inicio')).toHaveLength(0);
  });
});

describe('troca de contexto', () => {
  it('é auditada no tenant de destino', async () => {
    await registrarTrocaContexto(t2, userId, t1);
    const registros = await comTenant(t2, (db) =>
      db.query<{ tenant_anterior: string }>(
        'SELECT tenant_anterior FROM trocas_contexto ORDER BY criado_em DESC LIMIT 1'));
    expect(registros.rows[0].tenant_anterior).toBe(t1);

    const [ultimo] = await listarAuditoria(t2);
    expect(ultimo.acao).toBe('contexto.troca');
  });
});

describe('a auditoria obedece ao isolamento', () => {
  it('cada tenant lê apenas a própria auditoria', async () => {
    const a = await listarAuditoria(t1);
    const b = await listarAuditoria(t2);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(new Set(a.map((r) => r.tenant_id))).toEqual(new Set([t1]));
    expect(new Set(b.map((r) => r.tenant_id))).toEqual(new Set([t2]));
  });
});
