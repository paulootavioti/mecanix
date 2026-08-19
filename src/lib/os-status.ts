/**
 * Máquina de estados da ordem de serviço — parte pura.
 *
 * Este módulo NÃO importa o cliente do banco de propósito: componentes de
 * cliente precisam dos rótulos e do grafo de transições, e qualquer import
 * transitivo de `pg` arrastaria o driver do Postgres para o bundle do
 * navegador (o build quebra em "Can't resolve 'tls'").
 * As funções que tocam o banco ficam em os-estado.ts.
 *
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
