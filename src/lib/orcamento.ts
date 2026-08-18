/**
 * Orçamento: totais, margem e regras de avanço do wizard (§6 do README).
 *
 * Todo dinheiro é inteiro em centavos. Nenhum cálculo financeiro passa por
 * ponto flutuante — 0.1 + 0.2 não é 0.3, e num ERP isso vira divergência de
 * centavo em nota fiscal.
 */

/** Custo/hora da mão de obra: R$ 148,00 (§3 e §6 do README). */
export const CUSTO_HORA_CENTAVOS = 14800;

/** Validade do orçamento: 7 dias (§6, passo 4). */
export const VALIDADE_DIAS = 7;

export type TipoItem = 'peca' | 'servico';

export interface ItemCarrinho {
  tipo: TipoItem;
  codigo: string;
  nome: string;
  qtd: number;
  /** Preço unitário cobrado do cliente, em centavos. */
  unitCentavos: number;
  /** Peça: custo médio de aquisição, em centavos. */
  custoUnitCentavos?: number;
  /** Serviço: tempo de mão de obra, em horas. */
  tempoHoras?: number;
}

export interface Totais {
  pecasCentavos: number;
  servicosCentavos: number;
  totalCentavos: number;
  custoCentavos: number;
  /** Lucro bruto em centavos: total cobrado menos custo direto. */
  lucroCentavos: number;
  /**
   * Margem estimada em pontos percentuais, ou `null` quando o total é zero
   * — margem sobre venda zero não é 0%, é indefinida (divisão por zero).
   */
  margemPct: number | null;
}

/**
 * Custo direto de um item (D-007):
 *   - peça: custo de aquisição (custo médio do estoque) × quantidade;
 *   - serviço: custo/hora da mão de obra × tempo × quantidade.
 *
 * Item sem custo informado entra como custo zero, o que infla a margem.
 * É deliberado: preferir superestimar a margem a esconder o item do total.
 */
function custoDoItem(item: ItemCarrinho): number {
  if (item.tipo === 'peca') {
    return Math.round((item.custoUnitCentavos ?? 0) * item.qtd);
  }
  return Math.round(CUSTO_HORA_CENTAVOS * (item.tempoHoras ?? 0) * item.qtd);
}

export function calcularTotais(itens: readonly ItemCarrinho[]): Totais {
  let pecasCentavos = 0;
  let servicosCentavos = 0;
  let custoCentavos = 0;

  for (const item of itens) {
    const venda = Math.round(item.unitCentavos * item.qtd);
    if (item.tipo === 'peca') pecasCentavos += venda;
    else servicosCentavos += venda;
    custoCentavos += custoDoItem(item);
  }

  const totalCentavos = pecasCentavos + servicosCentavos;
  const lucroCentavos = totalCentavos - custoCentavos;

  return {
    pecasCentavos,
    servicosCentavos,
    totalCentavos,
    custoCentavos,
    lucroCentavos,
    // margem % = (venda − custo) ÷ venda × 100
    margemPct: totalCentavos === 0
      ? null
      : Math.round((lucroCentavos / totalCentavos) * 1000) / 10,
  };
}

// ---------------------------------------------------------------------------
// Validações do wizard
// ---------------------------------------------------------------------------

/**
 * Placa: o README exige ao menos 5 caracteres e dá a mensagem literal.
 * Aceita o formato antigo (ABC1234) e o Mercosul (ABC1D23); a validação de
 * comprimento mínimo é a que o README especifica para o bloqueio.
 */
export const MSG_PLACA_INVALIDA = 'Informe uma placa válida';

export function normalizarPlaca(entrada: string): string {
  return entrada.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function placaValida(entrada: string): boolean {
  return normalizarPlaca(entrada).length >= 5;
}

/** CPF/CNPJ: o README valida por quantidade de dígitos — 11 ou 14. */
export function normalizarDocumento(entrada: string): string {
  return entrada.replace(/\D/g, '');
}

export function documentoValido(entrada: string): boolean {
  const d = normalizarDocumento(entrada);
  return d.length === 11 || d.length === 14;
}

export function tipoPessoa(entrada: string): 'pf' | 'pj' | null {
  const d = normalizarDocumento(entrada);
  if (d.length === 11) return 'pf';
  if (d.length === 14) return 'pj';
  return null;
}

export type PassoWizard = 1 | 2 | 3 | 4;

export interface EstadoWizard {
  veiculoEncontrado: boolean;
  clienteEncontrado: boolean;
  carrinho: readonly ItemCarrinho[];
}

export type MotivoBloqueio = 'sem_veiculo' | 'sem_cliente' | 'carrinho_vazio';

export interface ResultadoAvanco {
  permitido: boolean;
  motivo?: MotivoBloqueio;
}

/**
 * Regras de avanço do §6: sem veículo buscado, sem cliente buscado ou com
 * carrinho vazio, o botão "Continuar" bloqueia e emite toast explicativo.
 */
export function podeAvancar(passo: PassoWizard, estado: EstadoWizard): ResultadoAvanco {
  if (passo === 1 && !estado.veiculoEncontrado) {
    return { permitido: false, motivo: 'sem_veiculo' };
  }
  if (passo === 2 && !estado.clienteEncontrado) {
    return { permitido: false, motivo: 'sem_cliente' };
  }
  if (passo === 3 && estado.carrinho.length === 0) {
    return { permitido: false, motivo: 'carrinho_vazio' };
  }
  return { permitido: true };
}

/** Data de validade a partir da emissão. */
export function validadeAPartirDe(emissao: Date): Date {
  const d = new Date(emissao);
  d.setDate(d.getDate() + VALIDADE_DIAS);
  return d;
}
