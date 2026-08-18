/**
 * Pendências de conteúdo.
 *
 * Este arquivo FALHA de propósito enquanto houver placeholder no seed.
 * É a aplicação da regra combinada: valor que não veio no pacote de design
 * fica em branco e quebra o teste, em vez de ser inventado e passar
 * despercebido até produção.
 *
 * O que falta: os nomes das oficinas 2 e 3 e os itens do catálogo de
 * peças/serviços/kits. Estavam nos protótipos `.dc.html` e nas capturas de
 * `screenshots/`, que não vieram no repositório.
 *
 * Para resolver: preencher db/seed-dados.ts e remover os marcadores.
 * Para rodar só o resto da suíte: `npx vitest run --exclude 'tests/pendencias*'`
 */
import { describe, it, expect } from 'vitest';
import { PENDENTE_DESIGN, TENANTS, PECAS, SERVICOS, KITS, TOTAL_USUARIOS } from '../db/seed-dados.ts';
import { pendenciasDeCopy } from '../src/lib/copy-pendente.ts';

function pendentes(): string[] {
  const achados: string[] = [];
  for (const t of TENANTS) if (t.nome.includes(PENDENTE_DESIGN)) achados.push(`tenant "${t.slug}" sem nome real`);
  for (const grupo of [['peca', PECAS], ['servico', SERVICOS], ['kit', KITS]] as const) {
    for (const i of grupo[1]) {
      if (i.nome.includes(PENDENTE_DESIGN)) achados.push(`${grupo[0]} ${i.codigo} sem nome real`);
    }
  }
  return achados;
}

describe('conteúdo pendente do pacote de design', () => {
  it('nenhum seed usa placeholder', () => {
    expect(pendentes(),
      'preencher db/seed-dados.ts com o conteúdo real dos protótipos').toEqual([]);
  });

  it('nenhum texto de interface está com copy provisória', () => {
    // O README descreve estes textos ("emite toast explicativo") mas não os
    // transcreve. Ficam isolados em src/lib/copy-pendente.ts até virem
    // revisados, em vez de serem inventados aqui.
    expect(pendenciasDeCopy(),
      'confirmar a copy em src/lib/copy-pendente.ts').toEqual([]);
  });
});

describe('o que já é derivável do README continua conferindo', () => {
  it('são três tenants, um por plano — MRR R$ 2.128', () => {
    expect(TENANTS).toHaveLength(3);
    expect(new Set(TENANTS.map((t) => t.plano)).size).toBe(3);
  });

  it('31 usuários com acesso, como diz a tela de login', () => {
    expect(TOTAL_USUARIOS).toBe(31);
  });

  it('as cores de tenant são as três do README', () => {
    expect(TENANTS.map((t) => t.cor))
      .toEqual(['#16181c', 'oklch(0.5 0.16 40)', 'oklch(0.5 0.13 250)']);
  });

  it('o slug "vertentes" do README está presente', () => {
    expect(TENANTS.some((t) => t.slug === 'vertentes')).toBe(true);
  });
});
