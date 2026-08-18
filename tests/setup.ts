/** Carrega .env antes dos testes, sem depender de biblioteca externa. */
import { readFileSync, existsSync } from 'node:fs';

const arquivo = process.env.ENV_FILE ?? '.env';
if (existsSync(arquivo)) {
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
