-- @role: owner
-- Policy adicional em tenant_users: o usuário enxerga o próprio vínculo.
--
-- Motivo: quem trabalha em uma oficina é informação do inquilino, então
-- tenant_users tem tenant_id e recebe RLS como qualquer tabela de domínio.
-- Mas o login precisa responder "a quais oficinas este usuário pertence?"
-- ANTES de haver contexto de tenant — é justamente essa lista que permite
-- escolher o tenant.
--
-- Em vez de abrir exceção para a tabela, o acesso é ampliado pelo mínimo:
-- uma segunda policy que libera apenas as linhas do PRÓPRIO usuário, a partir
-- de app.user_id. Policies permissivas são combinadas com OR, então vale
-- "linhas do tenant corrente OU linhas do próprio usuário".
--
-- O que isto NÃO permite: ver colegas de um tenant sem estar naquele contexto,
-- ver vínculos de terceiros, ou alcançar qualquer outra tabela de domínio.

CREATE POLICY tenant_users_proprio_vinculo ON public.tenant_users
  FOR SELECT
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Mesma necessidade em trocas_contexto: a auditoria de troca é do inquilino,
-- mas o próprio usuário precisa poder registrar a saída de um tenant para
-- outro. A escrita continua exigindo contexto de tenant (a policy de
-- isolamento é a única com WITH CHECK); esta aqui é só de leitura.
CREATE POLICY trocas_contexto_proprias ON public.trocas_contexto
  FOR SELECT
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
