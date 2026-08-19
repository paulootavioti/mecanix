'use server';

import { redirect } from 'next/navigation';
import { autenticar, encerrarSessao } from './sessao.ts';

export interface EstadoLogin {
  erro?: string;
}

export async function entrar(
  _anterior: EstadoLogin, dados: FormData,
): Promise<EstadoLogin> {
  const email = String(dados.get('email') ?? '');
  const senha = String(dados.get('senha') ?? '');

  if (!email.trim() || !senha) {
    return { erro: 'Informe e-mail e senha' };
  }

  const userId = await autenticar(email, senha);
  // Mensagem única para e-mail inexistente e senha errada: distinguir os dois
  // casos entrega a terceiros a lista de quem tem conta.
  if (!userId) return { erro: 'E-mail ou senha inválidos' };

  redirect('/selecionar-oficina');
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect('/login');
}
