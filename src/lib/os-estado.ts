/**
 * Máquina de estados da ordem de serviço — operações no banco.
 *
 * O grafo, os rótulos e os predicados ficam em os-status.ts, que é puro e
 * pode ser importado por componentes de cliente. Aqui ficam as funções que
 * abrem transação.
 */
import type { Consulta } from '../db/client.ts';
import { comContexto } from '../db/client.ts';
import {
  COR_STATUS, ROTULO_STATUS, TRANSICOES, podeTransicionar, proximoStatus,
  TransicaoInvalida, type StatusOS,
} from './os-status.ts';

export * from './os-status.ts';

/** Descrição do evento gravado na linha do tempo a cada transição. */
function descricaoEvento(de: StatusOS, para: StatusOS): string {
  return `${ROTULO_STATUS[de]} → ${ROTULO_STATUS[para]}`;
}

export interface ResultadoTransicao {
  numero: string;
  de: StatusOS;
  para: StatusOS;
}

/**
 * Executa a transição e grava o evento na linha do tempo, atomicamente.
 *
 * A leitura do status usa `FOR UPDATE`: sem o lock, dois avanços simultâneos
 * poderiam ler o mesmo status de origem e ambos passarem na validação,
 * gravando dois eventos para uma transição só.
 */
export async function transicionar(
  tenantId: string,
  userId: string,
  osId: string,
  para: StatusOS,
  quem: string,
): Promise<ResultadoTransicao> {
  return comContexto(tenantId, userId, async (db) => {
    const { rows } = await db.query<{ status: StatusOS; numero: string }>(
      'SELECT status, numero FROM ordens_servico WHERE id = $1 FOR UPDATE', [osId]);
    if (rows.length === 0) throw new Error('OS não encontrada neste inquilino');

    const de = rows[0].status;
    if (!podeTransicionar(de, para)) throw new TransicaoInvalida(de, para);

    await db.query('UPDATE ordens_servico SET status = $1 WHERE id = $2', [para, osId]);
    await registrarEvento(db, osId, {
      tipo: 'status',
      descricao: descricaoEvento(de, para),
      quem,
      cor: COR_STATUS[para],
    });

    return { numero: rows[0].numero, de, para };
  });
}

/** Avança pelo botão principal, sem escolher o destino. */
export async function avancar(
  tenantId: string, userId: string, osId: string, quem: string,
): Promise<ResultadoTransicao> {
  return comContexto(tenantId, userId, async (db) => {
    const { rows } = await db.query<{ status: StatusOS }>(
      'SELECT status FROM ordens_servico WHERE id = $1 FOR UPDATE', [osId]);
    if (rows.length === 0) throw new Error('OS não encontrada neste inquilino');
    const proximo = proximoStatus(rows[0].status);
    if (proximo === null) throw new TransicaoInvalida(rows[0].status, rows[0].status);
    return proximo;
  }).then((proximo) => transicionar(tenantId, userId, osId, proximo, quem));
}

export interface Evento {
  tipo: string;
  descricao: string;
  quem: string;
  cor?: string;
}

/**
 * Grava um evento na linha do tempo dentro de uma transação já em contexto.
 *
 * O README lista o que precisa aparecer aqui: avanço de etapa, publicação de
 * orçamento, emissão de NF, mensagem do portal, agendamento e pesquisa de
 * satisfação. Todos passam por esta função.
 */
export async function registrarEvento(
  db: Consulta, osId: string, e: Evento,
): Promise<void> {
  await db.query(
    `INSERT INTO os_eventos (tenant_id, os_id, tipo, descricao, quem, cor)
     VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2, $3, $4, $5)`,
    [osId, e.tipo, e.descricao, e.quem, e.cor ?? null],
  );
}
