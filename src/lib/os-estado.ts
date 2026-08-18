/**
 * Máquina de estados da ordem de serviço.
 *
 * Fluxo do README (§5): aprovação → execução → peça → pronto → entregue.
 * A etapa "peça" é OPCIONAL (decisão D-006): de "execução" a OS pode ir para
 * "peça", quando falta componente, ou direto para "pronto". Quando não há
 * peça, a lista de itens do tipo peça fica vazia e o subtotal é R$ 0,00.
 *
 * As transições são declaradas em um único lugar e o avanço passa
 * obrigatoriamente por `transicionar()`, que grava o evento na linha do tempo
 * na MESMA transação — o README exige que avançar etapa escreva na timeline,
 * e separar as duas coisas abriria espaço para OS mudando de status sem
 * rastro.
 */
import type { Consulta } from '../db/client.ts';
import { comContexto } from '../db/client.ts';

export type StatusOS = 'aprovacao' | 'execucao' | 'peca' | 'pronto' | 'entregue';

export const STATUS: readonly StatusOS[] =
  ['aprovacao', 'execucao', 'peca', 'pronto', 'entregue'];

/** Transições válidas. Tudo que não estiver aqui é recusado. */
export const TRANSICOES: Readonly<Record<StatusOS, readonly StatusOS[]>> = {
  aprovacao: ['execucao'],
  // Duas saídas: com peça faltante, ou direto para pronto (D-006).
  execucao: ['peca', 'pronto'],
  peca: ['pronto'],
  pronto: ['entregue'],
  entregue: [],
};

/**
 * Rótulo do botão único de avanço, por status atual (§5, literal do README).
 * Em "entregue" o rótulo é um estado, não uma ação — o botão fica inerte.
 */
export const ROTULO_AVANCO: Readonly<Record<StatusOS, string>> = {
  aprovacao: 'Aprovar e liberar execução',
  execucao: 'Solicitar peça faltante',
  peca: 'Peça recebida · finalizar',
  pronto: 'Entregar veículo',
  entregue: 'OS encerrada',
};

/**
 * Nome de exibição da coluna do kanban (§4), na ordem das colunas.
 */
export const ROTULO_STATUS: Readonly<Record<StatusOS, string>> = {
  aprovacao: 'Aguardando aprovação',
  execucao: 'Em execução',
  peca: 'Aguardando peça',
  pronto: 'Pronto p/ entrega',
  entregue: 'Entregue',
};

/** Cor semântica de cada coluna (§4), em token do design system. */
export const COR_STATUS: Readonly<Record<StatusOS, string>> = {
  aprovacao: 'amber',
  execucao: 'blue',
  peca: 'red',
  pronto: 'green',
  entregue: 'gray',
};

/** Tint de fundo do chip de status (§ "Tints de status"). */
export const TINT_STATUS: Readonly<Record<StatusOS, string>> = {
  aprovacao: '#fdf3e3',
  execucao: '#eaf1fd',
  peca: '#fdecea',
  pronto: '#e8f5ec',
  entregue: '#f2f4f6',
};

export function ehStatus(valor: string): valor is StatusOS {
  return (STATUS as readonly string[]).includes(valor);
}

export function podeTransicionar(de: StatusOS, para: StatusOS): boolean {
  return TRANSICOES[de].includes(para);
}

/**
 * Próximo status do botão principal. Em "execução" há duas saídas válidas e
 * a principal é "peça", que é a que o README rotula no botão único.
 * A alternativa (pular para "pronto") é ação secundária — ver D-006.
 */
export function proximoStatus(de: StatusOS): StatusOS | null {
  return TRANSICOES[de][0] ?? null;
}

export function ehTerminal(status: StatusOS): boolean {
  return TRANSICOES[status].length === 0;
}

export class TransicaoInvalida extends Error {
  constructor(readonly de: StatusOS, readonly para: StatusOS) {
    const validas = TRANSICOES[de];
    super(
      validas.length === 0
        ? `A OS está em "${ROTULO_STATUS[de]}" e não avança mais.`
        : `Não é possível ir de "${ROTULO_STATUS[de]}" para "${ROTULO_STATUS[para]}".`,
    );
    this.name = 'TransicaoInvalida';
  }
}

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
