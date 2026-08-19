'use server';

import { revalidatePath } from 'next/cache';
import { usuarioAtual, acessoAoTenant } from './sessao.ts';
import { avancar, transicionar, TransicaoInvalida, type StatusOS } from './os-estado.ts';
import { alternarItemChecklist } from './os.ts';

export interface EstadoAcao {
  /** Mensagem do toast (§ Interactions: toda ação confirma por toast). */
  toast?: string;
  erro?: boolean;
}

async function contexto(slug: string) {
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error('Sessão expirada');
  const tenant = await acessoAoTenant(usuario.id, slug);
  if (!tenant) throw new Error('Oficina não encontrada');
  return { usuario, tenant };
}

/**
 * Botão único de avanço de etapa (§5). `destino` só é informado pela ação
 * secundária que pula a etapa de peça (D-006); sem ele, segue a transição
 * principal da máquina de estados.
 */
export async function avancarEtapa(
  _anterior: EstadoAcao, dados: FormData,
): Promise<EstadoAcao> {
  const slug = String(dados.get('slug') ?? '');
  const osId = String(dados.get('osId') ?? '');
  const destino = dados.get('destino');

  try {
    const { usuario, tenant } = await contexto(slug);
    const r = destino
      ? await transicionar(tenant.id, usuario.id, osId, destino as StatusOS, usuario.nome)
      : await avancar(tenant.id, usuario.id, osId, usuario.nome);

    revalidatePath(`/app/${slug}/os/${r.numero}`);
    revalidatePath(`/app/${slug}/patio`);
    return { toast: `${r.numero} atualizada` };
  } catch (erro) {
    if (erro instanceof TransicaoInvalida) return { toast: erro.message, erro: true };
    return { toast: (erro as Error).message, erro: true };
  }
}

export async function alternarChecklist(
  _anterior: EstadoAcao, dados: FormData,
): Promise<EstadoAcao> {
  const slug = String(dados.get('slug') ?? '');
  const itemId = String(dados.get('itemId') ?? '');
  const numero = String(dados.get('numero') ?? '');

  try {
    const { usuario, tenant } = await contexto(slug);
    await alternarItemChecklist(tenant.id, usuario.id, itemId);
    revalidatePath(`/app/${slug}/os/${numero}`);
    return {};
  } catch (erro) {
    return { toast: (erro as Error).message, erro: true };
  }
}
