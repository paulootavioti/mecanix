/**
 * Numeração fiscal — decisão D-008.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  reservarNumero, transmitir, registrarAutorizacao, registrarRejeicao,
  inutilizar, numeroInutilizado, ErroFiscal, JUSTIFICATIVA_MIN,
} from '../src/lib/fiscal.ts';
import { comTenant, semTenant, fecharPool } from '../src/db/client.ts';

let t1: string, t2: string, userId: string, serieT1: string, serieT2: string;
const JUSTIFICATIVA = 'Erro de digitacao no destinatario, emissao abandonada';

beforeAll(async () => {
  const { rows: tenants } = await semTenant((db) =>
    db.query<{ id: string; slug: string }>(
      "SELECT id, slug FROM tenants WHERE slug IN ('vertentes','oficina-dois')"));
  t1 = tenants.find((r) => r.slug === 'vertentes')!.id;
  t2 = tenants.find((r) => r.slug === 'oficina-dois')!.id;
  const { rows: users } = await semTenant((db) =>
    db.query<{ id: string }>('SELECT id FROM users LIMIT 1'));
  userId = users[0].id;
  const serie = async (t: string) => (await comTenant(t, (db) =>
    db.query<{ id: string }>(
      "SELECT id FROM series_fiscais WHERE modelo = 'nfe' LIMIT 1"))).rows[0].id;
  serieT1 = await serie(t1); serieT2 = await serie(t2);
});

afterAll(async () => { await fecharPool(); });

async function situacaoDe(tenantId: string, docId: string) {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{ situacao: string; tentativas: number; motivo_rejeicao: string | null }>(
      'SELECT situacao, tentativas, motivo_rejeicao FROM documentos_fiscais WHERE id = $1',
      [docId]));
  return rows[0];
}

describe('reserva de numeração', () => {
  it('números são sequenciais dentro da série', async () => {
    const a = await reservarNumero(t1, userId, serieT1);
    const b = await reservarNumero(t1, userId, serieT1);
    expect(b.numero).toBe(a.numero + 1);
    expect(a.situacao).toBe('reservado');
  });

  it('o contador da série nunca retrocede', async () => {
    const antes = await reservarNumero(t1, userId, serieT1);
    await inutilizar(t1, userId, antes.id, JUSTIFICATIVA);
    const depois = await reservarNumero(t1, userId, serieT1);
    expect(depois.numero).toBeGreaterThan(antes.numero);
  });

  it('a numeração de um inquilino não interfere na do outro', async () => {
    const a = await reservarNumero(t1, userId, serieT1);
    const b = await reservarNumero(t2, userId, serieT2);
    // Os dois podem ter o mesmo número: são séries de inquilinos diferentes.
    expect(a.serieId).not.toBe(b.serieId);

    const { rows } = await comTenant(t2, (db) =>
      db.query<{ n: string }>('SELECT count(*) AS n FROM documentos_fiscais WHERE id = $1', [a.id]));
    expect(rows[0].n).toBe('0');
  });

  it('não reserva número em série de outro inquilino', async () => {
    await expect(reservarNumero(t2, userId, serieT1))
      .rejects.toThrow('Série fiscal não encontrada neste inquilino');
  });
});

describe('regra 1 — rejeição mantém o número e permite reenvio', () => {
  it('a nota rejeitada conserva o mesmo número e série', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarRejeicao(t1, userId, doc.id, 'Rejeicao 225: falha no schema do XML');

    const s = await situacaoDe(t1, doc.id);
    expect(s.situacao).toBe('rejeitada');
    expect(s.motivo_rejeicao).toContain('225');

    const { rows } = await comTenant(t1, (db) =>
      db.query<{ numero: number; serie_id: string }>(
        'SELECT numero, serie_id FROM documentos_fiscais WHERE id = $1', [doc.id]));
    expect(rows[0].numero).toBe(doc.numero);
    expect(rows[0].serie_id).toBe(doc.serieId);
  });

  it('o reenvio usa o mesmo número e conta a tentativa', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarRejeicao(t1, userId, doc.id, 'CST invalido');

    const reenvio = await transmitir(t1, userId, doc.id);
    expect(reenvio.numero).toBe(doc.numero);

    const s = await situacaoDe(t1, doc.id);
    expect(s.situacao).toBe('transmitindo');
    expect(s.tentativas).toBe(2);
    // O motivo antigo é limpo: pertence à tentativa anterior.
    expect(s.motivo_rejeicao).toBeNull();
  });

  it('rejeitada e depois corrigida chega a autorizada com o número original', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarRejeicao(t1, userId, doc.id, 'NCM ausente no item 1');
    await transmitir(t1, userId, doc.id);
    await registrarAutorizacao(t1, userId, doc.id, 'PROTO-1', 'CHAVE-1');

    const { rows } = await comTenant(t1, (db) =>
      db.query<{ situacao: string; numero: number; protocolo: string }>(
        'SELECT situacao, numero, protocolo FROM documentos_fiscais WHERE id = $1', [doc.id]));
    expect(rows[0]).toMatchObject({
      situacao: 'autorizada', numero: doc.numero, protocolo: 'PROTO-1',
    });
  });

  it('a rejeição não gera pedido de inutilização por si só', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarRejeicao(t1, userId, doc.id, 'Erro qualquer de validacao');
    expect(await numeroInutilizado(t1, serieT1, doc.numero)).toBe(false);
  });
});

describe('regra 2 — emissão abandonada exige inutilização', () => {
  it('inutilizar marca o documento e registra a faixa', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await inutilizar(t1, userId, doc.id, JUSTIFICATIVA);

    expect((await situacaoDe(t1, doc.id)).situacao).toBe('inutilizada');
    expect(await numeroInutilizado(t1, serieT1, doc.numero)).toBe(true);

    const { rows } = await comTenant(t1, (db) =>
      db.query<{ numero_inicial: number; numero_final: number; justificativa: string }>(
        `SELECT numero_inicial, numero_final, justificativa FROM inutilizacoes
         WHERE serie_id = $1 AND numero_inicial = $2`, [serieT1, doc.numero]));
    expect(rows[0].numero_inicial).toBe(doc.numero);
    expect(rows[0].numero_final).toBe(doc.numero);
  });

  it('funciona a partir de uma nota rejeitada e abandonada', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarRejeicao(t1, userId, doc.id, 'Erro que nao da para corrigir');
    await inutilizar(t1, userId, doc.id, JUSTIFICATIVA);
    expect(await numeroInutilizado(t1, serieT1, doc.numero)).toBe(true);
  });

  it('exige justificativa com o mínimo da SEFAZ', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await expect(inutilizar(t1, userId, doc.id, 'curta'))
      .rejects.toThrow(`ao menos ${JUSTIFICATIVA_MIN} caracteres`);
    expect((await situacaoDe(t1, doc.id)).situacao).toBe('reservado');
  });

  it('nota autorizada se cancela, não se inutiliza', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarAutorizacao(t1, userId, doc.id, 'PROTO-2', 'CHAVE-2');
    await expect(inutilizar(t1, userId, doc.id, JUSTIFICATIVA))
      .rejects.toThrow(/cancelamento, não a inutilização/);
  });
});

describe('regra 3 — número inutilizado nunca é reutilizado', () => {
  it('transmitir um documento inutilizado é recusado', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await inutilizar(t1, userId, doc.id, JUSTIFICATIVA);
    await expect(transmitir(t1, userId, doc.id))
      .rejects.toThrow(`Numeração ${doc.numero} foi inutilizada`);
  });

  it('inutilizar duas vezes é recusado', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await inutilizar(t1, userId, doc.id, JUSTIFICATIVA);
    await expect(inutilizar(t1, userId, doc.id, JUSTIFICATIVA))
      .rejects.toThrow(/já foi inutilizada/);
  });

  it('nenhum documento posterior recebe o número inutilizado', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await inutilizar(t1, userId, doc.id, JUSTIFICATIVA);

    for (let i = 0; i < 3; i++) {
      const novo = await reservarNumero(t1, userId, serieT1);
      expect(novo.numero).not.toBe(doc.numero);
    }
  });
});

describe('ordem do ciclo de vida', () => {
  it('não autoriza documento que não está em transmissão', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await expect(registrarAutorizacao(t1, userId, doc.id, 'P', 'C'))
      .rejects.toThrow(ErroFiscal);
  });

  it('não rejeita documento que não está em transmissão', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await expect(registrarRejeicao(t1, userId, doc.id, 'motivo'))
      .rejects.toThrow(ErroFiscal);
  });

  it('não transmite documento já autorizado', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await transmitir(t1, userId, doc.id);
    await registrarAutorizacao(t1, userId, doc.id, 'P3', 'C3');
    await expect(transmitir(t1, userId, doc.id)).rejects.toThrow(/já está autorizado/);
  });
});

describe('isolamento da fila fiscal', () => {
  it('um inquilino não altera documento do outro', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await expect(transmitir(t2, userId, doc.id))
      .rejects.toThrow('Documento fiscal não encontrado neste inquilino');
    expect((await situacaoDe(t1, doc.id)).situacao).toBe('reservado');
  });

  it('a inutilização de um inquilino não afeta a numeração do outro', async () => {
    const doc = await reservarNumero(t1, userId, serieT1);
    await inutilizar(t1, userId, doc.id, JUSTIFICATIVA);
    expect(await numeroInutilizado(t2, serieT2, doc.numero)).toBe(false);
  });
});
