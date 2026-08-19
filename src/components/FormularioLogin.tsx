'use client';

import { useActionState } from 'react';
import { entrar, type EstadoLogin } from '../lib/acoes-sessao.ts';
import estilos from '../styles/login.module.css';

export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className={estilos.formulario}>
      <label className={estilos.campo}>
        <span className={estilos.campoRotulo}>E-mail</span>
        <input
          className={estilos.campoEntrada}
          type="email"
          name="email"
          autoComplete="username"
          required
        />
      </label>

      <label className={estilos.campo}>
        <span className={estilos.campoRotulo}>Senha</span>
        <input
          className={estilos.campoEntrada}
          type="password"
          name="senha"
          autoComplete="current-password"
          required
        />
      </label>

      {estado.erro && <p className={estilos.erro} role="alert">{estado.erro}</p>}

      <button type="submit" className={`${estilos.acao} ${estilos.acaoPrimaria}`} disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
