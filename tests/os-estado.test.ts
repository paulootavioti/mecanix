/**
 * Máquina de estados da OS.
 * Regras: §5 do README e decisão D-006 (etapa "peça" opcional).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  STATUS, TRANSICOES, ROTULO_AVANCO, ROTULO_STATUS, podeTransicionar,
  proximoStatus, ehTerminal, transicionar, avancar, TransicaoInvalida,
  type StatusOS,
} from '../src/lib/os-estado.ts';
import { comTenant, semTenant, fecharPool } from '../src/db/client.ts';

let t1: string, t2: string, userId: string;

beforeAll(async () => {
  const { rows: tenants } = await semTenant((db) =>
    db.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM tenants WHERE slug IN ('vertentes','oficina-dois')"));
  t1 = tenants.find((r) => r.slug === 'vertentes')!.id;
  t2 = tenants.find((r) => r.slug === 'oficina-dois')!.id;
  const { rows: users } = await semTenant((db) =>
    db.query<{ id: string }>('SELECT id FROM users LIMIT 1'));
  userId = users[0].id;
});

afterAll(async () => { await fecharPool(); });

/** Cria uma OS isolada para o teste, no status pedido. */
async function novaOS(tenantId: string, status: StatusOS): Promise<string> {
  return comTenant(tenantId, async (db) => {
    const { rows: [c] } = await db.query<{ id: string }>('SELECT id FROM clientes LIMIT 1');
    const { rows: [v] } = await db.query<{ id: string }>('SELECT id FROM veiculos LIMIT 1');
    const numero = `OS-T${Math.floor(Math.random() * 1e9)}`;
    const { rows: [os] } = await db.query<{ id: string }>(
      `INSERT INTO ordens_servico (tenant_id, numero, cliente_id, veiculo_id, status)
       VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2, $3, $4)
       RETURNING id`, [numero, c.id, v.id, status]);
    return os.id;
  });
}

async function statusDe(tenantId: string, osId: string): Promise<StatusOS> {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{ status: StatusOS }>('SELECT status FROM ordens_servico WHERE id = $1', [osId]));
  return rows[0].status;
}

async function eventos(tenantId: string, osId: string) {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{ tipo: string; descricao: string; quem: string }>(
      'SELECT tipo, descricao, quem FROM os_eventos WHERE os_id = $1 ORDER BY criado_em', [osId]));
  return rows;
}

describe('o grafo de transições', () => {
  it('cobre os cinco estados do README', () => {
    expect(STATUS).toEqual(['aprovacao', 'execucao', 'peca', 'pronto', 'entregue']);
  });

  it('segue o caminho linear aprovação → execução → peça → pronto → entregue', () => {
    expect(podeTransicionar('aprovacao', 'execucao')).toBe(true);
    expect(podeTransicionar('execucao', 'peca')).toBe(true);
    expect(podeTransicionar('peca', 'pronto')).toBe(true);
    expect(podeTransicionar('pronto', 'entregue')).toBe(true);
  });

  it('permite pular "peça", que é opcional (D-006)', () => {
    expect(podeTransicionar('execucao', 'pronto')).toBe(true);
  });

  it('"entregue" é terminal', () => {
    expect(ehTerminal('entregue')).toBe(true);
    expect(TRANSICOES.entregue).toEqual([]);
  });

  it('não anda para trás', () => {
    expect(podeTransicionar('execucao', 'aprovacao')).toBe(false);
    expect(podeTransicionar('pronto', 'execucao')).toBe(false);
    expect(podeTransicionar('entregue', 'pronto')).toBe(false);
  });

  it('não pula etapas indevidamente', () => {
    expect(podeTransicionar('aprovacao', 'pronto')).toBe(false);
    expect(podeTransicionar('aprovacao', 'entregue')).toBe(false);
    expect(podeTransicionar('execucao', 'entregue')).toBe(false);
    expect(podeTransicionar('peca', 'entregue')).toBe(false);
  });

  it('nenhum estado transiciona para si mesmo', () => {
    for (const s of STATUS) expect(podeTransicionar(s, s), s).toBe(false);
  });

  it('todo estado exceto "entregue" tem saída', () => {
    for (const s of STATUS) {
      expect(TRANSICOES[s].length > 0, s).toBe(s !== 'entregue');
    }
  });
});

describe('rótulos do botão de avanço (§5, literais do README)', () => {
  it.each([
    ['aprovacao', 'Aprovar e liberar execução'],
    ['execucao', 'Solicitar peça faltante'],
    ['peca', 'Peça recebida · finalizar'],
    ['pronto', 'Entregar veículo'],
    ['entregue', 'OS encerrada'],
  ] as const)('em "%s" o botão diz "%s"', (status, rotulo) => {
    expect(ROTULO_AVANCO[status]).toBe(rotulo);
  });

  it('os rótulos das colunas do kanban conferem com o §4', () => {
    expect(Object.values(ROTULO_STATUS)).toEqual([
      'Aguardando aprovação', 'Em execução', 'Aguardando peça',
      'Pronto p/ entrega', 'Entregue',
    ]);
  });

  it('o botão principal de "execução" vai para "peça", como diz o rótulo', () => {
    expect(proximoStatus('execucao')).toBe('peca');
  });
});

describe('transição no banco', () => {
  it('avança e grava o evento na linha do tempo', async () => {
    const os = await novaOS(t1, 'aprovacao');
    const r = await transicionar(t1, userId, os, 'execucao', 'Rafael Souza');

    expect(r).toMatchObject({ de: 'aprovacao', para: 'execucao' });
    expect(await statusDe(t1, os)).toBe('execucao');

    const linha = await eventos(t1, os);
    expect(linha).toHaveLength(1);
    expect(linha[0]).toMatchObject({
      tipo: 'status',
      descricao: 'Aguardando aprovação → Em execução',
      quem: 'Rafael Souza',
    });
  });

  it('recusa transição inválida e não altera nada', async () => {
    const os = await novaOS(t1, 'aprovacao');
    await expect(transicionar(t1, userId, os, 'entregue', 'Rafael Souza'))
      .rejects.toThrow(TransicaoInvalida);

    expect(await statusDe(t1, os)).toBe('aprovacao');
    expect(await eventos(t1, os)).toHaveLength(0);
  });

  it('a OS entregue não avança mais', async () => {
    const os = await novaOS(t1, 'entregue');
    await expect(avancar(t1, userId, os, 'Rafael Souza')).rejects.toThrow(TransicaoInvalida);
    expect(await statusDe(t1, os)).toBe('entregue');
  });

  it('percorre o ciclo completo com peça', async () => {
    const os = await novaOS(t1, 'aprovacao');
    for (const destino of ['execucao', 'peca', 'pronto', 'entregue'] as StatusOS[]) {
      await transicionar(t1, userId, os, destino, 'Rafael Souza');
    }
    expect(await statusDe(t1, os)).toBe('entregue');
    expect(await eventos(t1, os)).toHaveLength(4);
  });

  it('percorre o ciclo pulando peça, em um passo a menos', async () => {
    const os = await novaOS(t1, 'aprovacao');
    await transicionar(t1, userId, os, 'execucao', 'Rafael Souza');
    await transicionar(t1, userId, os, 'pronto', 'Rafael Souza');
    await transicionar(t1, userId, os, 'entregue', 'Rafael Souza');

    expect(await statusDe(t1, os)).toBe('entregue');
    const linha = await eventos(t1, os);
    expect(linha).toHaveLength(3);
    expect(linha[1].descricao).toBe('Em execução → Pronto p/ entrega');
  });

  it('a mensagem de erro nomeia os estados em português', async () => {
    const os = await novaOS(t1, 'aprovacao');
    await expect(transicionar(t1, userId, os, 'pronto', 'Rafael'))
      .rejects.toThrow('Não é possível ir de "Aguardando aprovação" para "Pronto p/ entrega".');
  });
});

describe('a transição respeita o isolamento', () => {
  it('não é possível avançar a OS de outro inquilino', async () => {
    const os = await novaOS(t1, 'aprovacao');
    await expect(transicionar(t2, userId, os, 'execucao', 'invasor'))
      .rejects.toThrow('OS não encontrada neste inquilino');
    expect(await statusDe(t1, os)).toBe('aprovacao');
  });

  it('o evento nasce no tenant da OS', async () => {
    const os = await novaOS(t1, 'aprovacao');
    await transicionar(t1, userId, os, 'execucao', 'Rafael Souza');
    const { rows } = await comTenant(t1, (db) =>
      db.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM os_eventos WHERE os_id = $1', [os]));
    expect(rows.every((r) => r.tenant_id === t1)).toBe(true);
  });
});
