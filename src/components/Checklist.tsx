'use client';

import { useActionState } from 'react';
import { alternarChecklist, type EstadoAcao } from '../lib/acoes-os.ts';
import type { ItemChecklist } from '../lib/os.ts';
import estilos from '../styles/os.module.css';

export function Checklist({
  slug, numero, itens,
}: {
  slug: string; numero: string; itens: ItemChecklist[];
}) {
  const [, acao, enviando] = useActionState<EstadoAcao, FormData>(alternarChecklist, {});
  const marcados = itens.filter((i) => i.marcado).length;

  return (
    <section className={estilos.cartao}>
      <h2 className={estilos.cartaoTitulo}>
        Checklist de entrada{' '}
        <span className={estilos.contador}>{marcados}/{itens.length}</span>
      </h2>

      {itens.map((item) => (
        <form key={item.id} action={acao}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="numero" value={numero} />
          <input type="hidden" name="itemId" value={item.id} />
          <button type="submit" className={estilos.checklistItem} disabled={enviando}>
            <span
              className={`${estilos.caixa} ${item.marcado ? estilos.caixaMarcada : ''}`}
              aria-hidden="true"
            >
              ✓
            </span>
            <span>{item.descricao}</span>
            <span className="apenasLeitorDeTela">
              {item.marcado ? 'marcado' : 'não marcado'}
            </span>
          </button>
        </form>
      ))}
    </section>
  );
}
