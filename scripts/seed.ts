/**
 * Seeds de desenvolvimento.
 *
 * Escreve pelo papel `owner` porque precisa criar linhas em vários tenants na
 * mesma execução — mas isso NÃO contorna a RLS: as tabelas usam FORCE ROW
 * LEVEL SECURITY, então o próprio dono também é filtrado. O seed define
 * `app.tenant_id` a cada bloco, exatamente como a aplicação faz.
 */
import pg from 'pg';
import { PLANOS } from '../src/lib/planos.ts';
import { gerarHash } from '../src/lib/senha.ts';
import {
  TENANTS, DISTRIBUICAO_OS, OS_PRIMEIRA, PECAS, SERVICOS, KITS,
  CHECKLIST_ENTRADA, CHECKLIST_MARCADOS,
} from '../db/seed-dados.ts';

const CLIENTE_COMPARTILHADO = '12345678000199';

/** Senha de desenvolvimento do usuário de seed. Nunca usar fora de dev. */
const SENHA_DEV = 'mecanix-dev';

async function main() {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error('DATABASE_URL_OWNER não definida');
  const db = new pg.Client({ connectionString: url });
  await db.connect();

  await db.query('BEGIN');

  for (const p of Object.values(PLANOS)) {
    await db.query(
      `INSERT INTO plans (codigo, nome, preco_mensal_centavos, preco_anual_centavos,
         max_usuarios, max_cnpjs, max_armazenamento_bytes, max_os_mes, ordem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (codigo) DO UPDATE SET
         nome = EXCLUDED.nome,
         preco_mensal_centavos = EXCLUDED.preco_mensal_centavos,
         preco_anual_centavos = EXCLUDED.preco_anual_centavos,
         max_usuarios = EXCLUDED.max_usuarios,
         max_cnpjs = EXCLUDED.max_cnpjs,
         max_armazenamento_bytes = EXCLUDED.max_armazenamento_bytes,
         max_os_mes = EXCLUDED.max_os_mes`,
      [p.codigo, p.nome, p.precoMensalCentavos, p.precoAnualCentavos,
       p.maxUsuarios, p.maxCnpjs, p.maxArmazenamentoBytes, p.maxOsMes, p.ordem],
    );
    const { rows: [plano] } = await db.query<{ id: string }>(
      'SELECT id FROM plans WHERE codigo = $1', [p.codigo]);
    for (const f of p.features) {
      await db.query(
        'INSERT INTO plan_features (plan_id, feature) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [plano.id, f]);
    }
  }

  // Rafael Souza é o usuário citado na tela de login ("SESSÃO INICIADA ·
  // RAFAEL SOUZA") e pertence aos três tenants com papéis distintos — é a
  // demonstração de que o login é único e alcança N inquilinos.
  //
  // Senha de DESENVOLVIMENTO, documentada em docs/DESENVOLVIMENTO.md. O hash
  // é gerado de verdade (scrypt) para que o fluxo de login seja o mesmo de
  // produção — nada de atalho que só funcione no seed.
  const senhaHash = await gerarHash(SENHA_DEV);
  const { rows: [rafael] } = await db.query<{ id: string }>(
    `INSERT INTO users (email, nome, senha_hash) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, senha_hash = EXCLUDED.senha_hash
     RETURNING id`,
    ['rafael.souza@exemplo.com.br', 'Rafael Souza', senhaHash]);

  const papeis = ['gerente', 'consultor', 'financeiro'] as const;
  let os = OS_PRIMEIRA;

  for (const [i, t] of TENANTS.entries()) {
    const { rows: [plano] } = await db.query<{ id: string }>(
      'SELECT id FROM plans WHERE codigo = $1', [t.plano]);
    const { rows: [tenant] } = await db.query<{ id: string }>(
      `INSERT INTO tenants (slug, nome, unidade, cor, plan_id, dominio)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
      [t.slug, t.nome, t.unidade, t.cor, plano.id, `${t.slug}.mecanix.app`]);

    // A partir daqui tudo é dado de domínio — inclusive o vínculo do usuário
    // com o tenant, que tem tenant_id e RLS. Contexto entra antes da escrita.
    await db.query('SELECT set_config($1,$2,true)', ['app.tenant_id', tenant.id]);

    await db.query(
      `INSERT INTO tenant_users (user_id, tenant_id, papel) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET papel = EXCLUDED.papel`,
      [rafael.id, tenant.id, papeis[i]]);

    const { rows: [filial] } = await db.query<{ id: string }>(
      `INSERT INTO filiais (tenant_id, nome, cnpj, cnpj_raiz)
       VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, cnpj) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [tenant.id, `${t.nome} — ${t.unidade}`, t.cnpj, t.cnpj.slice(0, 8)]);

    for (const modelo of ['nfe', 'nfse', 'nfce'] as const) {
      await db.query(
        `INSERT INTO series_fiscais (tenant_id, filial_id, modelo, serie, proximo_numero)
         VALUES ($1,$2,$3,'1',1) ON CONFLICT DO NOTHING`,
        [tenant.id, filial.id, modelo]);
    }

    for (const p of PECAS) {
      await db.query(
        `INSERT INTO pecas (tenant_id, codigo, nome, preco_centavos, saldo, minimo)
         VALUES ($1,$2,$3,$4,10,4) ON CONFLICT (tenant_id, codigo) DO NOTHING`,
        [tenant.id, p.codigo, p.nome, p.precoCentavos]);
    }
    for (const s of SERVICOS) {
      await db.query(
        `INSERT INTO servicos (tenant_id, codigo, nome, preco_centavos, tempo_horas)
         VALUES ($1,$2,$3,$4,1.5) ON CONFLICT (tenant_id, codigo) DO NOTHING`,
        [tenant.id, s.codigo, s.nome, s.precoCentavos]);
    }
    for (const k of KITS) {
      await db.query(
        `INSERT INTO kits (tenant_id, codigo, nome, preco_centavos)
         VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, codigo) DO NOTHING`,
        [tenant.id, k.codigo, k.nome, k.precoCentavos]);
    }

    // O MESMO CNPJ é cadastrado nos três tenants, de propósito: é a prova
    // viva de que a carteira é privativa e que não há deduplicação global.
    const { rows: [cliente] } = await db.query<{ id: string }>(
      `INSERT INTO clientes (tenant_id, cpf_cnpj, tipo, nome, acesso_portal)
       VALUES ($1,$2,'pj',$3,true)
       ON CONFLICT (tenant_id, cpf_cnpj) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
      [tenant.id, CLIENTE_COMPARTILHADO, `Cliente de ${t.nome}`]);

    // Placa também repetida entre tenants — mesma lógica.
    const { rows: [veiculo] } = await db.query<{ id: string }>(
      `INSERT INTO veiculos (tenant_id, cliente_id, placa, marca, modelo, ano, km)
       VALUES ($1,$2,'RQK7D22','—','—','2020',48000)
       ON CONFLICT (tenant_id, placa) DO UPDATE SET km = EXCLUDED.km RETURNING id`,
      [tenant.id, cliente.id]);

    // As 23 OS (OS-8390..OS-8412) ficam no primeiro tenant, que é o do
    // protótipo; os demais recebem uma OS cada, para os testes de isolamento.
    const quantas = i === 0
      ? Object.entries(DISTRIBUICAO_OS).flatMap(([s, n]) => Array<string>(n).fill(s))
      : ['aprovacao'];

    for (const status of quantas) {
      const numero = `OS-${os++}`;
      const { rows: [ordem] } = await db.query<{ id: string }>(
        `INSERT INTO ordens_servico (tenant_id, numero, cliente_id, veiculo_id, status, consultor, tecnico)
         VALUES ($1,$2,$3,$4,$5,'Rafael Souza','—')
         ON CONFLICT (tenant_id, numero) DO UPDATE SET status = EXCLUDED.status RETURNING id`,
        [tenant.id, numero, cliente.id, veiculo.id, status]);
      await db.query(
        `INSERT INTO os_eventos (tenant_id, os_id, tipo, descricao, quem)
         VALUES ($1,$2,'abertura','OS aberta','Rafael Souza')`,
        [tenant.id, ordem.id]);

      // Itens: duas peças e um serviço por OS, para o rodapé de somas do §5
      // ter peças, serviços e total separados.
      await db.query('DELETE FROM os_itens WHERE os_id = $1', [ordem.id]);
      for (const [n, p] of PECAS.slice(0, 2).entries()) {
        await db.query(
          `INSERT INTO os_itens (tenant_id, os_id, tipo, codigo, nome, qtd, unit_centavos)
           VALUES ($1,$2,'peca',$3,$4,$5,$6)`,
          [tenant.id, ordem.id, p.codigo, p.nome, n + 1, p.precoCentavos]);
      }
      const sv = SERVICOS[0];
      await db.query(
        `INSERT INTO os_itens (tenant_id, os_id, tipo, codigo, nome, qtd, unit_centavos)
         VALUES ($1,$2,'servico',$3,$4,1,$5)`,
        [tenant.id, ordem.id, sv.codigo, sv.nome, sv.precoCentavos]);

      // Checklist de entrada: 6 itens, 3 marcados (contador "3/6" do §5).
      await db.query('DELETE FROM checklist_itens WHERE os_id = $1', [ordem.id]);
      for (const [n, descricao] of CHECKLIST_ENTRADA.entries()) {
        await db.query(
          `INSERT INTO checklist_itens (tenant_id, os_id, descricao, marcado, ordem)
           VALUES ($1,$2,$3,$4,$5)`,
          [tenant.id, ordem.id, descricao, n < CHECKLIST_MARCADOS, n]);
      }
    }

    await db.query(
      `INSERT INTO uso_tenant (tenant_id, competencia, os_criadas)
       VALUES ($1, to_char(now(),'YYYY-MM'), $2)
       ON CONFLICT (tenant_id, competencia) DO UPDATE SET os_criadas = EXCLUDED.os_criadas`,
      [tenant.id, quantas.length]);

    if (i > 0) os = OS_PRIMEIRA + 23 + i;
  }

  await db.query('COMMIT');
  await db.end();
  console.log(`seeds aplicados: ${TENANTS.length} tenants`);
}

main().catch((e) => { console.error(e); process.exit(1); });
