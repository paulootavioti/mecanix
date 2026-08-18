-- @role: owner
-- Tabelas de plataforma. Estas NÃO têm tenant_id e NÃO têm RLS por tenant:
-- descrevem a própria plataforma (identidade global, catálogo de planos,
-- registro de inquilinos). O acesso a elas é filtrado na aplicação pelo
-- vínculo do usuário, não por contexto de tenant.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  nome          text NOT NULL,
  senha_hash    text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expira_em     timestamptz NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Catálogo de planos. NULL em um limite = ilimitado.
CREATE TABLE plans (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                   text NOT NULL,
  nome                     text NOT NULL,
  preco_mensal_centavos    integer NOT NULL,
  preco_anual_centavos     integer NOT NULL,
  max_usuarios             integer,
  max_cnpjs                integer,
  max_armazenamento_bytes  bigint,
  max_os_mes               integer,
  ordem                    smallint NOT NULL,
  CONSTRAINT plans_codigo_key UNIQUE (codigo),
  CONSTRAINT plans_codigo_check CHECK (codigo IN ('iniciante', 'intermediaria', 'profissional'))
);

-- Matriz de funcionalidades por plano (coluna "Destaques" do README).
CREATE TABLE plan_features (
  plan_id   uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature   text NOT NULL,
  PRIMARY KEY (plan_id, feature)
);

CREATE TABLE tenants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL,
  nome             text NOT NULL,
  unidade          text NOT NULL,
  cor              text NOT NULL,
  dominio          text,
  plan_id          uuid NOT NULL REFERENCES plans(id),
  status           text NOT NULL DEFAULT 'ativo',
  trial_expira_em  timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_key UNIQUE (slug),
  CONSTRAINT tenants_dominio_key UNIQUE (dominio),
  CONSTRAINT tenants_status_check CHECK (status IN ('ativo', 'trial', 'suspenso', 'cancelado')),
  -- Slug vira subdomínio (<slug>.mecanix.app): minúsculas, dígitos e hífen,
  -- sem hífen nas pontas, 3 a 40 caracteres.
  CONSTRAINT tenants_slug_formato_check CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$')
);

-- Um login alcança N tenants, com papel distinto em cada um.
-- Os quatro papéis existem em todos os planos (decisão D-003).
CREATE TABLE tenant_users (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  papel      text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id),
  CONSTRAINT tenant_users_papel_check
    CHECK (papel IN ('gerente', 'financeiro', 'consultor', 'tecnico'))
);
CREATE INDEX tenant_users_tenant_id_idx ON tenant_users (tenant_id);

-- Super-admin do provedor. Separado de tenant_users de propósito: ser
-- provedor não é um papel dentro de um tenant.
CREATE TABLE provider_admins (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- Lead da landing page. Nasce antes de existir tenant; ganha tenant_id
-- quando o trial é provisionado.
CREATE TABLE leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina        text NOT NULL,
  slug_desejado  text NOT NULL,
  nome           text NOT NULL,
  whatsapp       text NOT NULL,
  email          text NOT NULL,
  porte          text NOT NULL,
  plano_codigo   text NOT NULL,
  tenant_id      uuid REFERENCES tenants(id) ON DELETE SET NULL,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
