-- @role: superuser
-- Bootstrap de papéis e blindagem do schema.
--
-- Dois papéis, com separação deliberada:
--   mecanix_owner — dono das tabelas, executa DDL. Só as migrações usam.
--   mecanix_app   — runtime da aplicação. NOBYPASSRLS, sem DDL, NÃO é dono
--                   de nenhuma tabela. É esta a conexão da aplicação.
--
-- A separação não é estética. Postgres deixa o DONO de uma tabela ignorar as
-- policies de RLS a menos que a tabela use FORCE ROW LEVEL SECURITY; e um papel
-- com BYPASSRLS ignora sempre. Se a aplicação rodasse como dono ou superusuário,
-- toda a barreira de isolamento seria decorativa.

-- Papéis são objetos globais do cluster e podem já existir de uma instalação
-- anterior, com atributos diferentes. Por isso o CREATE é condicional mas o
-- ALTER é incondicional: o estado final não depende do que havia antes.
--
-- As senhas abaixo são de DESENVOLVIMENTO. Em produção os papéis são criados
-- fora da migração, com credenciais gerenciadas pelo provedor, e este arquivo
-- encontra os papéis já existentes e apenas reafirma os atributos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mecanix_owner') THEN
    CREATE ROLE mecanix_owner PASSWORD 'owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mecanix_app') THEN
    CREATE ROLE mecanix_app PASSWORD 'app';
  END IF;
END
$$;

-- NOBYPASSRLS é explícito de propósito: um BYPASSRLS herdado de instalação
-- anterior anularia silenciosamente todo o isolamento.
ALTER ROLE mecanix_app   LOGIN NOBYPASSRLS NOCREATEDB NOCREATEROLE NOSUPERUSER NOINHERIT;
ALTER ROLE mecanix_owner LOGIN NOBYPASSRLS NOCREATEDB NOCREATEROLE NOSUPERUSER;

-- Até o PostgreSQL 14, PUBLIC recebe CREATE no schema public por padrão
-- (o PG15 passou a revogar isso sozinho). Sem este REVOKE, mecanix_app
-- poderia criar tabelas próprias — sem RLS — dentro do schema da aplicação.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CREATE, USAGE ON SCHEMA public TO mecanix_owner;
GRANT USAGE ON SCHEMA public TO mecanix_app;

-- Toda tabela futura criada pelo owner já nasce acessível ao app em DML,
-- e apenas em DML: nada de TRUNCATE, REFERENCES ou TRIGGER.
ALTER DEFAULT PRIVILEGES FOR ROLE mecanix_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mecanix_app;
ALTER DEFAULT PRIVILEGES FOR ROLE mecanix_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mecanix_app;
