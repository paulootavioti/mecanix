/**
 * Dados de seed de desenvolvimento.
 *
 * O que é DERIVADO do README (não mexer sem mudar o README):
 *   - três tenants, um em cada plano — o console mostra "MRR R$ 2.128",
 *     que é exatamente 249 + 589 + 1.290;
 *   - 31 usuários com acesso, na tela de login;
 *   - OS-8390 a OS-8412 (23 ordens);
 *   - o slug "vertentes", único citado no README (`vertentes.mecanix.app`).
 *
 * O que está PENDENTE DE DESIGN (marcado com PENDENTE_DESIGN):
 *   os nomes das oficinas 2 e 3 e os itens do catálogo estavam nos protótipos
 *   `.dc.html` e nas capturas de `screenshots/`, que não vieram no pacote.
 *   Estes valores são placeholders explícitos, não invenção de copy: troque
 *   este arquivo quando o material chegar. O teste tests/seed-pendencias.test.ts
 *   lista o que ainda está pendente.
 */

export const PENDENTE_DESIGN = 'PENDENTE_DESIGN' as const;

export interface TenantSeed {
  slug: string;
  nome: string;
  unidade: string;
  cor: string;
  plano: 'iniciante' | 'intermediaria' | 'profissional';
  cnpj: string;
  usuarios: number;
}

/** Cores de tenant: exatamente as três do README ("Cores de tenant"). */
export const TENANTS: TenantSeed[] = [
  {
    slug: 'vertentes',
    nome: 'Vertentes',
    unidade: 'Matriz',
    cor: '#16181c',
    plano: 'profissional',
    cnpj: '12345678000190',
    usuarios: 14,
  },
  {
    slug: 'oficina-dois',
    nome: `${PENDENTE_DESIGN} · Oficina 2`,
    unidade: 'Matriz',
    cor: 'oklch(0.5 0.16 40)',
    plano: 'intermediaria',
    cnpj: '23456789000181',
    usuarios: 11,
  },
  {
    slug: 'oficina-tres',
    nome: `${PENDENTE_DESIGN} · Oficina 3`,
    unidade: 'Matriz',
    cor: 'oklch(0.5 0.13 250)',
    plano: 'iniciante',
    cnpj: '34567890000172',
    usuarios: 6,
  },
];

/** 14 + 11 + 6 = 31 usuários com acesso, como diz a tela de login. */
export const TOTAL_USUARIOS = TENANTS.reduce((s, t) => s + t.usuarios, 0);

/** OS-8390 a OS-8412 — 23 ordens. */
export const OS_PRIMEIRA = 8390;
export const OS_ULTIMA = 8412;

/**
 * Distribuição pelas colunas do kanban, ajustada aos KPIs do pátio:
 * "OS abertas 12 (4 sem aprovação) · Em execução 5 · Aguardando peça 2".
 * 4 + 5 + 2 + 1 = 12 abertas; as 11 restantes já foram entregues.
 */
export const DISTRIBUICAO_OS: Record<string, number> = {
  aprovacao: 4,
  execucao: 5,
  peca: 2,
  pronto: 1,
  entregue: 11,
};

export interface ItemCatalogo {
  codigo: string;
  nome: string;
  precoCentavos: number;
}

/** PENDENTE_DESIGN — os itens reais estavam no protótipo. */
export const PECAS: ItemCatalogo[] = [
  { codigo: 'PC-001', nome: `${PENDENTE_DESIGN} · peça 1`, precoCentavos: 12900 },
  { codigo: 'PC-002', nome: `${PENDENTE_DESIGN} · peça 2`, precoCentavos: 8450 },
  { codigo: 'PC-003', nome: `${PENDENTE_DESIGN} · peça 3`, precoCentavos: 31200 },
];

/** PENDENTE_DESIGN. O custo/hora R$ 148,00 vem do README e é real. */
export const CUSTO_HORA_CENTAVOS = 14800;

export const SERVICOS: ItemCatalogo[] = [
  { codigo: 'SV-001', nome: `${PENDENTE_DESIGN} · serviço 1`, precoCentavos: 22000 },
  { codigo: 'SV-002', nome: `${PENDENTE_DESIGN} · serviço 2`, precoCentavos: 45000 },
];

export const KITS: ItemCatalogo[] = [
  { codigo: 'KT-001', nome: `${PENDENTE_DESIGN} · kit 1`, precoCentavos: 68000 },
];

/**
 * Checklist de entrada — o §5 fala em 6 itens com contador "3/6", mas não
 * transcreve os textos. PENDENTE_DESIGN, como o restante do conteúdo que
 * estava nos protótipos.
 */
export const CHECKLIST_ENTRADA: string[] = [
  `${PENDENTE_DESIGN} · item 1`,
  `${PENDENTE_DESIGN} · item 2`,
  `${PENDENTE_DESIGN} · item 3`,
  `${PENDENTE_DESIGN} · item 4`,
  `${PENDENTE_DESIGN} · item 5`,
  `${PENDENTE_DESIGN} · item 6`,
];

/** O README mostra o contador em "3/6": três marcados. */
export const CHECKLIST_MARCADOS = 3;
