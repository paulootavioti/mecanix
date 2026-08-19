'use server';

import { usuarioAtual, acessoAoTenant } from './sessao.ts';
import {
  buscarVeiculoPorPlaca, buscarClientePorDocumento, BuscaInvalida,
  type VeiculoEncontrado, type ClienteEncontrado,
} from './busca.ts';
import { gerarOSdoOrcamento } from './orcamento-servidor.ts';
import { LimiteDoPlanoExcedido, type CodigoPlano } from './planos.ts';
import type { ItemCarrinho } from './orcamento.ts';

async function contexto(slug: string) {
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error('Sessão expirada');
  const tenant = await acessoAoTenant(usuario.id, slug);
  if (!tenant) throw new Error('Oficina não encontrada');
  return { usuario, tenant };
}

export interface RespostaBuscaVeiculo {
  veiculo?: VeiculoEncontrado;
  erro?: string;
  naoEncontrado?: boolean;
}

/**
 * Busca real, com erro tratado. O protótipo simulava 550ms de latência; aqui
 * há uma consulta de verdade, e a tela mostra estado de carregamento enquanto
 * a promessa não resolve.
 */
export async function buscarVeiculo(
  slug: string, placa: string,
): Promise<RespostaBuscaVeiculo> {
  try {
    const { tenant } = await contexto(slug);
    const veiculo = await buscarVeiculoPorPlaca(tenant.id, placa);
    if (!veiculo) return { naoEncontrado: true };
    return { veiculo };
  } catch (erro) {
    if (erro instanceof BuscaInvalida) return { erro: erro.message };
    return { erro: 'Não foi possível consultar a base de veículos. Tente de novo.' };
  }
}

export interface RespostaBuscaCliente {
  cliente?: ClienteEncontrado;
  erro?: string;
  naoEncontrado?: boolean;
}

export async function buscarCliente(
  slug: string, documento: string,
): Promise<RespostaBuscaCliente> {
  try {
    const { tenant } = await contexto(slug);
    const cliente = await buscarClientePorDocumento(tenant.id, documento);
    if (!cliente) return { naoEncontrado: true };
    return { cliente };
  } catch (erro) {
    if (erro instanceof BuscaInvalida) return { erro: erro.message };
    return { erro: 'Não foi possível consultar o documento. Tente de novo.' };
  }
}

export interface RespostaGerarOS {
  numero?: string;
  erro?: string;
}

export async function gerarOS(
  slug: string,
  veiculoId: string,
  clienteId: string,
  itens: ItemCarrinho[],
): Promise<RespostaGerarOS> {
  try {
    const { usuario, tenant } = await contexto(slug);
    const os = await gerarOSdoOrcamento(
      tenant.id, usuario.id, tenant.plano as CodigoPlano,
      { veiculoId, clienteId, itens, consultor: usuario.nome },
    );
    return { numero: os.numero };
  } catch (erro) {
    if (erro instanceof LimiteDoPlanoExcedido) return { erro: erro.message };
    return { erro: (erro as Error).message };
  }
}
