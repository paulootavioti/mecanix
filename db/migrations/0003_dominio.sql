-- @role: owner
-- Tabelas de domínio. TODAS carregam tenant_id e recebem RLS forçada em 0004.
-- A regra é absoluta: nenhuma tabela de domínio sem tenant_id, nenhuma tabela
-- com tenant_id sem RLS. O teste tests/rls-metadata.test.ts varre o catálogo
-- do Postgres e falha se alguma escapar.

-- Filiais / CNPJs do inquilino. O limite de CNPJs do plano conta linhas aqui.
CREATE TABLE filiais (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  cnpj                  text NOT NULL,
  -- Raiz do CNPJ (8 primeiros dígitos): define o escopo do compartilhamento
  -- de carteira entre filiais quando o tenant o habilita (decisão D-005).
  cnpj_raiz             text NOT NULL,
  compartilha_carteira  boolean NOT NULL DEFAULT false,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT filiais_tenant_cnpj_key UNIQUE (tenant_id, cnpj)
);
CREATE INDEX filiais_tenant_id_idx ON filiais (tenant_id);

-- Carteira de clientes — privativa de cada oficina.
-- A chave é (tenant_id, cpf_cnpj), NUNCA cpf_cnpj global: o mesmo documento
-- atendido por duas oficinas gera dois registros independentes, com históricos,
-- preços e limites de crédito separados.
CREATE TABLE clientes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cpf_cnpj         text NOT NULL,
  tipo             text NOT NULL,
  nome             text NOT NULL,
  razao_social     text,
  contato          text,
  email            text,
  cidade           text,
  situacao         text,
  limite_credito_centavos  bigint NOT NULL DEFAULT 0,
  acesso_portal    boolean NOT NULL DEFAULT false,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_tenant_doc_key UNIQUE (tenant_id, cpf_cnpj),
  CONSTRAINT clientes_tipo_check CHECK (tipo IN ('pf', 'pj')),
  CONSTRAINT clientes_doc_check CHECK (cpf_cnpj ~ '^[0-9]{11}$' OR cpf_cnpj ~ '^[0-9]{14}$')
);
CREATE INDEX clientes_tenant_id_idx ON clientes (tenant_id);

CREATE TABLE veiculos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id   uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  placa        text NOT NULL,
  marca        text NOT NULL,
  modelo       text NOT NULL,
  ano          text,
  cor          text,
  combustivel  text,
  chassi       text,
  renavam      text,
  km           integer,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT veiculos_tenant_placa_key UNIQUE (tenant_id, placa)
);
CREATE INDEX veiculos_tenant_id_idx ON veiculos (tenant_id);

-- Catálogo — peças, serviços e kits são por tenant (preços são sigilo comercial).
CREATE TABLE pecas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo              text NOT NULL,
  nome                text NOT NULL,
  marca               text,
  saldo               integer NOT NULL DEFAULT 0,
  minimo              integer NOT NULL DEFAULT 0,
  custo_medio_centavos  bigint NOT NULL DEFAULT 0,
  preco_centavos      bigint NOT NULL DEFAULT 0,
  CONSTRAINT pecas_tenant_codigo_key UNIQUE (tenant_id, codigo)
);
CREATE INDEX pecas_tenant_id_idx ON pecas (tenant_id);

CREATE TABLE servicos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo           text NOT NULL,
  nome             text NOT NULL,
  tempo_horas      numeric(6, 2) NOT NULL DEFAULT 0,
  preco_centavos   bigint NOT NULL DEFAULT 0,
  CONSTRAINT servicos_tenant_codigo_key UNIQUE (tenant_id, codigo)
);
CREATE INDEX servicos_tenant_id_idx ON servicos (tenant_id);

CREATE TABLE kits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo          text NOT NULL,
  nome            text NOT NULL,
  preco_centavos  bigint NOT NULL DEFAULT 0,
  CONSTRAINT kits_tenant_codigo_key UNIQUE (tenant_id, codigo)
);
CREATE INDEX kits_tenant_id_idx ON kits (tenant_id);

CREATE TABLE kit_itens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kit_id      uuid NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  peca_id     uuid REFERENCES pecas(id) ON DELETE RESTRICT,
  servico_id  uuid REFERENCES servicos(id) ON DELETE RESTRICT,
  qtd         numeric(10, 2) NOT NULL DEFAULT 1,
  CONSTRAINT kit_itens_tipo_check CHECK (tipo IN ('peca', 'servico')),
  CONSTRAINT kit_itens_ref_check CHECK (
    (tipo = 'peca' AND peca_id IS NOT NULL AND servico_id IS NULL) OR
    (tipo = 'servico' AND servico_id IS NOT NULL AND peca_id IS NULL)
  )
);
CREATE INDEX kit_itens_tenant_id_idx ON kit_itens (tenant_id);

-- Ordem de serviço. O número é único por tenant — nunca colide entre inquilinos.
CREATE TABLE ordens_servico (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero       text NOT NULL,
  cliente_id   uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  veiculo_id   uuid NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  status       text NOT NULL DEFAULT 'aprovacao',
  consultor    text,
  tecnico      text,
  box          text,
  km_entrada   integer,
  abertura     timestamptz NOT NULL DEFAULT now(),
  previsao     timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ordens_servico_tenant_numero_key UNIQUE (tenant_id, numero),
  -- Estados da máquina: aprovação → execução → peça → pronto → entregue.
  CONSTRAINT ordens_servico_status_check
    CHECK (status IN ('aprovacao', 'execucao', 'peca', 'pronto', 'entregue'))
);
CREATE INDEX ordens_servico_tenant_id_idx ON ordens_servico (tenant_id);
CREATE INDEX ordens_servico_tenant_status_idx ON ordens_servico (tenant_id, status);

CREATE TABLE os_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  os_id           uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  tipo            text NOT NULL,
  codigo          text,
  nome            text NOT NULL,
  qtd             numeric(10, 2) NOT NULL DEFAULT 1,
  unit_centavos   bigint NOT NULL DEFAULT 0,
  CONSTRAINT os_itens_tipo_check CHECK (tipo IN ('peca', 'servico'))
);
CREATE INDEX os_itens_tenant_id_idx ON os_itens (tenant_id);
CREATE INDEX os_itens_os_id_idx ON os_itens (os_id);

-- Linha do tempo da OS. Recebe avanço de etapa, publicação de orçamento,
-- emissão de NF, mensagem do portal, agendamento e pesquisa de satisfação.
CREATE TABLE os_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  os_id       uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  descricao   text NOT NULL,
  quem        text NOT NULL,
  cor         text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_eventos_tenant_id_idx ON os_eventos (tenant_id);
CREATE INDEX os_eventos_os_id_idx ON os_eventos (os_id, criado_em);

CREATE TABLE checklist_itens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  os_id       uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  descricao   text NOT NULL,
  marcado     boolean NOT NULL DEFAULT false,
  ordem       smallint NOT NULL DEFAULT 0
);
CREATE INDEX checklist_itens_tenant_id_idx ON checklist_itens (tenant_id);
CREATE INDEX checklist_itens_os_id_idx ON checklist_itens (os_id);

-- Séries fiscais por tenant e por filial. A numeração nunca colide entre
-- inquilinos porque a unicidade inclui tenant_id, e o próximo número é
-- alocado com lock na linha da série.
CREATE TABLE series_fiscais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filial_id       uuid NOT NULL REFERENCES filiais(id) ON DELETE CASCADE,
  modelo          text NOT NULL,
  serie           text NOT NULL,
  proximo_numero  integer NOT NULL DEFAULT 1,
  ambiente        text NOT NULL DEFAULT 'homologacao',
  CONSTRAINT series_fiscais_key UNIQUE (tenant_id, filial_id, modelo, serie),
  CONSTRAINT series_fiscais_modelo_check
    CHECK (modelo IN ('nfe', 'nfse', 'nfce', 'sat')),
  CONSTRAINT series_fiscais_ambiente_check
    CHECK (ambiente IN ('producao', 'homologacao')),
  CONSTRAINT series_fiscais_proximo_check CHECK (proximo_numero >= 1)
);
CREATE INDEX series_fiscais_tenant_id_idx ON series_fiscais (tenant_id);

-- Credenciais de integração — por tenant, nunca compartilhadas.
-- O segredo é gravado cifrado; a coluna guarda o ciphertext.
CREATE TABLE integracoes_credenciais (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provedor          text NOT NULL,
  conectado         boolean NOT NULL DEFAULT false,
  segredo_cifrado   bytea,
  sincronia_em      timestamptz,
  CONSTRAINT integracoes_credenciais_key UNIQUE (tenant_id, provedor)
);
CREATE INDEX integracoes_credenciais_tenant_id_idx ON integracoes_credenciais (tenant_id);

-- Contadores de uso, por tenant e competência (AAAA-MM). Alimentam os
-- limites de plano de OS/mês e armazenamento.
CREATE TABLE uso_tenant (
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  competencia          text NOT NULL,
  os_criadas           integer NOT NULL DEFAULT 0,
  armazenamento_bytes  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, competencia),
  CONSTRAINT uso_tenant_competencia_check CHECK (competencia ~ '^[0-9]{4}-[0-9]{2}$')
);

-- Auditoria do tenant. Registra acesso a ficha de cliente e impersonation
-- do provedor — ambos visíveis para o próprio inquilino.
CREATE TABLE auditoria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  acao           text NOT NULL,
  entidade       text,
  entidade_id    uuid,
  detalhe        text,
  -- Verdadeiro quando a ação foi feita pelo provedor personificando alguém.
  impersonacao   boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_tenant_id_idx ON auditoria (tenant_id, criado_em DESC);

-- Troca de contexto entre tenants, auditada conforme o README.
CREATE TABLE trocas_contexto (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_anterior   uuid REFERENCES tenants(id) ON DELETE SET NULL,
  criado_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trocas_contexto_tenant_id_idx ON trocas_contexto (tenant_id, criado_em DESC);
