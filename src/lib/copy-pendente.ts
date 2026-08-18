/**
 * Textos que o README descreve mas não transcreve.
 *
 * O README diz, por exemplo, que o wizard "emite toast explicativo" quando o
 * avanço é bloqueado — sem dar a frase. Escrever a frase aqui é inventar copy,
 * e a regra combinada é não inventar: estes textos ficam isolados, marcados, e
 * `tests/pendencias.test.ts` os lista até serem confirmados.
 *
 * São textos provisórios em uso — a tela funciona — mas não são copy revisada.
 * Substituir por lote quando o material de design chegar.
 */

export const COPY_PENDENTE = true;

/** Toasts de bloqueio do wizard (§6, "toast explicativo"). */
export const TOAST_BLOQUEIO: Readonly<Record<string, string>> = {
  sem_veiculo: 'Busque a placa do veículo para continuar',
  sem_cliente: 'Busque o CPF/CNPJ do cliente para continuar',
  carrinho_vazio: 'Adicione ao menos um item ao orçamento',
};

/**
 * Ação secundária do detalhe da OS: pular a etapa de peça e ir de "execução"
 * direto para "pronto" (D-006). O README só dá a copy do botão principal,
 * porque no protótipo a etapa era linear.
 */
export const ACAO_PULAR_PECA = 'Finalizar sem peça';

/** Lista o que ainda depende de copy revisada. */
export function pendenciasDeCopy(): string[] {
  return [
    ...Object.keys(TOAST_BLOQUEIO).map((k) => `toast de bloqueio "${k}"`),
    'ação secundária "pular etapa de peça" no detalhe da OS',
  ];
}
