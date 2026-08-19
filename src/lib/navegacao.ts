/**
 * Navegação da sidebar (§2 do README): 10 itens, na ordem exata.
 *
 * A cor do ponto de cada item usa a paleta semântica dos tokens.
 *
 * Sobre os badges: o README mostra cinco números (12, 31, 14, 8, 6) mas não
 * diz a qual item cada um pertence. Em vez de fixar números no código, o
 * badge é CALCULADO do banco quando a contagem é bem definida — hoje o de
 * "Pátio & OS", que é o total de OS abertas e casa com o "OS abertas 12" do
 * §4. Os demais entram junto com as telas que definem o que contar.
 */
export interface ItemNavegacao {
  slug: string;
  rotulo: string;
  cor: string;
  /** Chave da contagem exibida no badge, quando houver. */
  contagem?: 'os_abertas';
}

export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  { slug: '', rotulo: 'Dashboard gerencial', cor: 'var(--color-blue)' },
  { slug: 'patio', rotulo: 'Pátio & OS', cor: 'var(--color-amber)', contagem: 'os_abertas' },
  { slug: 'orcamentos', rotulo: 'Orçamentos', cor: 'var(--color-green)' },
  { slug: 'cadastros', rotulo: 'Cadastros', cor: 'var(--color-teal)' },
  { slug: 'estoque', rotulo: 'Estoque', cor: 'var(--color-violet)' },
  { slug: 'financeiro', rotulo: 'Financeiro', cor: 'var(--color-green)' },
  { slug: 'fiscal', rotulo: 'Fiscal', cor: 'var(--color-red)' },
  { slug: 'relacionamento', rotulo: 'Relacionamento', cor: 'var(--color-teal)' },
  { slug: 'integracoes', rotulo: 'Integrações', cor: 'var(--color-blue)' },
  { slug: 'paineis', rotulo: 'Painéis de setor', cor: 'var(--color-violet)' },
];

/** Placeholder da busca global (§2, literal do README). */
export const PLACEHOLDER_BUSCA = 'Placa, OS, cliente, CPF/CNPJ ou peça';

/** Nota do dropdown de troca de tenant (§2). */
export const NOTA_TROCA_TENANT =
  'Trocar de oficina recarrega dados, estoque, séries fiscais e permissões.';
