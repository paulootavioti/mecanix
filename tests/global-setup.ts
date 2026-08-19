/**
 * Recria o banco antes da suíte.
 *
 * Os testes de isolamento e de fiscal asseveram AUSÊNCIA de registros
 * ("a inutilização de um inquilino não afeta o outro"). Sem um estado inicial
 * conhecido, dados de execuções anteriores acumulam e essas asserções passam
 * a falhar por motivo errado — foi o que aconteceu. Quem depende do estado do
 * banco precisa ser dono dele.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

export default function setup() {
  const arquivo = process.env.ENV_FILE ?? '.env';
  if (existsSync(arquivo)) {
    for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }

  const rodar = (script: string, args: string[] = []) =>
    execFileSync('npx', ['tsx', script, ...args], { stdio: 'pipe', env: process.env });

  rodar('scripts/migrate.ts', ['--reset']);
  rodar('scripts/seed.ts');
}
