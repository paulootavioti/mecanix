/**
 * Detalhe da ordem de serviço (§5 do README).
 */
import { comContexto } from '../db/client.ts';
import { registrar } from './auditoria.ts';
import type { StatusOS } from './os-estado.ts';

export interface ItemOS {
  id: string;
  tipo: 'peca' | 'servico';
  codigo: string | null;
  nome: string;
  qtd: number;
  unitCentavos: number;
  totalCentavos: number;
}

export interface EventoOS {
  id: string;
  tipo: string;
  descricao: string;
  quem: string;
  cor: string | null;
  criadoEm: Date;
}

export interface ItemChecklist {
  id: string;
  descricao: string;
  marcado: boolean;
}

export interface DetalheOS {
  id: string;
  numero: string;
  status: StatusOS;
  consultor: string | null;
  tecnico: string | null;
  box: string | null;
  abertura: Date;
  previsao: Date | null;
  kmEntrada: number | null;
  veiculo: {
    placa: string; marca: string; modelo: string; ano: string | null;
    cor: string | null; combustivel: string | null; chassi: string | null;
    renavam: string | null; km: number | null;
  };
  cliente: {
    id: string; nome: string; tipo: 'pf' | 'pj'; cpfCnpj: string;
    contato: string | null; email: string | null; acessoPortal: boolean;
  };
  itens: ItemOS[];
  eventos: EventoOS[];
  checklist: ItemChecklist[];
  pecasCentavos: number;
  servicosCentavos: number;
  totalCentavos: number;
}

/**
 * Carrega a OS pelo número, dentro do inquilino.
 *
 * Registra o acesso à ficha do cliente na MESMA transação: a tela mostra nome,
 * documento e contato, então abrir a OS é acessar a ficha. O README exige que
 * todo acesso fique registrado com usuário, tenant e horário — e como o
 * registro compartilha a transação, não existe caminho que exiba os dados sem
 * deixar rastro.
 */
export async function detalheDaOS(
  tenantId: string, userId: string, numero: string,
): Promise<DetalheOS | null> {
  return comContexto(tenantId, userId, async (db) => {
    const { rows } = await db.query<Record<string, never> & {
      id: string; numero: string; status: StatusOS;
      consultor: string | null; tecnico: string | null; box: string | null;
      abertura: Date; previsao: Date | null; km_entrada: number | null;
      placa: string; marca: string; modelo: string; ano: string | null;
      v_cor: string | null; combustivel: string | null; chassi: string | null;
      renavam: string | null; km: number | null;
      cliente_id: string; cliente_nome: string; cliente_tipo: 'pf' | 'pj';
      cpf_cnpj: string; contato: string | null; email: string | null;
      acesso_portal: boolean;
    }>(
      `SELECT o.id, o.numero, o.status, o.consultor, o.tecnico, o.box,
              o.abertura, o.previsao, o.km_entrada,
              v.placa, v.marca, v.modelo, v.ano, v.cor AS v_cor,
              v.combustivel, v.chassi, v.renavam, v.km,
              c.id AS cliente_id, c.nome AS cliente_nome, c.tipo AS cliente_tipo,
              c.cpf_cnpj, c.contato, c.email, c.acesso_portal
       FROM ordens_servico o
       JOIN veiculos v ON v.id = o.veiculo_id
       JOIN clientes c ON c.id = o.cliente_id
       WHERE o.numero = $1`, [numero]);

    if (rows.length === 0) return null;
    const r = rows[0];

    const [itens, eventos, checklist] = await Promise.all([
      db.query<{ id: string; tipo: 'peca' | 'servico'; codigo: string | null;
                 nome: string; qtd: string; unit_centavos: string }>(
        `SELECT id, tipo, codigo, nome, qtd, unit_centavos FROM os_itens
         WHERE os_id = $1 ORDER BY tipo DESC, nome`, [r.id]),
      db.query<{ id: string; tipo: string; descricao: string; quem: string;
                 cor: string | null; criado_em: Date }>(
        `SELECT id, tipo, descricao, quem, cor, criado_em FROM os_eventos
         WHERE os_id = $1 ORDER BY criado_em`, [r.id]),
      db.query<{ id: string; descricao: string; marcado: boolean }>(
        `SELECT id, descricao, marcado FROM checklist_itens
         WHERE os_id = $1 ORDER BY ordem`, [r.id]),
    ]);

    await registrar(db, userId, {
      acao: 'cliente.ficha.acesso',
      entidade: 'clientes',
      entidadeId: r.cliente_id,
      detalhe: `via ${r.numero}`,
    });

    const listaItens: ItemOS[] = itens.rows.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      codigo: i.codigo,
      nome: i.nome,
      qtd: Number(i.qtd),
      unitCentavos: Number(i.unit_centavos),
      totalCentavos: Math.round(Number(i.qtd) * Number(i.unit_centavos)),
    }));

    const soma = (tipo: 'peca' | 'servico') =>
      listaItens.filter((i) => i.tipo === tipo).reduce((s, i) => s + i.totalCentavos, 0);
    const pecasCentavos = soma('peca');
    const servicosCentavos = soma('servico');

    return {
      id: r.id, numero: r.numero, status: r.status,
      consultor: r.consultor, tecnico: r.tecnico, box: r.box,
      abertura: r.abertura, previsao: r.previsao, kmEntrada: r.km_entrada,
      veiculo: {
        placa: r.placa, marca: r.marca, modelo: r.modelo, ano: r.ano,
        cor: r.v_cor, combustivel: r.combustivel, chassi: r.chassi,
        renavam: r.renavam, km: r.km,
      },
      cliente: {
        id: r.cliente_id, nome: r.cliente_nome, tipo: r.cliente_tipo,
        cpfCnpj: r.cpf_cnpj, contato: r.contato, email: r.email,
        acessoPortal: r.acesso_portal,
      },
      itens: listaItens,
      eventos: eventos.rows.map((e) => ({
        id: e.id, tipo: e.tipo, descricao: e.descricao,
        quem: e.quem, cor: e.cor, criadoEm: e.criado_em,
      })),
      checklist: checklist.rows,
      pecasCentavos,
      servicosCentavos,
      totalCentavos: pecasCentavos + servicosCentavos,
    };
  });
}

/** Marca ou desmarca um item do checklist de entrada. */
export async function alternarItemChecklist(
  tenantId: string, userId: string, itemId: string,
): Promise<boolean> {
  return comContexto(tenantId, userId, async (db) => {
    const { rows } = await db.query<{ marcado: boolean }>(
      `UPDATE checklist_itens SET marcado = NOT marcado
       WHERE id = $1 RETURNING marcado`, [itemId]);
    if (rows.length === 0) throw new Error('Item não encontrado neste inquilino');
    return rows[0].marcado;
  });
}

/** Formata o documento: 000.000.000-00 ou 00.000.000/0000-00. */
export function formatarDocumento(doc: string): string {
  if (doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if (doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}
