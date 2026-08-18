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

- **P-001 (Fase 2)** · Fórmula de "margem estimada X%" no carrinho do wizard (§6).
- **P-002 (Fase 2)** · Numeração fiscal de nota rejeitada: número é queimado e
  inutilizado, ou devolvido à faixa? Regra fiscal — não será presumida.
- **P-003 (Fase 2)** · A etapa "peça" da máquina de estados é obrigatória ou
  desviável de "execução" direto para "pronto"? (§5 sugere linear; o pátio sugere opcional.)
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
