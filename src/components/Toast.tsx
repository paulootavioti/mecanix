'use client';

import { useEffect, useState } from 'react';
import estilos from '../styles/chrome.module.css';

/** Toast do §2: fixo, centralizado, some em 2,8s. */
const DURACAO_MS = 2800;

export function Toast({ mensagem }: { mensagem?: string }) {
  const [visivel, setVisivel] = useState(Boolean(mensagem));

  useEffect(() => {
    if (!mensagem) return;
    setVisivel(true);
    const t = setTimeout(() => setVisivel(false), DURACAO_MS);
    return () => clearTimeout(t);
  }, [mensagem]);

  if (!mensagem || !visivel) return null;
  return (
    <div className={estilos.toast} role="status" aria-live="polite">
      {mensagem}
    </div>
  );
}
