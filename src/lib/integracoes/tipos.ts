/**
 * Interface comum dos adaptadores de integração.
 *
 * Todo provedor externo (Cília, Audatex, Soma, I360, Peça Aí, PartsLink24,
 * Catálogo Fraga, Stone, boleto, SEFAZ, SAT/MF-e, consulta pública de
 * documento) entra por aqui. Duas regras valem para todos:
 *
 *   - credenciais são POR TENANT, nunca compartilhadas;
 *   - enquanto não houver credencial real, roda a implementação mock, que é
 *     plugável e trocada por configuração, sem alterar quem chama.
 */
export interface Adaptador<Entrada, Saida> {
  readonly provedor: string;
  /** Executa a chamada. Recebe o tenant para resolver a credencial certa. */
  executar(tenantId: string, entrada: Entrada): Promise<Saida>;
}

export class ErroIntegracao extends Error {
  constructor(readonly provedor: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroIntegracao';
  }
}
