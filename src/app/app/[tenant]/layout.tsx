import { redirect, notFound } from 'next/navigation';
import { usuarioAtual, tenantsDoUsuario, acessoAoTenant } from '../../../lib/sessao.ts';
import { osAbertas } from '../../../lib/patio.ts';
import { Chrome } from '../../../components/Chrome.tsx';

/**
 * Chrome do app da oficina.
 *
 * Aqui acontece a checagem de acesso: o usuário precisa ter vínculo com o
 * tenant do slug. Sem vínculo é 404 — e não 403 — para não confirmar a
 * existência de uma oficina a quem não pertence a ela.
 */
export default async function LayoutDoApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');

  const atual = await acessoAoTenant(usuario.id, slug);
  if (!atual) notFound();

  const [tenants, abertas] = await Promise.all([
    tenantsDoUsuario(usuario.id),
    osAbertas(atual.id),
  ]);

  return (
    <Chrome
      tenantAtual={atual}
      tenants={tenants}
      usuarioNome={usuario.nome}
      contagens={{ os_abertas: abertas }}
    >
      {children}
    </Chrome>
  );
}
