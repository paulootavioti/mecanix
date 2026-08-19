'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buscarVeiculo, buscarCliente, gerarOS } from '../lib/acoes-wizard.ts';
import type { VeiculoEncontrado, ClienteEncontrado, ItemCatalogo } from '../lib/busca.ts';
import {
  calcularTotais, podeAvancar, CUSTO_HORA_CENTAVOS, VALIDADE_DIAS,
  type ItemCarrinho, type PassoWizard,
} from '../lib/orcamento.ts';
import { TOAST_BLOQUEIO } from '../lib/copy-pendente.ts';
import { reais } from '../lib/formato.ts';
import { Toast } from './Toast.tsx';
import estilos from '../styles/wizard.module.css';

const PASSOS = ['Veículo', 'Cliente', 'Itens e kits', 'Revisão e envio'];
const ABAS = [
  { chave: 'kit', rotulo: 'Kits' },
  { chave: 'peca', rotulo: 'Peças' },
  { chave: 'servico', rotulo: 'Serviços' },
] as const;

export function Wizard({ slug, catalogo }: { slug: string; catalogo: ItemCatalogo[] }) {
  const router = useRouter();
  const [passo, setPasso] = useState<PassoWizard>(1);
  const [toast, setToast] = useState<string>();

  const [placa, setPlaca] = useState('');
  const [veiculo, setVeiculo] = useState<VeiculoEncontrado>();
  const [msgPlaca, setMsgPlaca] = useState<{ texto: string; tipo: 'erro' | 'ok' }>();

  const [documento, setDocumento] = useState('');
  const [cliente, setCliente] = useState<ClienteEncontrado>();
  const [msgDoc, setMsgDoc] = useState<{ texto: string; tipo: 'erro' | 'ok' }>();

  const [aba, setAba] = useState<'kit' | 'peca' | 'servico'>('kit');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [buscando, iniciarBusca] = useTransition();
  const [gerando, iniciarGeracao] = useTransition();

  const totais = calcularTotais(carrinho);

  function avancar() {
    const r = podeAvancar(passo, {
      veiculoEncontrado: Boolean(veiculo),
      clienteEncontrado: Boolean(cliente),
      carrinho,
    });
    if (!r.permitido) {
      setToast(TOAST_BLOQUEIO[r.motivo!]);
      return;
    }
    setPasso((p) => Math.min(4, p + 1) as PassoWizard);
  }

  function procurarVeiculo() {
    setMsgPlaca({ texto: 'consultando base de veículos…', tipo: 'ok' });
    iniciarBusca(async () => {
      const r = await buscarVeiculo(slug, placa);
      if (r.erro) { setMsgPlaca({ texto: r.erro, tipo: 'erro' }); setVeiculo(undefined); return; }
      if (r.naoEncontrado) {
        setMsgPlaca({ texto: 'veículo não encontrado nesta oficina', tipo: 'erro' });
        setVeiculo(undefined);
        return;
      }
      setVeiculo(r.veiculo);
      setMsgPlaca({
        texto: `veículo encontrado ✓ ${r.veiculo!.osAnteriores} OS anteriores`,
        tipo: 'ok',
      });
    });
  }

  function procurarCliente() {
    setMsgDoc({ texto: 'consultando documento…', tipo: 'ok' });
    iniciarBusca(async () => {
      const r = await buscarCliente(slug, documento);
      if (r.erro) { setMsgDoc({ texto: r.erro, tipo: 'erro' }); setCliente(undefined); return; }
      if (r.naoEncontrado) {
        setMsgDoc({ texto: 'documento não localizado', tipo: 'erro' });
        setCliente(undefined);
        return;
      }
      setCliente(r.cliente);
      setMsgDoc({ texto: 'cliente encontrado ✓', tipo: 'ok' });
    });
  }

  function adicionar(item: ItemCatalogo) {
    setCarrinho((c) => [...c, {
      tipo: item.tipo === 'servico' ? 'servico' : 'peca',
      codigo: item.codigo,
      nome: item.nome,
      qtd: 1,
      unitCentavos: item.precoCentavos,
      custoUnitCentavos: item.custoMedioCentavos,
      tempoHoras: item.tempoHoras,
    }]);
  }

  function concluir() {
    if (!veiculo || !cliente?.clienteId) {
      setToast('O cliente precisa estar cadastrado nesta oficina');
      return;
    }
    iniciarGeracao(async () => {
      const r = await gerarOS(slug, veiculo.id, cliente.clienteId!, carrinho);
      if (r.erro) { setToast(r.erro); return; }
      setToast(`${r.numero} gerada`);
      router.push(`/app/${slug}/patio`);
    });
  }

  return (
    <>
      <h1 className={estilos.titulo}>Novo orçamento</h1>

      <ol className={estilos.passos}>
        {PASSOS.map((rotulo, i) => {
          const n = (i + 1) as PassoWizard;
          const concluido = n < passo;
          return (
            <li key={rotulo} className={`${estilos.passo} ${n === passo ? estilos.passoAtual : ''}`}>
              <span className={`${estilos.passoNumero} ${concluido ? estilos.passoConcluido : ''}`}>
                {concluido ? '✓' : n}
              </span>
              <span className={estilos.passoRotulo}>{rotulo}</span>
            </li>
          );
        })}
      </ol>

      {passo === 1 && (
        <section className={estilos.cartao}>
          <div className={estilos.linhaBusca}>
            <label className={estilos.campo}>
              <span className="rotuloMono">Placa</span>
              <input
                className={estilos.campoPlaca}
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                maxLength={8}
                aria-label="Placa"
              />
            </label>
            <button className={estilos.botaoBuscar} onClick={procurarVeiculo} disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar veículo'}
            </button>
          </div>

          {msgPlaca && (
            <p className={`${estilos.mensagem} ${msgPlaca.tipo === 'erro' ? estilos.mensagemErro : estilos.mensagemOk}`}>
              {msgPlaca.texto}
            </p>
          )}

          {veiculo && (
            <div className={estilos.resultado}>
              <Dado rotulo="Marca/modelo" valor={`${veiculo.marca} ${veiculo.modelo}`} />
              <Dado rotulo="Ano" valor={veiculo.ano} />
              <Dado rotulo="Cor" valor={veiculo.cor} />
              <Dado rotulo="Combustível" valor={veiculo.combustivel} />
              <Dado rotulo="Chassi" valor={veiculo.chassi} />
              <Dado rotulo="Renavam" valor={veiculo.renavam} />
              <Dado rotulo="KM última visita" valor={veiculo.km?.toLocaleString('pt-BR') ?? null} />
              <Dado rotulo="Histórico" valor={`${veiculo.osAnteriores} OS`} />
            </div>
          )}
        </section>
      )}

      {passo === 2 && (
        <section className={estilos.cartao}>
          <div className={estilos.linhaBusca}>
            <label className={estilos.campo}>
              <span className="rotuloMono">CPF/CNPJ</span>
              <input
                className={estilos.campoPlaca}
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                maxLength={18}
                aria-label="CPF ou CNPJ"
              />
            </label>
            <button className={estilos.botaoBuscar} onClick={procurarCliente} disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar cliente'}
            </button>
          </div>

          {msgDoc && (
            <p className={`${estilos.mensagem} ${msgDoc.tipo === 'erro' ? estilos.mensagemErro : estilos.mensagemOk}`}>
              {msgDoc.texto}
            </p>
          )}

          {cliente && (
            <>
              {/* A origem fica explícita: da carteira desta oficina ou de
                  consulta pública. Nunca de outra oficina. */}
              <span
                className={`${estilos.origem} ${cliente.origem === 'base_interna' ? estilos.origemInterna : estilos.origemPublica}`}
              >
                {cliente.origem === 'base_interna'
                  ? 'cadastro desta oficina'
                  : 'consulta pública · só dados cadastrais'}
              </span>
              <div className={estilos.resultado}>
                <Dado rotulo="Razão social" valor={cliente.nome} />
                <Dado rotulo="Tipo" valor={cliente.tipo === 'pj' ? 'PJ' : 'PF'} />
                <Dado rotulo="Situação" valor={cliente.situacao} />
                <Dado rotulo="Cidade" valor={cliente.cidade} />
                {cliente.origem === 'base_interna' && (
                  <>
                    <Dado rotulo="Contato" valor={cliente.contato ?? null} />
                    <Dado rotulo="E-mail" valor={cliente.email ?? null} />
                    <Dado
                      rotulo="Limite de crédito"
                      valor={reais(cliente.limiteCreditoCentavos ?? 0)}
                    />
                    <Dado rotulo="Títulos em atraso" valor={String(cliente.titulosEmAtraso ?? 0)} />
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {passo === 3 && (
        <div className={estilos.passo3}>
          <section className={`${estilos.cartao} ${estilos.lista}`}>
            <div className={estilos.abas}>
              {ABAS.map((a) => (
                <button
                  key={a.chave}
                  className={`${estilos.aba} ${aba === a.chave ? estilos.abaAtiva : ''}`}
                  onClick={() => setAba(a.chave)}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>

            {catalogo.filter((i) => i.tipo === aba).map((item) => (
              <div key={item.id} className={estilos.itemLista}>
                <span className={estilos.itemTextos}>
                  <span className={estilos.itemNome}>{item.nome}</span>
                  <span className={estilos.itemMeta}>
                    {item.codigo}
                    {item.saldo !== undefined && ` · estoque ${item.saldo}`}
                    {item.custoMedioCentavos !== undefined && ` · custo ${reais(item.custoMedioCentavos)}`}
                    {item.tempoHoras !== undefined && ` · ${item.tempoHoras}h`}
                  </span>
                </span>
                <span className={estilos.itemPreco}>{reais(item.precoCentavos)}</span>
                <button
                  className={estilos.mais}
                  onClick={() => adicionar(item)}
                  aria-label={`Adicionar ${item.nome}`}
                >
                  +
                </button>
              </div>
            ))}
          </section>

          <section className={`${estilos.cartao} ${estilos.carrinho}`}>
            {carrinho.length === 0 ? (
              <p className={estilos.carrinhoVazio}>toque nos itens ao lado</p>
            ) : (
              <>
                {carrinho.map((i, idx) => (
                  <div key={`${i.codigo}-${idx}`} className={estilos.itemCarrinho}>
                    <span style={{ flex: 1 }}>{i.nome}</span>
                    <span className="mono">{reais(i.unitCentavos)}</span>
                    <button
                      className={estilos.remover}
                      onClick={() => setCarrinho((c) => c.filter((_, k) => k !== idx))}
                      aria-label={`Remover ${i.nome}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className={estilos.totalCarrinho}>
                  <span className="rotuloMono">Total</span>
                  <span className={estilos.totalValor}>{reais(totais.totalCentavos)}</span>
                </div>
                <p className={estilos.margemLinha}>
                  Custo hora {reais(CUSTO_HORA_CENTAVOS)}
                  {totais.margemPct !== null && ` · margem estimada ${totais.margemPct}%`}
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {passo === 4 && (
        <>
          <div className={estilos.resumos}>
            <section className={estilos.cartao}>
              <span className="rotuloMono">Veículo</span>
              <p>{veiculo?.placa} · {veiculo?.marca} {veiculo?.modelo}</p>
            </section>
            <section className={estilos.cartao}>
              <span className="rotuloMono">Cliente</span>
              <p>{cliente?.nome}</p>
            </section>
            <section className={estilos.cartao}>
              <span className="rotuloMono">Itens</span>
              <p>{carrinho.length} item(ns) · validade de {VALIDADE_DIAS} dias</p>
            </section>
          </div>

          <div className={estilos.barraFinal}>
            <span className={estilos.barraTotal}>{reais(totais.totalCentavos)}</span>
            <button className={estilos.ctaVerde} onClick={concluir} disabled={gerando}>
              {gerando ? 'Gerando…' : 'Gerar OS e publicar no portal'}
            </button>
            <button className={estilos.ctaSecundario} type="button">Só e-mail</button>
          </div>
        </>
      )}

      {passo < 4 && (
        <div className={estilos.navegacao}>
          {passo > 1 && (
            <button
              className={estilos.voltar}
              onClick={() => setPasso((p) => Math.max(1, p - 1) as PassoWizard)}
            >
              Voltar
            </button>
          )}
          <button className={estilos.continuar} onClick={avancar}>Continuar</button>
        </div>
      )}

      <Toast mensagem={toast} />
    </>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className={estilos.especificacao}>
      <span className="rotuloMono">{rotulo}</span>
      <span className={estilos.especificacaoValor}>{valor ?? '—'}</span>
    </div>
  );
}
