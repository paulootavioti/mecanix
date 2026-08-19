/**
 * Consulta pública de CPF/CNPJ (Receita) — estágio (b) da busca por documento.
 *
 * O que este adaptador pode devolver é deliberadamente estreito: apenas dados
 * cadastrais PÚBLICOS. Nada de histórico, valores praticados, limite de
 * crédito ou títulos — isso é carteira de oficina e só sai da base interna do
 * próprio inquilino.
 */
import { type Adaptador, ErroIntegracao } from './tipos.ts';

/** Só campos públicos. O tipo é a barreira: não há onde encaixar histórico. */
export interface DadosPublicos {
  cpfCnpj: string;
  razaoSocial: string;
  tipo: 'pf' | 'pj';
  situacao: string;
  cidade: string;
  uf: string;
}

export type ConsultaPublica = Adaptador<string, DadosPublicos | null>;

/**
 * Implementação mock, usada enquanto não há credencial real.
 *
 * Deriva os dados do próprio documento, de forma determinística, para o
 * desenvolvimento ser reproduzível. Não consulta base nenhuma — em especial,
 * não consulta a base de nenhum inquilino.
 */
export const consultaPublicaMock: ConsultaPublica = {
  provedor: 'receita-mock',

  async executar(_tenantId, documento) {
    const doc = documento.replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) {
      throw new ErroIntegracao('receita-mock', 'Documento deve ter 11 ou 14 dígitos');
    }

    // Latência simulada apenas fora de teste, para a tela exercitar o estado
    // de carregamento sem tornar a suíte lenta.
    if (process.env.NODE_ENV !== 'test') {
      await new Promise((r) => setTimeout(r, 550));
    }

    const pj = doc.length === 14;
    return {
      cpfCnpj: doc,
      razaoSocial: pj ? `Empresa ${doc.slice(0, 8)}` : `Pessoa ${doc.slice(0, 6)}`,
      tipo: pj ? 'pj' : 'pf',
      situacao: 'Ativa',
      cidade: 'São Paulo',
      uf: 'SP',
    };
  },
};

/**
 * Adaptador em uso. Trocar aqui pela implementação real quando houver
 * credencial — quem chama não muda.
 */
export const consultaPublica: ConsultaPublica = consultaPublicaMock;
