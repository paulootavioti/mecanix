# Decisões de regra de negócio

Registro das definições que não estavam no `README.md` ou que o contradiziam.
Nada aqui foi inventado — cada item foi confirmado pelo responsável do produto.

## D-001 · Usuários da Iniciante — 5, não 4
**Contexto**: o README fixa "até 5"; em conversa foi mencionado "até 4 colaboradores".
**Decisão**: vale **5**. O README é a fonte.

## D-002 · Limites numéricos continuam valendo
**Contexto**: foi dito que "o que diferencia os planos são as funcionalidades e perfis de acesso",
o que poderia significar a remoção das cotas.
**Decisão**: os limites do README continuam **todos** valendo e bloqueiam ao exceder —
usuários, CNPJs, armazenamento e OS/mês. Funcionalidade e perfil são diferenciadores
*adicionais*, não substitutos.

| Plano | Preço/mês | Usuários | CNPJs | Armazenamento | OS/mês |
|---|---|---|---|---|---|
| Iniciante | R$ 249 | 5 | 1 | 20 GB | 300 |
| Intermediária | R$ 589 | 15 | 2 | 50 GB | 1.500 |
| Profissional | R$ 1.290 | ilimitado | ilimitado | 100 GB | ilimitado |

`100 GB+` do README é lido como piso contratado de 100 GB e é o valor aplicado.

## D-003 · Perfis de acesso não dependem do plano
**Decisão**: os quatro perfis (gerente, financeiro, consultor, técnico) existem em
**todos** os planos. O plano limita *quantos* colaboradores e *quais funcionalidades*,
nunca *quais perfis*.

## D-004 · Matriz de funcionalidades = coluna "Destaques"
**Decisão**: o recorte por plano sai literalmente da coluna "Destaques" do README.
Consequência explicitamente confirmada: **a Iniciante não emite NF-e** — tem apenas
NFC-e e NFS-e. NF-e conjugada e de devolução entram na Intermediária.

## Pendentes — a decidir na fase que as consome
Não serão inventadas; o código fica com o valor ausente e o teste falhando.

- **P-004 (Fase 3)** · Regra do parcelamento "até 3× de R$ X sem juros" (§10):
  sempre 3×, ou há valor mínimo de parcela?
## D-005 · Multiempresa — compartilhamento é opt-in, escopo é o CNPJ raiz
**Contexto**: a frase do README parecia se contradizer.
**Leitura correta**: o compartilhamento da carteira **só existe se o tenant habilitar**;
"o padrão é compartilhar entre filiais do mesmo CNPJ raiz e isolar entre CNPJs distintos"
descreve o escopo *depois* de habilitado, não o estado inicial. Sem contradição.
**Decisão**: `filiais.compartilha_carteira` desligado por padrão; quando ligado, a carteira
é visível entre filiais de mesmo CNPJ raiz e permanece isolada entre CNPJs distintos.
  "só quando o próprio tenant habilitar" e também que "o padrão é compartilhar entre

## D-006 · A etapa "peça" da OS é opcional

**Decisão**: a etapa de peças não é obrigatória para finalizar uma OS. De
"execução" a OS pode ir para "peça" (quando falta componente) **ou** direto
para "pronto". Quando não há peça, a lista de itens do tipo peça fica vazia e
o subtotal de peças é R$ 0,00 — a OS registra apenas os serviços prestados.

Transições válidas:

| De | Para |
|---|---|
| `aprovacao` | `execucao` |
| `execucao` | `peca` **ou** `pronto` |
| `peca` | `pronto` |
| `pronto` | `entregue` |
| `entregue` | — (terminal) |

**Consequência de UI ainda aberta (P-006)**: o README (§5) descreve um botão
*único* de avanço, cujo rótulo em "execução" é "Solicitar peça faltante". Com
a etapa opcional, "execução" passa a ter duas saídas, e o README não dá a copy
da segunda. O botão principal mantém o rótulo do README; a ação alternativa
fica como ação secundária, com a copy pendente.

## D-007 · Margem estimada = lucro bruto sobre o preço de venda

**Fórmula**: `margem % = (preço de venda total − custo total) ÷ preço de venda total × 100`

- **Preço de venda total**: soma cobrada por peças e serviços, já com descontos.
- **Custo total**: custo de aquisição das peças (custo médio do estoque) +
  custo/hora da mão de obra multiplicado pelo tempo do serviço.

O custo/hora é R$ 148,00, valor que vem do próprio README (§3 e §6).

Exemplo de conferência: venda R$ 500,00 e custo R$ 300,00 → margem 40%.

## D-008 · Numeração fiscal após rejeição da SEFAZ

Uma nota rejeitada não é gravada como autorizada na SEFAZ, mas o número
já reservado fica pendente de resolução. Três regras, nesta ordem:

1. **Reenvio com correção** — o número **não** é descartado de imediato.
   Corrige-se o XML (NCM, CST, CPF, endereço) e reenvia-se **com o mesmo
   número e série**.
2. **Inutilização** — se o erro não puder ser corrigido na mesma nota e a
   emissão for abandonada, o número fica vago e quebra a sequência. É
   obrigatório enviar pedido de Inutilização de Numeração à SEFAZ, para não
   caracterizar omissão de receita.
3. **Sem reuso** — número inutilizado **nunca** volta a ser usado.

Modelagem: `documentos_fiscais.situacao` cobre o ciclo
`reservado → rejeitado → (reenviado | abandonado) → inutilizado`, e a
numeração inutilizada é registrada para impedir reemissão.
