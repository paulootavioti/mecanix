'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ITENS_NAVEGACAO, PLACEHOLDER_BUSCA, NOTA_TROCA_TENANT } from '../lib/navegacao.ts';
import { PLANOS, type CodigoPlano } from '../lib/planos.ts';
import type { TenantDoUsuario } from '../lib/sessao.ts';
import estilos from '../styles/chrome.module.css';

export interface ChromeProps {
  tenantAtual: TenantDoUsuario;
  tenants: TenantDoUsuario[];
  usuarioNome: string;
  contagens: Partial<Record<'os_abertas', number>>;
  children: React.ReactNode;
}

function iniciais(nome: string): string {
  return nome.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function nomePlano(codigo: string): string {
  return PLANOS[codigo as CodigoPlano]?.nome ?? codigo;
}

export function Chrome({ tenantAtual, tenants, usuarioNome, contagens, children }: ChromeProps) {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const caminho = usePathname();
  const envoltorio = useRef<HTMLDivElement>(null);

  // A gaveta fecha ao navegar; senão fica sobre a tela nova no phone.
  useEffect(() => { setGavetaAberta(false); setMenuAberto(false); }, [caminho]);

  // Fecha o dropdown ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuAberto) return;
    function aoClicar(e: MouseEvent) {
      if (!envoltorio.current?.contains(e.target as Node)) setMenuAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAberto(false);
    }
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAberto]);

  const base = `/app/${tenantAtual.slug}`;

  return (
    <div className={estilos.moldura}>
      {gavetaAberta && (
        <button
          className={estilos.overlay}
          aria-label="Fechar menu"
          onClick={() => setGavetaAberta(false)}
        />
      )}

      <aside className={`${estilos.sidebar} ${gavetaAberta ? estilos.sidebarAberta : ''}`}>
        <div className={estilos.sidebarCabecalho}>
          <span className={estilos.tenantAvatar} style={{ background: tenantAtual.cor }}>
            {iniciais(tenantAtual.nome)}
          </span>
          <div>
            <div className={estilos.tenantNomeSidebar}>{tenantAtual.nome}</div>
            <div className={estilos.tenantPlanoSidebar}>{nomePlano(tenantAtual.plano)}</div>
          </div>
        </div>

        <nav className={estilos.navegacao}>
          {ITENS_NAVEGACAO.map((item) => {
            const href = item.slug ? `${base}/${item.slug}` : base;
            const ativo = caminho === href || (item.slug !== '' && caminho.startsWith(`${href}/`));
            const badge = item.contagem ? contagens[item.contagem] : undefined;
            return (
              <Link
                key={item.rotulo}
                href={href}
                className={`${estilos.item} ${ativo ? estilos.itemAtivo : ''}`}
                aria-current={ativo ? 'page' : undefined}
              >
                <span className={estilos.ponto} style={{ background: item.cor }} />
                <span className={estilos.itemRotulo}>{item.rotulo}</span>
                {badge !== undefined && <span className={estilos.badge}>{badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={estilos.sidebarRodape}>
          <Link href="/portal" className={estilos.itemRodape}>Portal do cliente</Link>
          <Link href="/provedor" className={estilos.itemRodape}>Console do provedor</Link>
          <Link href="/login" className={estilos.itemRodape}>Sair / trocar de login</Link>
        </div>
      </aside>

      <div className={estilos.conteudo}>
        <header className={estilos.header}>
          <button
            className={estilos.hamburguer}
            onClick={() => setGavetaAberta(true)}
            aria-label="Abrir menu"
            aria-expanded={gavetaAberta}
          >
            ☰
          </button>

          <div className={estilos.envoltorioChip} ref={envoltorio}>
            <button
              className={estilos.chipTenant}
              onClick={() => setMenuAberto((v) => !v)}
              aria-expanded={menuAberto}
              aria-haspopup="menu"
            >
              <span className={estilos.chipAvatar} style={{ background: tenantAtual.cor }}>
                {iniciais(tenantAtual.nome)}
              </span>
              <span className={estilos.chipNome}>{tenantAtual.nome}</span>
              <span className={estilos.chipUnidade}>{tenantAtual.unidade}</span>
              <span className={estilos.chipSeta}>▼</span>
            </button>

            {menuAberto && (
              <div className={estilos.dropdown} role="menu">
                {tenants.map((t) => (
                  <Link
                    key={t.id}
                    href={`/app/${t.slug}/patio`}
                    className={estilos.opcaoTenant}
                    role="menuitem"
                  >
                    <span className={estilos.chipAvatar} style={{ background: t.cor }}>
                      {iniciais(t.nome)}
                    </span>
                    <span className={estilos.opcaoTextos}>
                      <span className={estilos.opcaoNome}>{t.nome}</span>
                      <span className={estilos.opcaoUnidade}>{t.unidade}</span>
                    </span>
                    <span className={estilos.opcaoPlano}>{nomePlano(t.plano)}</span>
                  </Link>
                ))}
                <p className={estilos.notaDropdown}>{NOTA_TROCA_TENANT}</p>
              </div>
            )}
          </div>

          <input
            className={estilos.busca}
            type="search"
            placeholder={PLACEHOLDER_BUSCA}
            aria-label={PLACEHOLDER_BUSCA}
          />

          <span className={estilos.slug}>{tenantAtual.slug}.mecanix.app</span>

          <Link href={`${base}/orcamentos/novo`} className={estilos.ctaOrcamento}>
            <span className={estilos.ctaCompleto}>+ Novo orçamento</span>
            <span className={estilos.ctaCurto}>+ Orçam.</span>
          </Link>

          <span className={estilos.avatarUsuario} title={usuarioNome}>
            {iniciais(usuarioNome)}
          </span>
        </header>

        <main className={estilos.principal}>{children}</main>
      </div>
    </div>
  );
}
