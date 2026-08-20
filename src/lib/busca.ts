/**
 * Buscas do wizard (§6): veículo por placa e cliente por CPF/CNPJ.
 *
 * A busca por documento tem DOIS ESTÁGIOS, e a separação é a regra de sigilo
 * comercial mais importante do produto:
 *
 *   (a) base interna DO PRÓPRIO TENANT — pode trazer histórico, veículos,
 *       condições comerciais, limite de crédito e títulos em atraso;
 *   (b) consulta pública externa — só dados cadastrais públicos.
 *
 * O estágio (b) só entra quando (a) não encontra nada. Jamais existe um
 * terceiro caminho lendo a base de outro inquilino: a RLS impede no banco, e
 * o tipo `DadosPublicos` impede na fronteira do adaptador, por não ter onde
 * carregar histórico.
 */
import { comTenant } from '../db/client.ts';
import { consultaPublica, type DadosPublicos } from './integracoes/consulta-publica.ts';
import { normalizarPlaca, normalizarDocumento, placaValida, documentoValido } from './orcamento.ts';

export class BuscaInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'BuscaInvalida';
  }
}

export interface VeiculoEncontrado {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: string | null;
  cor: string | null;
  combustivel: string | null;
  chassi: string | null;
  renavam: string | null;
  km: number | null;
  clienteId: string;
  clienteNome: string;
  /** Quantas OS anteriores este veículo tem NESTE inquilino. */
  osAnteriores: number;
}

export async function buscarVeiculoPorPlaca(
  tenantId: string, entrada: string,
): Promise<VeiculoEncontrado | null> {
  if (!placaValida(entrada)) throw new BuscaInvalida('Informe uma placa válida');
  const placa = normalizarPlaca(entrada);

  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{
      id: string; placa: string; marca: string; modelo: string; ano: string | null;
      cor: string | null; combustivel: string | null; chassi: string | null;
      renavam: string | null; km: number | null; cliente_id: string;
      cliente_nome: string; os_anteriores: string;
    }>(
      `SELECT v.id, v.placa, v.marca, v.modelo, v.ano, v.cor, v.combustivel,
              v.chassi, v.renavam, v.km, v.cliente_id, c.nome AS cliente_nome,
              (SELECT count(*) FROM ordens_servico o WHERE o.veiculo_id = v.id) AS os_anteriores
       FROM veiculos v
       JOIN clientes c ON c.id = v.cliente_id
       WHERE v.placa = $1`, [placa]));

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, placa: r.placa, marca: r.marca, modelo: r.modelo, ano: r.ano,
    cor: r.cor, combustivel: r.combustivel, chassi: r.chassi, renavam: r.renavam,
    km: r.km, clienteId: r.cliente_id, clienteNome: r.cliente_nome,
    osAnteriores: Number(r.os_anteriores),
  };
}

/** De onde vieram os dados — a tela precisa deixar isso explícito ao operador. */
export type OrigemCliente = 'base_interna' | 'consulta_publica';

export interface ClienteEncontrado {
  origem: OrigemCliente;
  cpfCnpj: string;
  nome: string;
  tipo: 'pf' | 'pj';
  situacao: string | null;
  cidade: string | null;
  /** Só preenchidos quando a origem é a base interna deste inquilino. */
  contato?: string | null;
  email?: string | null;
  limiteCreditoCentavos?: number;
  titulosEmAtraso?: number;
  clienteId?: string;
}

export async function buscarClientePorDocumento(
  tenantId: string, entrada: string,
): Promise<ClienteEncontrado | null> {
  if (!documentoValido(entrada)) {
    throw new BuscaInvalida('Informe um CPF com 11 dígitos ou CNPJ com 14');
  }
  const doc = normalizarDocumento(entrada);

  // Estágio (a): base interna deste inquilino.
  const { rows } = await comTenant(tenantId, (db) =>
    db.query<{
      id: string; cpf_cnpj: string; nome: string; tipo: 'pf' | 'pj';
      situacao: string | null; cidade: string | null; contato: string | null;
      email: string | null; limite_credito_centavos: string;
    }>(
      `SELECT id, cpf_cnpj, nome, tipo, situacao, cidade, contato, email,
              limite_credito_centavos
       FROM clientes WHERE cpf_cnpj = $1`, [doc]));

  if (rows.length > 0) {
    const c = rows[0];
    return {
      origem: 'base_interna',
      clienteId: c.id,
      cpfCnpj: c.cpf_cnpj,
      nome: c.nome,
      tipo: c.tipo,
      situacao: c.situacao,
      cidade: c.cidade,
      contato: c.contato,
      email: c.email,
      limiteCreditoCentavos: Number(c.limite_credito_centavos),
      titulosEmAtraso: 0,
    };
  }

  // Estágio (b): consulta pública. Só dados cadastrais.
  const publico: DadosPublicos | null = await consultaPublica.executar(tenantId, doc);
  if (!publico) return null;

  return {
    origem: 'consulta_publica',
    cpfCnpj: publico.cpfCnpj,
    nome: publico.razaoSocial,
    tipo: publico.tipo,
    situacao: publico.situacao,
    cidade: `${publico.cidade}/${publico.uf}`,
  };
}

export interface ItemCatalogo {
  id: string;
  tipo: 'peca' | 'servico' | 'kit';
  codigo: string;
  nome: string;
  precoCentavos: number;
  /** Peça: saldo em estoque e custo médio. Serviço: tempo em horas. */
  saldo?: number;
  custoMedioCentavos?: number;
  tempoHoras?: number;
}

/** Catálogo do inquilino para as abas Kits / Peças / Serviços do passo 3. */
export async function catalogoDoTenant(tenantId: string): Promise<ItemCatalogo[]> {
  return comTenant(tenantId, async (db) => {
    const [pecas, servicos, kits] = await Promise.all([
      db.query<{ id: string; codigo: string; nome: string; preco_centavos: string;
                 saldo: number; custo_medio_centavos: string }>(
        `SELECT id, codigo, nome, preco_centavos, saldo, custo_medio_centavos
         FROM pecas ORDER BY nome`),
      db.query<{ id: string; codigo: string; nome: string; preco_centavos: string;
                 tempo_horas: string }>(
        `SELECT id, codigo, nome, preco_centavos, tempo_horas FROM servicos ORDER BY nome`),
      db.query<{ id: string; codigo: string; nome: string; preco_centavos: string }>(
        `SELECT id, codigo, nome, preco_centavos FROM kits ORDER BY nome`),
    ]);

    return [
      ...kits.rows.map((k) => ({
        id: k.id, tipo: 'kit' as const, codigo: k.codigo, nome: k.nome,
        precoCentavos: Number(k.preco_centavos),
      })),
      ...pecas.rows.map((p) => ({
        id: p.id, tipo: 'peca' as const, codigo: p.codigo, nome: p.nome,
        precoCentavos: Number(p.preco_centavos), saldo: p.saldo,
        custoMedioCentavos: Number(p.custo_medio_centavos),
      })),
      ...servicos.rows.map((s) => ({
        id: s.id, tipo: 'servico' as const, codigo: s.codigo, nome: s.nome,
        precoCentavos: Number(s.preco_centavos), tempoHoras: Number(s.tempo_horas),
      })),
    ];
  });
}
