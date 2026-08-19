/** Formatação pt-BR. Centraliza para não haver dois jeitos de mostrar dinheiro. */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
});

export function reais(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/** Forma abreviada usada nos KPIs: R$ 9,2k · R$ 344,1k. */
export function reaisCurto(centavos: number): string {
  const v = centavos / 100;
  if (Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`;
  }
  return MOEDA.format(v);
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function dataHora(d: Date): string {
  return DATA_HORA.format(d);
}
