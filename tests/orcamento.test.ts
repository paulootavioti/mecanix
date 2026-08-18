/**
 * Wizard de orçamento (§6) — validações e cálculo de margem (D-007).
 */
import { describe, it, expect } from 'vitest';
import {
  calcularTotais, placaValida, normalizarPlaca, documentoValido,
  normalizarDocumento, tipoPessoa, podeAvancar, validadeAPartirDe,
  CUSTO_HORA_CENTAVOS, VALIDADE_DIAS, MSG_PLACA_INVALIDA,
  type ItemCarrinho,
} from '../src/lib/orcamento.ts';

const peca = (o: Partial<ItemCarrinho> = {}): ItemCarrinho => ({
  tipo: 'peca', codigo: 'PC', nome: 'peça', qtd: 1,
  unitCentavos: 10000, custoUnitCentavos: 6000, ...o,
});
const servico = (o: Partial<ItemCarrinho> = {}): ItemCarrinho => ({
  tipo: 'servico', codigo: 'SV', nome: 'serviço', qtd: 1,
  unitCentavos: 20000, tempoHoras: 1, ...o,
});

describe('totais do carrinho', () => {
  it('separa peças de serviços e soma o total', () => {
    const t = calcularTotais([peca(), peca({ qtd: 2 }), servico()]);
    expect(t.pecasCentavos).toBe(30000);
    expect(t.servicosCentavos).toBe(20000);
    expect(t.totalCentavos).toBe(50000);
  });

  it('carrinho vazio zera tudo e deixa a margem indefinida', () => {
    const t = calcularTotais([]);
    expect(t.totalCentavos).toBe(0);
    expect(t.custoCentavos).toBe(0);
    // Margem sobre venda zero é divisão por zero, não 0%.
    expect(t.margemPct).toBeNull();
  });
});

describe('margem estimada (D-007)', () => {
  it('confere com o exemplo: venda R$ 500, custo R$ 300 → 40%', () => {
    const t = calcularTotais([
      peca({ unitCentavos: 50000, custoUnitCentavos: 30000 }),
    ]);
    expect(t.totalCentavos).toBe(50000);
    expect(t.custoCentavos).toBe(30000);
    expect(t.margemPct).toBe(40);
  });

  it('o custo do serviço é custo/hora × tempo × quantidade', () => {
    const t = calcularTotais([servico({ unitCentavos: 40000, tempoHoras: 2 })]);
    expect(t.custoCentavos).toBe(CUSTO_HORA_CENTAVOS * 2);
    expect(t.custoCentavos).toBe(29600);
    // (40000 − 29600) ÷ 40000 = 26%
    expect(t.margemPct).toBe(26);
  });

  it('soma custo de peça e de mão de obra no mesmo carrinho', () => {
    const t = calcularTotais([
      peca({ unitCentavos: 30000, custoUnitCentavos: 20000 }),
      servico({ unitCentavos: 20000, tempoHoras: 1 }),
    ]);
    expect(t.custoCentavos).toBe(20000 + 14800);
    expect(t.totalCentavos).toBe(50000);
    expect(t.lucroCentavos).toBe(15200);
    expect(t.margemPct).toBe(30.4);
  });

  it('margem negativa quando o custo supera a venda', () => {
    const t = calcularTotais([peca({ unitCentavos: 10000, custoUnitCentavos: 15000 })]);
    expect(t.margemPct).toBe(-50);
  });

  it('item sem custo informado conta como custo zero', () => {
    const t = calcularTotais([{ tipo: 'peca', codigo: 'X', nome: 'x', qtd: 1, unitCentavos: 10000 }]);
    expect(t.custoCentavos).toBe(0);
    expect(t.margemPct).toBe(100);
  });

  it('trabalha em centavos inteiros, sem erro de ponto flutuante', () => {
    const t = calcularTotais([
      peca({ unitCentavos: 10, custoUnitCentavos: 0, qtd: 3 }),
      peca({ unitCentavos: 20, custoUnitCentavos: 0, qtd: 3 }),
    ]);
    expect(Number.isInteger(t.totalCentavos)).toBe(true);
    expect(t.totalCentavos).toBe(90);
  });
});

describe('validação de placa (§6, passo 1)', () => {
  it('menos de 5 caracteres é inválida', () => {
    expect(placaValida('RQK7')).toBe(false);
    expect(placaValida('')).toBe(false);
  });

  it('5 ou mais é válida', () => {
    expect(placaValida('RQK7D')).toBe(true);
  });

  it('aceita o formato antigo e o Mercosul', () => {
    expect(placaValida('ABC1234')).toBe(true);
    expect(placaValida('ABC1D23')).toBe(true);
  });

  it('normaliza para maiúsculas sem separador', () => {
    expect(normalizarPlaca('rqk-7d22')).toBe('RQK7D22');
  });

  it('a mensagem é a literal do README', () => {
    expect(MSG_PLACA_INVALIDA).toBe('Informe uma placa válida');
  });
});

describe('validação de CPF/CNPJ (§6, passo 2)', () => {
  it('aceita 11 e 14 dígitos', () => {
    expect(documentoValido('12345678901')).toBe(true);
    expect(documentoValido('12345678000199')).toBe(true);
  });

  it('recusa qualquer outra quantidade', () => {
    for (const d of ['', '123', '1234567890', '123456789012', '123456789001999']) {
      expect(documentoValido(d), d).toBe(false);
    }
  });

  it('ignora pontuação ao contar dígitos', () => {
    expect(documentoValido('123.456.789-01')).toBe(true);
    expect(normalizarDocumento('12.345.678/0001-99')).toBe('12345678000199');
  });

  it('deduz PF de 11 dígitos e PJ de 14', () => {
    expect(tipoPessoa('12345678901')).toBe('pf');
    expect(tipoPessoa('12345678000199')).toBe('pj');
    expect(tipoPessoa('123')).toBeNull();
  });
});

describe('regras de avanço do wizard', () => {
  const vazio = { veiculoEncontrado: false, clienteEncontrado: false, carrinho: [] };

  it('passo 1 bloqueia sem veículo buscado', () => {
    expect(podeAvancar(1, vazio)).toEqual({ permitido: false, motivo: 'sem_veiculo' });
  });

  it('passo 2 bloqueia sem cliente buscado', () => {
    expect(podeAvancar(2, { ...vazio, veiculoEncontrado: true }))
      .toEqual({ permitido: false, motivo: 'sem_cliente' });
  });

  it('passo 3 bloqueia com carrinho vazio', () => {
    expect(podeAvancar(3, { veiculoEncontrado: true, clienteEncontrado: true, carrinho: [] }))
      .toEqual({ permitido: false, motivo: 'carrinho_vazio' });
  });

  it('libera cada passo quando a condição é atendida', () => {
    expect(podeAvancar(1, { ...vazio, veiculoEncontrado: true }).permitido).toBe(true);
    expect(podeAvancar(2, { ...vazio, clienteEncontrado: true }).permitido).toBe(true);
    expect(podeAvancar(3, { ...vazio, carrinho: [peca()] }).permitido).toBe(true);
    expect(podeAvancar(4, vazio).permitido).toBe(true);
  });
});

describe('validade do orçamento', () => {
  it('são 7 dias a partir da emissão', () => {
    expect(VALIDADE_DIAS).toBe(7);
    const emissao = new Date('2026-08-18T10:00:00Z');
    expect(validadeAPartirDe(emissao).toISOString().slice(0, 10)).toBe('2026-08-25');
  });

  it('não altera a data recebida', () => {
    const emissao = new Date('2026-08-18T10:00:00Z');
    validadeAPartirDe(emissao);
    expect(emissao.toISOString()).toBe('2026-08-18T10:00:00.000Z');
  });
});
