/**
 * Busca em dois estágios (§6) e geração da OS.
 *
 * O ponto central: buscar um CPF/CNPJ que existe em OUTRO inquilino nunca
 * pode trazer os dados daquele inquilino. O resultado tem que vir da consulta
 * pública, com dados apenas cadastrais.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  buscarVeiculoPorPlaca, buscarClientePorDocumento, catalogoDoTenant, BuscaInvalida,
} from '../src/lib/busca.ts';
import { gerarOSdoOrcamento } from '../src/lib/orcamento-servidor.ts';
import { LimiteDoPlanoExcedido } from '../src/lib/planos.ts';
import { comTenant, semTenant, fecharPool } from '../src/db/client.ts';

const DOC_COMPARTILHADO = '12345678000199';
const PLACA = 'RQK7D22';

let t1: string, t2: string, userId: string;

beforeAll(async () => {
  const { rows } = await semTenant((db) =>
    db.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM tenants WHERE slug IN ('vertentes','oficina-dois')"));
  t1 = rows.find((r) => r.slug === 'vertentes')!.id;
  t2 = rows.find((r) => r.slug === 'oficina-dois')!.id;
  const { rows: us } = await semTenant((db) =>
    db.query<{ id: string }>('SELECT id FROM users LIMIT 1'));
  userId = us[0].id;
});

afterAll(async () => { await fecharPool(); });

describe('busca de veículo por placa', () => {
  it('encontra o veículo do próprio inquilino com o histórico dele', async () => {
    const v = await buscarVeiculoPorPlaca(t1, PLACA);
    expect(v).not.toBeNull();
    expect(v!.placa).toBe(PLACA);
    expect(v!.osAnteriores).toBeGreaterThan(0);
  });

  it('aceita placa com separador e caixa baixa', async () => {
    const v = await buscarVeiculoPorPlaca(t1, 'rqk-7d22');
    expect(v!.placa).toBe(PLACA);
  });

  it('recusa placa curta com a mensagem literal do README', async () => {
    await expect(buscarVeiculoPorPlaca(t1, 'RQK7')).rejects.toThrow('Informe uma placa válida');
  });

  it('a mesma placa em outro inquilino é outro veículo', async () => {
    const a = await buscarVeiculoPorPlaca(t1, PLACA);
    const b = await buscarVeiculoPorPlaca(t2, PLACA);
    expect(a!.id).not.toBe(b!.id);
  });

  it('o histórico de OS contado é o do próprio inquilino', async () => {
    const a = await buscarVeiculoPorPlaca(t1, PLACA);
    const b = await buscarVeiculoPorPlaca(t2, PLACA);
    // t1 tem as 23 OS de exemplo; t2 tem uma só.
    expect(a!.osAnteriores).toBeGreaterThan(b!.osAnteriores);
  });
});

describe('estágio (a) — base interna do inquilino', () => {
  it('traz condições comerciais quando o cliente é da casa', async () => {
    const c = await buscarClientePorDocumento(t1, DOC_COMPARTILHADO);
    expect(c!.origem).toBe('base_interna');
    expect(c).toHaveProperty('limiteCreditoCentavos');
    expect(c!.clienteId).toBeTruthy();
  });

  it('cada inquilino vê o SEU cadastro do mesmo documento', async () => {
    const a = await buscarClientePorDocumento(t1, DOC_COMPARTILHADO);
    const b = await buscarClientePorDocumento(t2, DOC_COMPARTILHADO);
    expect(a!.origem).toBe('base_interna');
    expect(b!.origem).toBe('base_interna');
    expect(a!.clienteId).not.toBe(b!.clienteId);
    expect(a!.nome).not.toBe(b!.nome);
  });
});

describe('estágio (b) — consulta pública, sem tocar em outro inquilino', () => {
  const DOC_SO_DO_T2 = '98765432000188';

  beforeAll(async () => {
    // Cadastra o documento APENAS no t2, com dados comerciais reconhecíveis.
    await comTenant(t2, (db) =>
      db.query(
        `INSERT INTO clientes (tenant_id, cpf_cnpj, tipo, nome, contato, limite_credito_centavos)
         VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid,
                 $1, 'pj', 'SEGREDO COMERCIAL DO T2', '11 90000-0000', 999999)
         ON CONFLICT (tenant_id, cpf_cnpj) DO NOTHING`, [DOC_SO_DO_T2]));
  });

  it('o t1 não recebe nada do cadastro que só existe no t2', async () => {
    const c = await buscarClientePorDocumento(t1, DOC_SO_DO_T2);
    expect(c!.origem).toBe('consulta_publica');
    expect(c!.nome).not.toContain('SEGREDO');
    expect(c!.clienteId).toBeUndefined();
  });

  it('a consulta pública não devolve condições comerciais', async () => {
    const c = await buscarClientePorDocumento(t1, DOC_SO_DO_T2);
    expect(c!.limiteCreditoCentavos).toBeUndefined();
    expect(c!.contato).toBeUndefined();
    expect(c!.titulosEmAtraso).toBeUndefined();
  });

  it('o t2 continua vendo o próprio cadastro pela base interna', async () => {
    const c = await buscarClientePorDocumento(t2, DOC_SO_DO_T2);
    expect(c!.origem).toBe('base_interna');
    expect(c!.nome).toBe('SEGREDO COMERCIAL DO T2');
    expect(c!.limiteCreditoCentavos).toBe(999999);
  });

  it('recusa documento com quantidade de dígitos inválida', async () => {
    await expect(buscarClientePorDocumento(t1, '123')).rejects.toThrow(BuscaInvalida);
  });
});

describe('catálogo do passo 3', () => {
  it('traz kits, peças e serviços do próprio inquilino', async () => {
    const itens = await catalogoDoTenant(t1);
    expect(new Set(itens.map((i) => i.tipo))).toEqual(new Set(['kit', 'peca', 'servico']));
  });

  it('peça traz saldo e custo médio; serviço traz tempo', async () => {
    const itens = await catalogoDoTenant(t1);
    expect(itens.find((i) => i.tipo === 'peca')).toHaveProperty('saldo');
    expect(itens.find((i) => i.tipo === 'servico')).toHaveProperty('tempoHoras');
  });
});

describe('geração da OS a partir do orçamento', () => {
  async function dadosDoOrcamento(tenantId: string) {
    const { rows } = await comTenant(tenantId, (db) =>
      db.query<{ v: string; c: string }>(
        'SELECT v.id AS v, c.id AS c FROM veiculos v JOIN clientes c ON c.id = v.cliente_id LIMIT 1'));
    return {
      veiculoId: rows[0].v,
      clienteId: rows[0].c,
      consultor: 'Rafael Souza',
      itens: [{
        tipo: 'peca' as const, codigo: 'PC-001', nome: 'peça',
        qtd: 1, unitCentavos: 12900, custoUnitCentavos: 6000,
      }],
    };
  }

  it('o número segue o maior existente no inquilino', async () => {
    const os = await gerarOSdoOrcamento(t1, userId, 'profissional', await dadosDoOrcamento(t1));
    // As OS de exemplo vão até OS-8412, então a próxima é OS-8413 (§6).
    expect(os.numero).toBe('OS-8413');
  });

  it('a OS nasce aguardando aprovação e com evento na linha do tempo', async () => {
    const os = await gerarOSdoOrcamento(t1, userId, 'profissional', await dadosDoOrcamento(t1));
    const { rows } = await comTenant(t1, (db) =>
      db.query<{ status: string; eventos: string }>(
        `SELECT o.status, (SELECT count(*) FROM os_eventos e WHERE e.os_id = o.id) AS eventos
         FROM ordens_servico o WHERE o.id = $1`, [os.id]));
    expect(rows[0].status).toBe('aprovacao');
    expect(Number(rows[0].eventos)).toBe(1);
  });

  it('cada inquilino continua a própria sequência, sem enxergar a do outro', async () => {
    const maiorDe = async (t: string) => {
      const { rows } = await comTenant(t, (db) =>
        db.query<{ maior: number | null }>(
          `SELECT max(CAST(substring(numero from '[0-9]+$') AS integer)) AS maior
           FROM ordens_servico WHERE numero ~ '^OS-[0-9]+$'`));
      return rows[0].maior ?? 0;
    };

    const [antesT1, antesT2] = [await maiorDe(t1), await maiorDe(t2)];
    const a = await gerarOSdoOrcamento(t1, userId, 'profissional', await dadosDoOrcamento(t1));
    const b = await gerarOSdoOrcamento(t2, userId, 'profissional', await dadosDoOrcamento(t2));

    expect(Number(a.numero.slice(3))).toBe(antesT1 + 1);
    expect(Number(b.numero.slice(3))).toBe(antesT2 + 1);
  });

  it('o mesmo número pode existir em dois inquilinos sem colidir', async () => {
    // O seed começa o segundo inquilino em OS-8413, que é justamente o número
    // que o wizard gera para o primeiro (§6). Os dois coexistem porque a
    // unicidade é (tenant_id, numero) — é a prova de que a numeração é por
    // inquilino, e não global.
    const existeEm = async (t: string, numero: string) => {
      const { rows } = await comTenant(t, (db) =>
        db.query<{ n: string }>(
          'SELECT count(*) AS n FROM ordens_servico WHERE numero = $1', [numero]));
      return rows[0].n !== '0';
    };
    expect(await existeEm(t1, 'OS-8413')).toBe(true);
    expect(await existeEm(t2, 'OS-8413')).toBe(true);
  });

  it('recusa orçamento sem itens', async () => {
    const d = await dadosDoOrcamento(t1);
    await expect(gerarOSdoOrcamento(t1, userId, 'profissional', { ...d, itens: [] }))
      .rejects.toThrow('ao menos um item');
  });

  it('bloqueia ao exceder o limite de OS/mês do plano', async () => {
    // A Iniciante permite 300 OS/mês; força o contador ao teto.
    await comTenant(t2, (db) =>
      db.query(
        `INSERT INTO uso_tenant (tenant_id, competencia, os_criadas)
         VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid,
                 to_char(now(),'YYYY-MM'), 300)
         ON CONFLICT (tenant_id, competencia) DO UPDATE SET os_criadas = 300`));

    await expect(gerarOSdoOrcamento(t2, userId, 'iniciante', await dadosDoOrcamento(t2)))
      .rejects.toThrow(LimiteDoPlanoExcedido);
  });

  it('o bloqueio desfaz a transação inteira — nenhuma OS parcial fica gravada', async () => {
    const antes = await comTenant(t2, (db) =>
      db.query<{ n: string }>('SELECT count(*) AS n FROM ordens_servico'));
    await expect(gerarOSdoOrcamento(t2, userId, 'iniciante', await dadosDoOrcamento(t2)))
      .rejects.toThrow(LimiteDoPlanoExcedido);
    const depois = await comTenant(t2, (db) =>
      db.query<{ n: string }>('SELECT count(*) AS n FROM ordens_servico'));
    expect(depois.rows[0].n).toBe(antes.rows[0].n);
  });
});
