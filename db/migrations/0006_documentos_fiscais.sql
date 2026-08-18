-- @role: owner
-- Documentos fiscais e inutilização de numeração.
--
-- Regras fiscais implementadas (decisão D-008):
--   1. Nota rejeitada NÃO devolve o número à faixa. O número segue reservado
--      naquele documento para que o XML seja corrigido e reenviado com o
--      MESMO número e série.
--   2. Se a emissão for abandonada, o número fica vago e quebra a sequência —
--      é obrigatório pedir Inutilização de Numeração à SEFAZ, sob pena de
--      caracterizar omissão de receita.
--   3. Número inutilizado nunca mais é usado.

CREATE TABLE documentos_fiscais (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  serie_id          uuid NOT NULL REFERENCES series_fiscais(id) ON DELETE RESTRICT,
  numero            integer NOT NULL,
  os_id             uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  destinatario      text,
  valor_centavos    bigint NOT NULL DEFAULT 0,
  situacao          text NOT NULL DEFAULT 'reservado',
  chave             text,
  protocolo         text,
  motivo_rejeicao   text,
  tentativas        smallint NOT NULL DEFAULT 0,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),

  -- Numeração única por inquilino e série: nunca colide entre inquilinos.
  CONSTRAINT documentos_fiscais_numero_key UNIQUE (tenant_id, serie_id, numero),
  CONSTRAINT documentos_fiscais_numero_check CHECK (numero >= 1),
  CONSTRAINT documentos_fiscais_situacao_check CHECK (situacao IN (
    'reservado',     -- número alocado, ainda não transmitido
    'transmitindo',  -- em processamento na SEFAZ
    'autorizada',
    'rejeitada',     -- recusada; o número CONTINUA deste documento (regra 1)
    'cancelada',     -- autorizada e depois cancelada
    'inutilizada'    -- emissão abandonada e numeração formalizada (regra 2)
  ))
);
CREATE INDEX documentos_fiscais_tenant_id_idx ON documentos_fiscais (tenant_id);
CREATE INDEX documentos_fiscais_serie_idx ON documentos_fiscais (tenant_id, serie_id, numero);

-- Pedidos de inutilização enviados à SEFAZ. A faixa é fechada nos dois lados.
CREATE TABLE inutilizacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  serie_id         uuid NOT NULL REFERENCES series_fiscais(id) ON DELETE RESTRICT,
  numero_inicial   integer NOT NULL,
  numero_final     integer NOT NULL,
  justificativa    text NOT NULL,
  protocolo        text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inutilizacoes_faixa_check CHECK (numero_final >= numero_inicial),
  CONSTRAINT inutilizacoes_inicial_check CHECK (numero_inicial >= 1),
  -- A justificativa é exigida pela SEFAZ e tem mínimo de 15 caracteres.
  CONSTRAINT inutilizacoes_justificativa_check CHECK (length(justificativa) >= 15)
);
CREATE INDEX inutilizacoes_tenant_id_idx ON inutilizacoes (tenant_id);
CREATE INDEX inutilizacoes_faixa_idx ON inutilizacoes (tenant_id, serie_id, numero_inicial, numero_final);
