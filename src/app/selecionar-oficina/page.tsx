import { redirect } from 'next/navigation';
import Link from 'next/link';
import { usuarioAtual, tenantsDoUsuario } from '../../lib/sessao.ts';
import { PainelMarca } from '../../components/PainelMarca.tsx';
import { PLANOS, type CodigoPlano } from '../../lib/planos.ts';
import estilos from '../../styles/login.module.css';

export const metadata = { title: 'Escolha a oficina · Mecanix Cloud' };

function iniciais(nome: string): string {
  return nome
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function PaginaSelecionarOficina() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');

  const tenants = await tenantsDoUsuario(usuario.id);

  return (
    <main className={estilos.tela}>
      <PainelMarca />

      <section className={estilos.colunaClara}>
        {/* O README traz "SESSÃO INICIADA · RAFAEL SOUZA"; o nome vem da sessão. */}
        <p className={estilos.kicker}>Sessão iniciada · {usuario.nome}</p>
        <h1 className={estilos.titulo}>Escolha a oficina</h1>

        <div className={estilos.listaTenants}>
          {tenants.map((t) => (
            <Link
              key={t.id}
              href={`/app/${t.slug}/patio`}
              className={estilos.botaoTenant}
            >
              <span className={estilos.avatar} style={{ background: t.cor }}>
                {iniciais(t.nome)}
              </span>
              <span className={estilos.tenantTextos}>
                <span className={estilos.tenantNome}>{t.nome}</span>
                <span className={estilos.tenantSlug}>{t.slug}.mecanix.app</span>
                <span className={estilos.tenantUnidade}>{t.unidade} · {t.papel}</span>
              </span>
              <span className={estilos.pillPlano}>
                {PLANOS[t.plano as CodigoPlano]?.nome ?? t.plano}
              </span>
            </Link>
          ))}
        </div>

        <div className={estilos.acoes}>
          <Link href="/portal" className={`${estilos.acao} ${estilos.acaoPrimaria}`}>
            Entrar no portal do cliente
          </Link>
          <Link href="/provedor" className={`${estilos.acao} ${estilos.acaoTracejada}`}>
            Entrar como provedor
          </Link>
        </div>
      </section>
    </main>
  );
}
