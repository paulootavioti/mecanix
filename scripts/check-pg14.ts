/**
 * Rejeita, nas migrações, construções que só existem a partir do PostgreSQL 15.
 *
 * Existe porque o alvo é PG14 mas o desenvolvimento pode acontecer contra uma
 * versão mais nova, que aceitaria essas construções sem reclamar — o erro só
 * apareceria na máquina de destino.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROIBIDOS: { padrao: RegExp; recurso: string; desde: string; alternativa: string }[] = [
  { padrao: /security_invoker/i, recurso: 'VIEW com security_invoker', desde: '15', alternativa: 'consulta direta ou função SECURITY INVOKER' },
  { padrao: /\bMERGE\s+INTO\b/i, recurso: 'MERGE', desde: '15', alternativa: 'INSERT ... ON CONFLICT DO UPDATE' },
  { padrao: /NULLS\s+NOT\s+DISTINCT/i, recurso: 'UNIQUE NULLS NOT DISTINCT', desde: '15', alternativa: 'coluna NOT NULL com sentinela explícita' },
  { padrao: /\bany_value\s*\(/i, recurso: 'any_value()', desde: '16', alternativa: 'min() ou max() explícito' },
  { padrao: /\brandom_normal\s*\(/i, recurso: 'random_normal()', desde: '16', alternativa: 'gerar no código da aplicação' },
];

const dir = join(process.cwd(), 'db', 'migrations');
let falhas = 0;

for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
  const linhas = readFileSync(join(dir, arquivo), 'utf8').split('\n');
  linhas.forEach((linha, i) => {
    if (linha.trimStart().startsWith('--')) return;
    for (const { padrao, recurso, desde, alternativa } of PROIBIDOS) {
      if (padrao.test(linha)) {
        console.error(`${arquivo}:${i + 1}  ${recurso} exige PostgreSQL ${desde}; use ${alternativa}`);
        falhas++;
      }
    }
  });
}

if (falhas > 0) {
  console.error(`\n${falhas} construção(ões) incompatível(is) com PostgreSQL 14.`);
  process.exit(1);
}
console.log('Migrações compatíveis com PostgreSQL 14.');
