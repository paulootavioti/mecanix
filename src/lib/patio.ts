/**
 * Consultas do pátio (§4 do README).
 *
 * Toda consulta roda dentro de `comTenant`, então a RLS já filtra o inquilino;
 * as queries não repetem `WHERE tenant_id = ...`. Isso é deliberado: se alguém
 * esquecer o filtro, o resultado é vazio, não vazamento.
 */
import { comTenant } from '../db/client.ts';
import type { StatusOS } from './os-estado.ts';

export interface CartaoOS {
  id: string;
  numero: string;
  status: StatusOS;
  placa: string;
  veiculo: string;
  cliente: string;
  totalCentavos: number;
  previsao: Date | null;
}

export interface KpisPatio {
  osAbertas: number;
  semAprovacao: number;
  emExecucao: number;
  aguardandoPeca: number;
  entreguesHoje: number;
  aReceberHojeCentavos: number;
}

export async function cartoesDoPatio(tenantId: string): Promise<CartaoOS[]> {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{
      id: string; numero: string; status: StatusOS; placa: string;
      marca: string; modelo: string; cliente: string;
      total_centavos: string; previsao: Date | null;
    }>(
      `SELECT o.id, o.numero, o.status, v.placa, v.marca, v.modelo,
              c.nome AS cliente, o.previsao,
              COALESCE((
                SELECT sum(i.qtd * i.unit_centavos)
                FROM os_itens i WHERE i.os_id = o.id
              ), 0) AS total_centavos
       FROM ordens_servico o
       JOIN veiculos v ON v.id = o.veiculo_id
       JOIN clientes c ON c.id = o.cliente_id
       ORDER BY o.numero`));

  return rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    status: r.status,
    placa: r.placa,
    veiculo: [r.marca, r.modelo].filter((p) => p && p !== '—').join(' ') || r.modelo,
    cliente: r.cliente,
    totalCentavos: Number(r.total_centavos),
    previsao: r.previsao,
  }));
}

export async function kpisDoPatio(tenantId: string): Promise<KpisPatio> {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<Record<string, string>>(
      `SELECT
         count(*) FILTER (WHERE status <> 'entregue')                      AS os_abertas,
         count(*) FILTER (WHERE status = 'aprovacao')                      AS sem_aprovacao,
         count(*) FILTER (WHERE status = 'execucao')                       AS em_execucao,
         count(*) FILTER (WHERE status = 'peca')                           AS aguardando_peca,
         count(*) FILTER (WHERE status = 'entregue'
                            AND abertura::date = current_date)             AS entregues_hoje
       FROM ordens_servico`));

  const { rows: valor } = await comTenant(tenantId, (db) =>
    db.query<{ total: string }>(
      `SELECT COALESCE(sum(i.qtd * i.unit_centavos), 0) AS total
       FROM ordens_servico o
       JOIN os_itens i ON i.os_id = o.id
       WHERE o.status = 'pronto'`));

  const r = rows[0];
  return {
    osAbertas: Number(r.os_abertas),
    semAprovacao: Number(r.sem_aprovacao),
    emExecucao: Number(r.em_execucao),
    aguardandoPeca: Number(r.aguardando_peca),
    entreguesHoje: Number(r.entregues_hoje),
    aReceberHojeCentavos: Number(valor[0].total),
  };
}

/** Contagem usada no badge da sidebar (§2). */
export async function osAbertas(tenantId: string): Promise<number> {
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{ n: string }>(
      "SELECT count(*) AS n FROM ordens_servico WHERE status <> 'entregue'"));
  return Number(rows[0].n);
}
