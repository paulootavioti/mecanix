-- @role: owner
-- Transforma a aplicação de RLS em função reutilizável.
--
-- Motivo: em 0004 a varredura rodava dentro de um bloco DO, que executa uma
-- única vez. Tabela de domínio criada em migração posterior nascia SEM RLS —
-- foi o que aconteceu com documentos_fiscais e inutilizacoes em 0006, e o
-- teste de metadados pegou.
--
-- A partir daqui, toda migração que criar tabela com tenant_id deve terminar
-- com:
--     SELECT aplicar_rls_multitenant();
--
-- A função é idempotente: recriar a policy de tabelas já protegidas não muda
-- nada, então chamá-la a mais é inofensivo — chamar a menos é que quebra, e o
-- teste acusa.

CREATE OR REPLACE FUNCTION aplicar_rls_multitenant()
RETURNS TABLE (tabela text, acao text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  t text;
  ja_protegida boolean;
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
    SELECT c.relrowsecurity AND c.relforcerowsecurity INTO ja_protegida
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t;

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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO mecanix_app', t);

    tabela := t;
    acao := CASE WHEN ja_protegida THEN 'reafirmada' ELSE 'protegida' END;
    RETURN NEXT;
  END LOOP;
END
$fn$;

-- Protege o que 0006 deixou passar.
SELECT aplicar_rls_multitenant();
