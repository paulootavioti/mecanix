/**
 * Planos, limites e matriz de funcionalidades.
 *
 * Todos os valores vêm da tabela "Planos" do README e das decisões
 * registradas em docs/DECISOES.md. Nada aqui foi arbitrado:
 *
 *   D-001 · Iniciante tem 5 usuários (o README prevalece sobre o "4" citado).
 *   D-002 · Os limites numéricos continuam valendo e bloqueiam ao exceder.
 *   D-003 · Os quatro papéis existem em todos os planos.
 *   D-004 · O recorte de features é a coluna "Destaques"; a Iniciante não emite NF-e.
 *
 * Preço anual: o README (§12) dá o desconto de 20% já calculado por plano —
 * 249→199, 589→471, 1.290→1.032. Os valores são usados como estão, não recalculados,
 * porque 249 × 0,8 = 199,20 e o preço comercial publicado é 199.
 */

export type CodigoPlano = 'iniciante' | 'intermediaria' | 'profissional';

export type Papel = 'gerente' | 'financeiro' | 'consultor' | 'tecnico';

/** Os quatro papéis existem em qualquer plano (D-003). */
export const PAPEIS: readonly Papel[] = ['gerente', 'financeiro', 'consultor', 'tecnico'];

/** `null` em um limite significa ilimitado. */
export interface LimitesPlano {
  maxUsuarios: number | null;
  maxCnpjs: number | null;
  maxArmazenamentoBytes: number | null;
  maxOsMes: number | null;
}

export interface Plano extends LimitesPlano {
  codigo: CodigoPlano;
  nome: string;
  precoMensalCentavos: number;
  precoAnualCentavos: number;
  ordem: number;
  features: readonly string[];
}

const GB = 1024 * 1024 * 1024;

/** Funcionalidades da Iniciante — coluna "Destaques" do README. */
const FEATURES_INICIANTE = [
  'cadastros',
  'ordens_servico',
  'orcamentos',
  'estoque_minimo',
  'caixa',
  'nfce_nfse',
  'portal_basico',
] as const;

/** A Intermediária acrescenta ("+" no README) — inclui a NF-e, ausente na Iniciante. */
const FEATURES_INTERMEDIARIA = [
  'xml_compra',
  'cotacao',
  'contas_pagar_receber',
  'boletos',
  'nfe_conjugada_devolucao',
  'checklist',
  'comissao',
  'agenda',
  'portal_aprovacao_agendamento',
] as const;

/** A Profissional acrescenta — pacote cheio. */
const FEATURES_PROFISSIONAL = [
  'multiempresa_transferencia',
  'dre_balancete_fluxo',
  'integracoes_orcamentacao_catalogos',
  'portal_whitelabel_dominio',
  'schema_dedicado',
  'auditoria_completa',
] as const;

export const PLANOS: Readonly<Record<CodigoPlano, Plano>> = {
  iniciante: {
    codigo: 'iniciante',
    nome: 'Iniciante',
    precoMensalCentavos: 24900,
    precoAnualCentavos: 19900,
    maxUsuarios: 5,
    maxCnpjs: 1,
    maxArmazenamentoBytes: 20 * GB,
    maxOsMes: 300,
    ordem: 1,
    features: FEATURES_INICIANTE,
  },
  intermediaria: {
    codigo: 'intermediaria',
    nome: 'Intermediária',
    precoMensalCentavos: 58900,
    precoAnualCentavos: 47100,
    maxUsuarios: 15,
    maxCnpjs: 2,
    maxArmazenamentoBytes: 50 * GB,
    maxOsMes: 1500,
    ordem: 2,
    features: [...FEATURES_INICIANTE, ...FEATURES_INTERMEDIARIA],
  },
  profissional: {
    codigo: 'profissional',
    nome: 'Profissional',
    precoMensalCentavos: 129000,
    precoAnualCentavos: 103200,
    maxUsuarios: null,
    maxCnpjs: null,
    // "100 GB+" no README é lido como piso contratado; é o valor aplicado (D-002).
    maxArmazenamentoBytes: 100 * GB,
    maxOsMes: null,
    ordem: 3,
    features: [
      ...FEATURES_INICIANTE,
      ...FEATURES_INTERMEDIARIA,
      ...FEATURES_PROFISSIONAL,
    ],
  },
};

export type RecursoLimitado = 'usuarios' | 'cnpjs' | 'armazenamento' | 'os_mes';

const LIMITE_POR_RECURSO: Record<RecursoLimitado, keyof LimitesPlano> = {
  usuarios: 'maxUsuarios',
  cnpjs: 'maxCnpjs',
  armazenamento: 'maxArmazenamentoBytes',
  os_mes: 'maxOsMes',
};

export class LimiteDoPlanoExcedido extends Error {
  constructor(
    readonly recurso: RecursoLimitado,
    readonly plano: CodigoPlano,
    readonly limite: number,
    readonly usoAtual: number,
  ) {
    super(
      `Limite do plano ${PLANOS[plano].nome} atingido: ${recurso} (${usoAtual}/${limite}).`,
    );
    this.name = 'LimiteDoPlanoExcedido';
  }
}

export function temFeature(plano: CodigoPlano, feature: string): boolean {
  return PLANOS[plano].features.includes(feature);
}

/**
 * Verifica se cabe mais `quantidade` do recurso. Lança quando estoura.
 *
 * `usoAtual` é o consumo antes da operação. O limite é inclusivo: um plano de
 * 5 usuários aceita o 5º e recusa o 6º.
 */
export function exigirDentroDoLimite(
  plano: CodigoPlano,
  recurso: RecursoLimitado,
  usoAtual: number,
  quantidade = 1,
): void {
  const limite = PLANOS[plano][LIMITE_POR_RECURSO[recurso]];
  if (limite === null) return; // ilimitado
  if (usoAtual + quantidade > limite) {
    throw new LimiteDoPlanoExcedido(recurso, plano, limite, usoAtual);
  }
}

export function cabeNoLimite(
  plano: CodigoPlano,
  recurso: RecursoLimitado,
  usoAtual: number,
  quantidade = 1,
): boolean {
  try {
    exigirDentroDoLimite(plano, recurso, usoAtual, quantidade);
    return true;
  } catch {
    return false;
  }
}
