import { redirect } from 'next/navigation';
import { usuarioAtual } from '../../lib/sessao.ts';
import { FormularioLogin } from '../../components/FormularioLogin.tsx';
import { PainelMarca } from '../../components/PainelMarca.tsx';
import estilos from '../../styles/login.module.css';

export const metadata = { title: 'Entrar · Mecanix Cloud' };

export default async function PaginaLogin() {
  if (await usuarioAtual()) redirect('/selecionar-oficina');

  return (
    <main className={estilos.tela}>
      <PainelMarca />
      <section className={estilos.colunaClara}>
        <h1 className={estilos.titulo}>Entrar</h1>
        <FormularioLogin />
      </section>
    </main>
  );
}
