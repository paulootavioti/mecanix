import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { usuarioAtual, acessoAoTenant } from '../../../../../lib/sessao.ts';
import { detalheDaOS, formatarDocumento } from '../../../../../lib/os.ts';
import { ROTULO_STATUS, COR_STATUS, TINT_STATUS } from '../../../../../lib/os-status.ts';
import { reais, dataHora } from '../../../../../lib/formato.ts';
import { BotaoAvanco } from '../../../../../components/BotaoAvanco.tsx';
import { Checklist } from '../../../../../components/Checklist.tsx';
import estilos from '../../../../../styles/os.module.css';

/** Ações do §5, na ordem do README. A primeira é a verde. */
const ACOES = [
  'Publicar no portal do cliente',
  'Enviar por WhatsApp',
  'Emitir NF conjugada',
  'Agendar próxima revisão',
  'Ver como o cliente vê',
];

export default async function PaginaOS({
  params,
}: {
  params: Promise<{ tenant: string; numero: string }>;
}) {
  const { tenant: slug, numero } = await params;
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  const tenant = await acessoAoTenant(usuario.id, slug);
  if (!tenant) notFound();

  const os = await detalheDaOS(tenant.id, usuario.id, decodeURIComponent(numero));
  if (!os) notFound();

  const base = `/app/${slug}`;
  const { veiculo: v, cliente: c } = os;

  return (
    <>
      <div className={estilos.barra}>
        <Link href={`${base}/patio`} className={estilos.voltar}>← Pátio</Link>
        <h1 className={estilos.numero}>{os.numero}</h1>
        <span
          className={estilos.chipStatus}
          style={{
            background: TINT_STATUS[os.status],
            color: `var(--color-${COR_STATUS[os.status]})`,
          }}
        >
          {ROTULO_STATUS[os.status]}
        </span>

        <BotaoAvanco slug={slug} osId={os.id} status={os.status} />

        <div className={estilos.metadados}>
          <span>Abertura {dataHora(os.abertura)}</span>
          {os.consultor && <span>Consultor {os.consultor}</span>}
          {os.tecnico && os.tecnico !== '—' && <span>Técnico {os.tecnico}</span>}
          {os.box && <span>Box {os.box}</span>}
        </div>
      </div>

      <div className={estilos.colunas}>
        <div className={estilos.colunaEsquerda}>
          <section className={estilos.cartao}>
            <div className={estilos.fotoVeiculo}>
              <span className={estilos.fotoLegenda}>foto do veículo na entrada</span>
            </div>
            <span className={estilos.placaEscura}>{v.placa}</span>
            <p className={estilos.modelo}>{[v.marca, v.modelo].filter((x) => x && x !== '—').join(' ') || v.modelo}</p>
            <div className={estilos.especificacoes}>
              <Especificacao rotulo="Chassi" valor={v.chassi} />
              <Especificacao rotulo="Ano" valor={v.ano} />
              <Especificacao rotulo="KM" valor={v.km !== null ? v.km.toLocaleString('pt-BR') : null} />
              <Especificacao rotulo="Combustível" valor={v.combustivel} />
              <Especificacao rotulo="Cor" valor={v.cor} />
            </div>
          </section>

          <section className={estilos.cartao}>
            <h2 className={estilos.cartaoTitulo}>Cliente</h2>
            <p className={estilos.modelo}>{c.nome}</p>
            <div className={estilos.linhaCliente}>
              <span>Tipo</span>
              <span className={estilos.linhaClienteValor}>
                {c.tipo === 'pj' ? 'PJ' : 'PF'}
              </span>
            </div>
            <div className={estilos.linhaCliente}>
              <span>Documento</span>
              <span className={estilos.linhaClienteValor}>{formatarDocumento(c.cpfCnpj)}</span>
            </div>
            {c.contato && (
              <div className={estilos.linhaCliente}>
                <span>Contato</span>
                <span className={estilos.linhaClienteValor}>{c.contato}</span>
              </div>
            )}

            <div className={estilos.tags}>
              {c.acessoPortal && <span className={estilos.tag}>portal ativo</span>}
            </div>

            <Link
              href={`/portal/${slug}`}
              className={estilos.botaoPortal}
              style={{ display: 'grid', placeItems: 'center' }}
            >
              Abrir portal deste cliente
            </Link>
          </section>

          <Checklist slug={slug} numero={os.numero} itens={os.checklist} />
        </div>

        <div className={estilos.colunaDireita}>
          <section className={estilos.cartao}>
            <h2 className={estilos.cartaoTitulo}>Peças e serviços</h2>
            {os.itens.map((i) => (
              <div key={i.id} className={estilos.item}>
                <span
                  className={`${estilos.chipTipo} ${i.tipo === 'peca' ? estilos.chipPeca : estilos.chipServico}`}
                >
                  {i.tipo === 'peca' ? 'peça' : 'serviço'}
                </span>
                <span className={estilos.itemTextos}>
                  <span className={estilos.itemNome}>{i.nome}</span>
                  {i.codigo && <span className={estilos.itemCodigo}> {i.codigo}</span>}
                </span>
                <span className={estilos.itemQtd}>
                  {i.qtd} × {reais(i.unitCentavos)}
                </span>
                <span className={estilos.itemTotal}>{reais(i.totalCentavos)}</span>
              </div>
            ))}

            <div className={estilos.somas}>
              <div className={estilos.soma}>
                <span>Peças</span>
                <span className={estilos.somaValor}>{reais(os.pecasCentavos)}</span>
              </div>
              <div className={estilos.soma}>
                <span>Serviços</span>
                <span className={estilos.somaValor}>{reais(os.servicosCentavos)}</span>
              </div>
              <div className={estilos.soma}>
                <span><strong>Total da OS</strong></span>
                <span className={estilos.somaTotal}>{reais(os.totalCentavos)}</span>
              </div>
            </div>
          </section>

          <section className={estilos.cartao}>
            <h2 className={estilos.cartaoTitulo}>Linha do tempo</h2>
            {os.eventos.map((e) => (
              <div key={e.id} className={estilos.evento}>
                <span
                  className={estilos.eventoPonto}
                  style={e.cor ? { background: `var(--color-${e.cor})` } : undefined}
                />
                <div>
                  <div className={estilos.eventoDescricao}>{e.descricao}</div>
                  <div className={estilos.eventoMeta}>{dataHora(e.criadoEm)} · {e.quem}</div>
                </div>
              </div>
            ))}
          </section>

          <section className={estilos.cartao}>
            <h2 className={estilos.cartaoTitulo}>Ações</h2>
            <div className={estilos.acoes}>
              {ACOES.map((rotulo, i) => (
                <button
                  key={rotulo}
                  className={`${estilos.acao} ${i === 0 ? estilos.acaoVerde : ''}`}
                  type="button"
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Especificacao({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className={estilos.especificacao}>
      <span className="rotuloMono">{rotulo}</span>
      <span className={estilos.especificacaoValor}>{valor ?? '—'}</span>
    </div>
  );
}
