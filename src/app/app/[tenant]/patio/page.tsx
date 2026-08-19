import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { usuarioAtual, acessoAoTenant } from '../../../../lib/sessao.ts';
import { cartoesDoPatio, kpisDoPatio, type CartaoOS } from '../../../../lib/patio.ts';
import { STATUS, ROTULO_STATUS, COR_STATUS, type StatusOS } from '../../../../lib/os-status.ts';
import { reais, reaisCurto, dataHora } from '../../../../lib/formato.ts';
import estilos from '../../../../styles/patio.module.css';

export const metadata = { title: 'Pátio & OS · Mecanix Cloud' };

export default async function PaginaPatio({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  const tenant = await acessoAoTenant(usuario.id, slug);
  if (!tenant) notFound();

  const [cartoes, kpis] = await Promise.all([
    cartoesDoPatio(tenant.id),
    kpisDoPatio(tenant.id),
  ]);

  const porStatus = (s: StatusOS) => cartoes.filter((c) => c.status === s);

  return (
    <>
      <div className={estilos.cabecalho}>
        <h1 className={estilos.titulo}>Pátio &amp; ordens de serviço</h1>
        <span className={estilos.subtitulo}>{tenant.nome} · {tenant.unidade}</span>
      </div>

      <div className={estilos.kpis}>
        <Kpi
          rotulo="OS abertas"
          valor={String(kpis.osAbertas)}
          sublinha={`${kpis.semAprovacao} sem aprovação`}
        />
        <Kpi rotulo="Em execução" valor={String(kpis.emExecucao)} sublinha="boxes em produção" />
        <Kpi rotulo="Aguardando peça" valor={String(kpis.aguardandoPeca)} sublinha="itens a separar" />
        <Kpi
          rotulo="Entregas hoje"
          valor={String(kpis.entreguesHoje)}
          sublinha={`${reaisCurto(kpis.aReceberHojeCentavos)} a receber`}
        />
      </div>

      <div className={estilos.kanban}>
        {STATUS.map((status) => {
          const daColuna = porStatus(status);
          return (
            <section key={status} className={estilos.coluna}>
              <header className={estilos.colunaCabecalho}>
                <span
                  className={estilos.colunaPonto}
                  style={{ background: `var(--color-${COR_STATUS[status]})` }}
                />
                <h2 className={estilos.colunaNome}>{ROTULO_STATUS[status]}</h2>
                <span className={estilos.colunaContagem}>{daColuna.length}</span>
              </header>

              {daColuna.length === 0 ? (
                <p className={estilos.vazia}>nenhuma OS</p>
              ) : (
                daColuna.map((c) => (
                  <CartaoDeOS key={c.id} cartao={c} base={`/app/${slug}`} />
                ))
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Kpi({ rotulo, valor, sublinha }: { rotulo: string; valor: string; sublinha: string }) {
  return (
    <div className={estilos.kpi}>
      <span className={estilos.kpiRotulo}>{rotulo}</span>
      <span className={estilos.kpiValor}>{valor}</span>
      <span className={estilos.kpiSublinha}>{sublinha}</span>
    </div>
  );
}

function CartaoDeOS({ cartao, base }: { cartao: CartaoOS; base: string }) {
  return (
    <Link href={`${base}/os/${cartao.numero}`} className={estilos.cartao}>
      <div className={estilos.cartaoTopo}>
        <span className={estilos.chipPlaca}>{cartao.placa}</span>
        <span className={estilos.numeroOS}>{cartao.numero}</span>
      </div>
      <div className={estilos.cartaoVeiculo}>{cartao.veiculo}</div>
      <div className={estilos.cartaoCliente}>{cartao.cliente}</div>
      <div className={estilos.cartaoRodape}>
        <span className={estilos.cartaoTotal}>{reais(cartao.totalCentavos)}</span>
        {cartao.previsao && (
          <span
            className={estilos.cartaoPrazo}
            style={{ color: `var(--color-${COR_STATUS[cartao.status]})` }}
          >
            {dataHora(cartao.previsao)}
          </span>
        )}
      </div>
    </Link>
  );
}
