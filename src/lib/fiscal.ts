/**
 * Numeração fiscal e ciclo de vida do documento (decisão D-008).
 *
 * Três regras, e a ordem entre elas importa:
 *
 *  1. Rejeição NÃO devolve o número à faixa. A nota rejeitada não foi gravada
 *     como autorizada na SEFAZ, mas o número já foi consumido da sequência.
 *     O procedimento é corrigir o XML e reenviar com o MESMO número e série.
 *  2. Se a emissão for abandonada, o número fica vago e quebra a sequência.
 *     É obrigatório pedir Inutilização de Numeração à SEFAZ — sem isso, o
 *     buraco na sequência caracteriza omissão de receita.
 *  3. Número inutilizado nunca volta a ser usado.
 *
 * A alocação usa `FOR UPDATE` na linha da série: sem o lock, duas emissões
 * simultâneas leriam o mesmo `proximo_numero` e tentariam gravar o mesmo
 * número. A restrição UNIQUE salvaria do dado errado, mas ao custo de um erro
 * em produção; o lock resolve antes.
 */
import { comContexto, comTenant, type Consulta } from '../db/client.ts';

export type ModeloFiscal = 'nfe' | 'nfse' | 'nfce' | 'sat';

export type SituacaoFiscal =
  | 'reservado' | 'transmitindo' | 'autorizada'
  | 'rejeitada' | 'cancelada' | 'inutilizada';

/** Rótulos da coluna SITUAÇÃO na tela Fiscal (§7). */
export const ROTULO_SITUACAO: Readonly<Record<SituacaoFiscal, string>> = {
  reservado: 'Reservado',
  transmitindo: 'Em processamento',
  autorizada: 'Autorizada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  inutilizada: 'Inutilizada',
};

/** Justificativa de inutilização: a SEFAZ exige no mínimo 15 caracteres. */
export const JUSTIFICATIVA_MIN = 15;

export class ErroFiscal extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroFiscal';
  }
}

export interface DocumentoFiscal {
  id: string;
  numero: number;
  serieId: string;
  situacao: SituacaoFiscal;
  tentativas: number;
}

/**
 * Reserva o próximo número da série e cria o documento.
 *
 * O número sai de `series_fiscais.proximo_numero`, que só avança — nunca
 * retrocede. Isso, somado à regra 3, garante que numeração inutilizada não
 * seja reemitida: o contador já passou dela.
 */
export async function reservarNumero(
  tenantId: string,
  userId: string,
  serieId: string,
  dados: { osId?: string; destinatario?: string; valorCentavos?: number } = {},
): Promise<DocumentoFiscal> {
  return comContexto(tenantId, userId, async (db) => {
    const { rows } = await db.query<{ proximo_numero: number }>(
      'SELECT proximo_numero FROM series_fiscais WHERE id = $1 FOR UPDATE', [serieId]);
    if (rows.length === 0) throw new ErroFiscal('Série fiscal não encontrada neste inquilino');

    const numero = rows[0].proximo_numero;
    await db.query(
      'UPDATE series_fiscais SET proximo_numero = proximo_numero + 1 WHERE id = $1', [serieId]);

    const { rows: [doc] } = await db.query<{ id: string }>(
      `INSERT INTO documentos_fiscais
         (tenant_id, serie_id, numero, os_id, destinatario, valor_centavos, situacao)
       VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2, $3, $4, $5, 'reservado')
       RETURNING id`,
      [serieId, numero, dados.osId ?? null, dados.destinatario ?? null,
       dados.valorCentavos ?? 0]);

    return { id: doc.id, numero, serieId, situacao: 'reservado', tentativas: 0 };
  });
}

async function carregar(db: Consulta, documentoId: string): Promise<DocumentoFiscal> {
  const { rows } = await db.query<{
    id: string; numero: number; serie_id: string;
    situacao: SituacaoFiscal; tentativas: number;
  }>(
    `SELECT id, numero, serie_id, situacao, tentativas
     FROM documentos_fiscais WHERE id = $1 FOR UPDATE`, [documentoId]);
  if (rows.length === 0) throw new ErroFiscal('Documento fiscal não encontrado neste inquilino');
  const d = rows[0];
  return { id: d.id, numero: d.numero, serieId: d.serie_id, situacao: d.situacao, tentativas: d.tentativas };
}

async function mudarSituacao(
  db: Consulta, documentoId: string, situacao: SituacaoFiscal,
  extra: { motivo?: string | null; protocolo?: string | null; chave?: string | null } = {},
): Promise<void> {
  await db.query(
    `UPDATE documentos_fiscais
     SET situacao = $2, motivo_rejeicao = $3, protocolo = COALESCE($4, protocolo),
         chave = COALESCE($5, chave), atualizado_em = now()
     WHERE id = $1`,
    [documentoId, situacao, extra.motivo ?? null, extra.protocolo ?? null, extra.chave ?? null]);
}

/** Envia à SEFAZ (ou reenvia após correção, mantendo número e série). */
export async function transmitir(
  tenantId: string, userId: string, documentoId: string,
): Promise<DocumentoFiscal> {
  return comContexto(tenantId, userId, async (db) => {
    const doc = await carregar(db, documentoId);

    if (doc.situacao === 'inutilizada') {
      // Regra 3: número inutilizado não volta a ser usado.
      throw new ErroFiscal(
        `Numeração ${doc.numero} foi inutilizada e não pode ser reutilizada.`);
    }
    if (doc.situacao === 'autorizada') {
      throw new ErroFiscal(`Documento ${doc.numero} já está autorizado.`);
    }
    if (doc.situacao === 'cancelada') {
      throw new ErroFiscal(`Documento ${doc.numero} está cancelado.`);
    }

    await db.query(
      `UPDATE documentos_fiscais
       SET situacao = 'transmitindo', tentativas = tentativas + 1,
           motivo_rejeicao = NULL, atualizado_em = now()
       WHERE id = $1`, [documentoId]);

    return { ...doc, situacao: 'transmitindo', tentativas: doc.tentativas + 1 };
  });
}

export async function registrarAutorizacao(
  tenantId: string, userId: string, documentoId: string,
  protocolo: string, chave: string,
): Promise<void> {
  await comContexto(tenantId, userId, async (db) => {
    const doc = await carregar(db, documentoId);
    if (doc.situacao !== 'transmitindo') {
      throw new ErroFiscal('Só um documento em transmissão pode ser autorizado.');
    }
    await mudarSituacao(db, documentoId, 'autorizada', { protocolo, chave });
  });
}

/**
 * Regra 1: a rejeição mantém o número reservado neste documento.
 * O caminho normal a seguir é corrigir o XML e chamar `transmitir()` de novo.
 */
export async function registrarRejeicao(
  tenantId: string, userId: string, documentoId: string, motivo: string,
): Promise<void> {
  await comContexto(tenantId, userId, async (db) => {
    const doc = await carregar(db, documentoId);
    if (doc.situacao !== 'transmitindo') {
      throw new ErroFiscal('Só um documento em transmissão pode ser rejeitado.');
    }
    await mudarSituacao(db, documentoId, 'rejeitada', { motivo });
  });
}

/**
 * Regra 2: abandona a emissão e formaliza a inutilização da numeração.
 *
 * As duas coisas acontecem na mesma transação de propósito. Marcar o documento
 * como abandonado sem registrar a inutilização deixaria um buraco silencioso na
 * sequência — exatamente o que a SEFAZ trata como omissão de receita.
 */
export async function inutilizar(
  tenantId: string, userId: string, documentoId: string, justificativa: string,
): Promise<void> {
  if (justificativa.trim().length < JUSTIFICATIVA_MIN) {
    throw new ErroFiscal(
      `A justificativa de inutilização precisa de ao menos ${JUSTIFICATIVA_MIN} caracteres.`);
  }

  await comContexto(tenantId, userId, async (db) => {
    const doc = await carregar(db, documentoId);
    if (doc.situacao === 'autorizada') {
      throw new ErroFiscal(
        `Documento ${doc.numero} está autorizado; o caminho é o cancelamento, não a inutilização.`);
    }
    if (doc.situacao === 'inutilizada') {
      throw new ErroFiscal(`Numeração ${doc.numero} já foi inutilizada.`);
    }

    await mudarSituacao(db, documentoId, 'inutilizada');
    await db.query(
      `INSERT INTO inutilizacoes
         (tenant_id, serie_id, numero_inicial, numero_final, justificativa)
       VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2, $2, $3)`,
      [doc.serieId, doc.numero, justificativa.trim()]);
  });
}

/** Um número está inutilizado se cair dentro de alguma faixa registrada. */
export async function numeroInutilizado(
  tenantId: string, serieId: string, numero: number,
): Promise<boolean> {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{ n: string }>(
      `SELECT count(*) AS n FROM inutilizacoes
       WHERE serie_id = $1 AND $2 BETWEEN numero_inicial AND numero_final`,
      [serieId, numero]));
  return rows[0].n !== '0';
}
