'use client';

import { useActionState } from 'react';
import { avancarEtapa, type EstadoAcao } from '../lib/acoes-os.ts';
import { ROTULO_AVANCO, ehTerminal, TRANSICOES, type StatusOS } from '../lib/os-status.ts';
import { ACAO_PULAR_PECA } from '../lib/copy-pendente.ts';
import { Toast } from './Toast.tsx';
import estilos from '../styles/os.module.css';

export function BotaoAvanco({
  slug, osId, status,
}: {
  slug: string; osId: string; status: StatusOS;
}) {
  const [estado, acao, enviando] = useActionState<EstadoAcao, FormData>(avancarEtapa, {});
  const terminal = ehTerminal(status);

  // "Execução" tem duas saídas desde que a etapa de peça virou opcional
  // (D-006): a principal segue o rótulo do README, e a segunda aparece como
  // ação secundária.
  const alternativa = TRANSICOES[status][1];

  return (
    <>
      <form action={acao} style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="osId" value={osId} />
        <button type="submit" className={estilos.avanco} disabled={terminal || enviando}>
          {enviando ? 'Salvando…' : ROTULO_AVANCO[status]}
        </button>
      </form>

      {alternativa && (
        <form action={acao}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="osId" value={osId} />
          <input type="hidden" name="destino" value={alternativa} />
          <button type="submit" className={estilos.avancoSecundario} disabled={enviando}>
            {ACAO_PULAR_PECA}
          </button>
        </form>
      )}

      <Toast mensagem={estado.toast} />
    </>
  );
}
