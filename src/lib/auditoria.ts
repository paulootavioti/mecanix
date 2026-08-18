/**
 * Auditoria do inquilino.
 *
 * O README exige dois registros específicos, ambos visíveis para o próprio
 * tenant:
 *   - todo acesso a ficha de cliente (usuário, tenant e horário);
 *   - toda impersonation feita pelo provedor.
 *
 * Os registros ficam em `auditoria`, que é tabela de domínio: tem tenant_id e
 * RLS. Consequência desejada — o provedor não consegue gravar auditoria "fora"
 * do tenant nem escondê-la dele, porque escrever exige assumir o contexto
 * daquele inquilino, e o inquilino lê o próprio registro.
 */
import { comContexto, comTenant, type Consulta } from '../db/client.ts';

export type AcaoAuditada =
  | 'cliente.ficha.acesso'
  | 'cliente.ficha.edicao'
  | 'provedor.impersonation.inicio'
  | 'provedor.impersonation.fim'
  | 'contexto.troca';

export interface RegistroAuditoria {
  acao: AcaoAuditada;
  entidade?: string;
  entidadeId?: string;
  detalhe?: string;
  /** Verdadeiro quando a ação partiu do provedor personificando alguém. */
  impersonacao?: boolean;
}

/** Grava um registro usando uma transação já aberta com contexto de tenant. */
export async function registrar(
  db: Consulta,
  userId: string | null,
  r: RegistroAuditoria,
): Promise<void> {
  await db.query(
    `INSERT INTO auditoria (tenant_id, user_id, acao, entidade, entidade_id, detalhe, impersonacao)
     VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2, $3, $4, $5, $6)`,
    [userId, r.acao, r.entidade ?? null, r.entidadeId ?? null,
     r.detalhe ?? null, r.impersonacao ?? false],
  );
}

/**
 * Lê a ficha de um cliente e registra o acesso na mesma transação.
 *
 * A leitura e o registro andam juntos de propósito: se o registro falhar, a
 * transação inteira volta atrás e o acesso não aconteceu. Não existe caminho
 * que devolva a ficha sem deixar rastro.
 */
export async function lerFichaCliente(
  tenantId: string,
  userId: string,
  clienteId: string,
  opcoes: { impersonacao?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  return comContexto(tenantId, userId, async (db) => {
    const { rows } = await db.query('SELECT * FROM clientes WHERE id = $1', [clienteId]);
    if (rows.length === 0) return null;

    await registrar(db, userId, {
      acao: 'cliente.ficha.acesso',
      entidade: 'clientes',
      entidadeId: clienteId,
      impersonacao: opcoes.impersonacao ?? false,
    });
    return rows[0];
  });
}

/**
 * Registra a troca de contexto entre tenants.
 *
 * Fica gravada no tenant de DESTINO — é lá que a entrada precisa ser visível.
 */
export async function registrarTrocaContexto(
  tenantDestino: string,
  userId: string,
  tenantAnterior: string | null,
): Promise<void> {
  await comContexto(tenantDestino, userId, async (db) => {
    await db.query(
      `INSERT INTO trocas_contexto (tenant_id, user_id, tenant_anterior)
       VALUES (NULLIF(current_setting('app.tenant_id', true), '')::uuid, $1, $2)`,
      [userId, tenantAnterior]);
    await registrar(db, userId, {
      acao: 'contexto.troca',
      detalhe: tenantAnterior ? `de ${tenantAnterior}` : 'entrada direta',
    });
  });
}

/**
 * Registra o início de uma impersonation do provedor ("Entrar como", §9).
 * Gravada no tenant personificado, e portanto visível na auditoria dele.
 */
export async function registrarImpersonation(
  tenantId: string,
  adminUserId: string,
  detalhe: string,
): Promise<void> {
  await comContexto(tenantId, adminUserId, async (db) => {
    await registrar(db, adminUserId, {
      acao: 'provedor.impersonation.inicio',
      detalhe,
      impersonacao: true,
    });
  });
}

export async function listarAuditoria(
  tenantId: string,
  limite = 50,
): Promise<Array<Record<string, unknown>>> {
  return comTenant(tenantId, async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM auditoria ORDER BY criado_em DESC LIMIT $1', [limite]);
    return rows;
  });
}
