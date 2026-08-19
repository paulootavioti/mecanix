/**
 * Hash de senha com scrypt (node:crypto), sem dependência externa.
 *
 * Formato guardado: `scrypt$N$r$p$<salt base64>$<hash base64>`. Os parâmetros
 * ficam no próprio registro para que aumentá-los no futuro não invalide as
 * senhas já existentes — cada hash é verificado com os parâmetros com que foi
 * criado.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** promisify escolhe a sobrecarga de 3 argumentos e perde as opções de custo. */
function scrypt(
  senha: string, salt: Buffer, tamanho: number, opcoes: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(senha, salt, tamanho, opcoes, (erro, chave) =>
      erro ? reject(erro) : resolve(chave));
  });
}

const N = 16384; // custo de CPU/memória
const r = 8;
const p = 1;
const TAMANHO = 32;

export async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(senha.normalize('NFKC'), salt, TAMANHO, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, sN, sr, sp, saltB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, 'base64');

  const calculado = await scrypt(
    senha.normalize('NFKC'),
    Buffer.from(saltB64, 'base64'),
    esperado.length,
    { N: Number(sN), r: Number(sr), p: Number(sp) },
  );

  // Comparação em tempo constante: comparar com === vaza informação pelo
  // tempo de resposta e permite descobrir o hash byte a byte.
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
