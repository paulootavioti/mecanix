import { redirect } from 'next/navigation';

/** A landing pública é a Fase 6; por ora a raiz leva ao login. */
export default function Raiz() {
  redirect('/login');
}
