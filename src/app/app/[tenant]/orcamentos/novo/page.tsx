import { redirect, notFound } from 'next/navigation';
import { usuarioAtual, acessoAoTenant } from '../../../../../lib/sessao.ts';
import { catalogoDoTenant } from '../../../../../lib/busca.ts';
import { Wizard } from '../../../../../components/Wizard.tsx';

export const metadata = { title: 'Novo orçamento · Mecanix Cloud' };

export default async function PaginaNovoOrcamento({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  const tenant = await acessoAoTenant(usuario.id, slug);
  if (!tenant) notFound();

  const catalogo = await catalogoDoTenant(tenant.id);
  return <Wizard slug={slug} catalogo={catalogo} />;
}
