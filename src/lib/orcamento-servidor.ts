/**
 * Geração da OS a partir do orçamento (§6, passo 4).
 */
import { comContexto } from '../db/client.ts';
import { registrarEvento } from './os-estado.ts';
import { exigirDentroDoLimite, type CodigoPlano } from './planos.ts';
import type { ItemCarrinho } from './orcamento.ts';

export interface OSGerada {
  id: string;
  numero: string;
}

/** Competência corrente no formato AAAA-MM, usada nos contadores de uso. */
function competencia(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Cria a OS, seus itens e o evento de abertura, em uma transação.
 *
 * O número é o maior existente NO INQUILINO mais um — a numeração é por
 * tenant e nunca colide entre inquilinos, garantido também pelo índice
 * UNIQUE (tenant_id, numero).
 *
 * O limite de OS/mês do plano é verificado com a linha de uso travada
 * (`FOR UPDATE`): sem o lock, duas gerações simultâneas leriam o mesmo
 * contador e ambas passariam, estourando o limite em um.
 */
export async function gerarOSdoOrcamento(
  tenantId: string,
  userId: string,
  plano: CodigoPlano,
  dados: {
    veiculoId: string;
    clienteId: string;
    itens: readonly ItemCarrinho[];
    consultor: string;
  },
): Promise<OSGerada> {
  if (dados.itens.length === 0) {
    throw new Error('O orçamento precisa de ao menos um item');
  }

  return comContexto(tenantId, userId, async (db) => {
    const comp = competencia();

    await db.query(
      `INSERT INTO uso_tenant (tenant_id, competencia)
       VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1)
       ON CONFLICT (tenant_id, competencia) DO NOTHING`, [comp]);

    const { rows: [uso] } = await db.query<{ os_criadas: number }>(
      'SELECT os_criadas FROM uso_tenant WHERE competencia = $1 FOR UPDATE', [comp]);

    // Lança LimiteDoPlanoExcedido e desfaz a transação inteira.
    exigirDentroDoLimite(plano, 'os_mes', uso.os_criadas);

    const { rows: [ultimo] } = await db.query<{ maior: number | null }>(
      `SELECT max(CAST(substring(numero from '[0-9]+$') AS integer)) AS maior
       FROM ordens_servico WHERE numero ~ '^OS-[0-9]+$'`);
    const numero = `OS-${(ultimo.maior ?? 0) + 1}`;

    const { rows: [os] } = await db.query<{ id: string }>(
      `INSERT INTO ordens_servico
         (tenant_id, numero, cliente_id, veiculo_id, status, consultor)
       VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid,
               $1, $2, $3, 'aprovacao', $4)
       RETURNING id`,
      [numero, dados.clienteId, dados.veiculoId, dados.consultor]);

    for (const item of dados.itens) {
      await db.query(
        `INSERT INTO os_itens (tenant_id, os_id, tipo, codigo, nome, qtd, unit_centavos)
         VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2, $3, $4, $5, $6)`,
        [os.id, item.tipo, item.codigo, item.nome, item.qtd, item.unitCentavos]);
    }

    await registrarEvento(db, os.id, {
      tipo: 'abertura',
      descricao: 'Orçamento gerado e publicado no portal',
      quem: dados.consultor,
      cor: 'green',
    });

    await db.query(
      'UPDATE uso_tenant SET os_criadas = os_criadas + 1 WHERE competencia = $1', [comp]);

    return { id: os.id, numero };
  });
}
