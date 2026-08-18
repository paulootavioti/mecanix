-- @role: owner
-- Row-Level Security em toda tabela de domínio.
--
-- Aplicado por varredura do catálogo, não por lista fixa: qualquer tabela do
-- schema public que tenha coluna tenant_id recebe RLS. Assim é impossível
-- esquecer uma tabela nova — e o teste de metadados confere o resultado.
--
-- A policy compara com NULLIF(current_setting('app.tenant_id', true), '').
-- São duas proteções empilhadas, e ambas são necessárias:
--
--   * o segundo argumento `true` de current_setting evita erro quando a
--     variável nunca foi definida — nesse caso devolve NULL;
--   * o NULLIF cobre o caso em que ela JÁ foi definida e depois revertida.
--     set_config(..., true) é LOCAL e some no COMMIT, mas o valor volta a ser
--     string VAZIA, não NULL. Sem o NULLIF, ''::uuid lançaria erro de sintaxe
--     em vez de simplesmente não casar, e a mesma consulta se comportaria de
--     um jeito em conexão nova e de outro em conexão reaproveitada do pool.
--
-- Nos dois casos o resultado é NULL, que nunca é igual a nada: zero linhas.
-- Falha fechado, e de forma idêntica em qualquer conexão.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'tenant_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    -- ENABLE liga a RLS para os demais papéis; FORCE a estende ao DONO da
    -- tabela. Sem FORCE, mecanix_owner leria tudo de todos os inquilinos.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I'
      || ' USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)'
      || ' WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO mecanix_app', t
    );
  END LOOP;
END
$$;

-- Tabelas de plataforma: sem contexto de tenant, mas o runtime ainda precisa
-- de DML nelas (login, listagem dos tenants do usuário, provisionamento de trial).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, sessions, plans, plan_features, tenants, tenant_users, provider_admins, leads
  TO mecanix_app;
