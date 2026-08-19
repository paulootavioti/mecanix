import estilos from '../styles/login.module.css';

/**
 * Coluna escura do §1. Os três números são os do README e descrevem a
 * plataforma, não o inquilino — por isso não vêm do banco.
 */
const ESTATISTICAS = [
  { valor: '3', legenda: 'oficinas atendidas' },
  { valor: '31', legenda: 'usuários com acesso' },
  { valor: '99,9%', legenda: 'de uptime em 90 dias' },
];

export function PainelMarca() {
  return (
    <section className={estilos.colunaEscura}>
      <div className={estilos.marca}>
        <div className={estilos.marcaQuadrado} />
        <div>
          <div className={estilos.marcaNome}>Mecanix Cloud</div>
          <div className={estilos.marcaKicker}>ERP multi-tenant para oficinas</div>
        </div>
      </div>

      <h2 className={estilos.manchete}>
        Uma instância. Um código. Cada oficina em seu próprio mundo.
      </h2>

      <p className={estilos.subtitulo}>
        Cada oficina é um inquilino com <code className="mono">tenant_id</code> próprio:
        cadastros, veículos, histórico, preços e séries fiscais ficam isolados no banco,
        e nenhuma consulta atravessa a fronteira do inquilino.
      </p>

      <div className={estilos.estatisticas}>
        {ESTATISTICAS.map((e) => (
          <div key={e.legenda} className={estilos.estatistica}>
            <span className={estilos.estatisticaValor}>{e.valor}</span>
            <span className={estilos.estatisticaLegenda}>{e.legenda}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
