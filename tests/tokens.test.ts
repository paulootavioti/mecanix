/**
 * Fidelidade dos design tokens.
 *
 * Relê o README a cada execução e confere que todo valor declarado na seção
 * "Design Tokens" existe em src/styles/tokens.css. Se alguém trocar um hex no
 * CSS "porque ficou melhor", ou se o README mudar e o CSS não acompanhar, a
 * suíte acusa — a fidelidade deixa de depender de revisão manual.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const readme = readFileSync('README.md', 'utf8');
const css = readFileSync('src/styles/tokens.css', 'utf8');

/** Recorta uma seção do README pelo título, até o próximo título de mesmo nível. */
function secao(titulo: string): string {
  const i = readme.indexOf(titulo);
  expect(i, `seção "${titulo}" não encontrada no README`).toBeGreaterThan(-1);
  const resto = readme.slice(i + titulo.length);
  const fim = resto.search(/\n## /);
  return fim === -1 ? resto : resto.slice(0, fim);
}

const tokens = secao('## Design Tokens');

function unicos(valores: RegExpMatchArray | null): string[] {
  return [...new Set(valores ?? [])];
}

describe('cores', () => {
  const hexes = unicos(tokens.match(/#[0-9a-f]{6}\b/gi)).map((h) => h.toLowerCase());
  const oklchs = unicos(tokens.match(/oklch\([^)]+\)/g));

  it('o README declara a quantidade esperada de cores', () => {
    // Guarda contra a própria extração: se o regex parar de casar, o teste
    // vira vacuamente verdadeiro sem esta verificação.
    expect(hexes.length).toBeGreaterThan(25);
    expect(oklchs.length).toBeGreaterThan(7);
  });

  it.each(hexes)('o hex %s do README está em tokens.css', (hex) => {
    expect(css.toLowerCase()).toContain(hex);
  });

  it.each(oklchs)('o oklch %s do README está em tokens.css', (cor) => {
    expect(css).toContain(cor);
  });

  it('tokens.css não inventa cor fora do README', () => {
    const noCss = unicos(css.match(/#[0-9a-f]{6}\b/gi)).map((h) => h.toLowerCase());
    // O gradiente do placeholder de foto e os overlays vêm de outras seções
    // do README (§5 e "Responsividade"), não da tabela de tokens.
    const deOutrasSecoes = unicos(readme.match(/#[0-9a-f]{6}\b/gi)).map((h) => h.toLowerCase());
    const inventadas = noCss.filter((h) => !deOutrasSecoes.includes(h));
    expect(inventadas).toEqual([]);
  });
});

describe('sombras', () => {
  // Os valores estão entre crases no README, o que é bem mais confiável do
  // que tentar reconhecer a forma da sombra por regex.
  const sombras = unicos(tokens.match(/`[^`]*rgba\([^`]*`/g))
    .map((s) => s.replace(/`/g, '').trim());

  it('o README declara as cinco sombras', () => {
    expect(sombras.length).toBe(5);
  });

  it.each(sombras)('a sombra "%s" está em tokens.css', (sombra) => {
    // Normaliza o espaçamento depois das vírgulas do rgba().
    const norm = (s: string) => s.replace(/,\s*/g, ',').replace(/\s+/g, ' ');
    expect(norm(css)).toContain(norm(sombra));
  });
});

describe('tipografia', () => {
  it('usa Archivo com fallback Helvetica, sans-serif', () => {
    expect(tokens).toContain('Archivo');
    expect(tokens).toContain('Helvetica, sans-serif');
    expect(css).toContain("'Archivo', Helvetica, sans-serif");
  });

  it('usa IBM Plex Mono como fonte mono', () => {
    expect(tokens).toContain('IBM Plex Mono');
    expect(css).toContain("'IBM Plex Mono'");
  });
});

describe('espaçamento', () => {
  it('a escala do CSS é exatamente a do README', () => {
    const linha = tokens.match(/Escala de espaçamento: ([^\n]+)/);
    expect(linha).not.toBeNull();
    const doReadme = linha![1].match(/\d+/g)!.map(Number);
    const doCss = [...css.matchAll(/--spacing-(\d+):/g)].map((m) => Number(m[1]));
    expect(doCss.sort((a, b) => a - b)).toEqual(doReadme.sort((a, b) => a - b));
  });
});

describe('alvos de toque', () => {
  it('o README exige 44–46px em mobile e tablet', () => {
    expect(tokens).toContain('44–46px');
    expect(css).toContain('--touch-mobile: 44px');
    expect(css).toContain('--touch-mobile-max: 46px');
  });

  it('o mínimo denso de desktop é 38px', () => {
    expect(tokens).toContain('38px');
    expect(css).toContain('--touch-dense: 38px');
  });
});

describe('pontos de quebra', () => {
  const responsividade = secao('## Responsividade');

  it('o README fixa phone < 760, tablet 760–1079, desktop ≥ 1080', () => {
    expect(responsividade).toContain('< 760px');
    expect(responsividade).toContain('760–1079px');
    expect(responsividade).toContain('≥ 1080px');
  });
});
