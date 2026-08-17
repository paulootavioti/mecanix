# Handoff: ERP SaaS multi-tenant para oficinas mecânicas (Mecanix Cloud)

## Overview
> **Como usar este pacote (leia primeiro).** Implemente na ordem: (1) fundação multi-tenant — `tenant_id` + RLS + `(tenant_id, cpf_cnpj)` como chave de cliente, descrita na seção "Arquitetura multi-tenancy", que é requisito e não detalhe; (2) app da oficina (pátio/OS → wizard de orçamento → cadastros/estoque → financeiro/fiscal → relacionamento/integrações); (3) portal do cliente; (4) painéis de setor; (5) console do provedor; (6) landing page de assinaturas. Os valores de cor, tipografia e espaçamento estão em "Design Tokens" e devem ser usados literalmente. Cada tela tem uma captura em `screenshots/` — use como referência visual e o HTML como referência de comportamento. O que **não** deve ser portado: os estilos inline, o arquivo `support.js` e a responsividade via JavaScript (use CSS).

Sistema de gestão para oficinas mecânicas em arquitetura **multi-tenant**: uma única instância e um único código-base atendem várias oficinas ("inquilinos"), que compartilham infraestrutura mas nunca veem dados uma da outra. O protótipo cobre quatro superfícies distintas:

1. **App da oficina** (back-office denso, tipo ERP) — pátio/OS, orçamentos, cadastros, estoque, financeiro, fiscal, relacionamento, integrações.
2. **Portal do cliente final** — acompanhamento do serviço, aprovação de orçamento, chat com a oficina, agendamento, histórico, notas fiscais e pesquisa de satisfação.
3. **Console do provedor (super-admin)** — gestão de tenants, planos (Iniciante / Intermediária / Profissional), limites, séries fiscais e impersonation.
4. **Painéis de setor (modo TV)** — o mesmo painel com seis leituras: sala de espera, pista/boxes, estoque, área de vendas, pátio de entrada e saída, sala administrativa.
5. **Landing page de assinaturas** — página pública de divulgação e venda dos planos, com formulário de criação de ambiente (trial de 14 dias).

## About the Design Files
Os arquivos deste pacote são **referências de design criadas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar estes designs no ambiente já existente do codebase** de destino (React, Vue, Next, SwiftUI, nativo etc.), usando seus padrões, bibliotecas e sistema de design. Se ainda não existir ambiente, escolha o framework mais adequado ao projeto (recomendação: React + TypeScript com um backend multi-tenant, ex.: Postgres com RLS) e implemente os designs lá.

O arquivo `Oficina Multi-Tenant.dc.html` é um componente de design com estilos **inline** e uma classe de lógica em JavaScript simples; a estrutura de estado dele é uma boa referência do modelo de dados, mas não deve ser portada literalmente.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, hierarquia e interações estão definidos. Recreie a UI com fidelidade visual usando as bibliotecas do codebase. O layout responsivo do protótipo é resolvido em JavaScript (medindo `window.innerWidth`) porque o formato do protótipo não permite media queries — **na implementação real use CSS (media queries / container queries)**, com os mesmos pontos de quebra.

---

## Arquitetura multi-tenancy (requisito central, não opcional)

- **Isolamento**: `tenant_id` em **todas** as tabelas de domínio; Row-Level Security no banco. Nenhuma query sai sem o filtro do inquilino. Planos superiores podem receber schema dedicado.
- **Carteira de clientes é privativa de cada oficina (sigilo comercial)**: clientes, veículos, histórico, valores praticados, contatos e documentos pertencem à oficina que os cadastrou. Uma oficina **nunca** vê, busca, autocompleta ou recebe sugestão de cliente de outra. Consequências para a implementação:
  - Chave única de cliente é `(tenant_id, cpf_cnpj)` — nunca `cpf_cnpj` global. O mesmo CPF/CNPJ atendido por duas oficinas gera **dois registros independentes**, com históricos, tabelas de preço e limites de crédito separados.
  - A busca por CPF/CNPJ tem dois estágios distintos: (a) base **interna do tenant** — pode preencher histórico, veículos e condições comerciais; (b) consulta pública/externa (Receita) — pode preencher apenas dados cadastrais públicos (razão social, situação, endereço). Nunca use a base de outro tenant como fonte de preenchimento.
  - Não existe deduplicação, "cliente global", relatório consolidado entre tenants nem métrica cruzada exposta a oficinas. O console do provedor vê **contagens e uso agregados**, não dados de clientes.
  - Multiempresa (filiais do mesmo inquilino) é a única situação em que a carteira pode ser compartilhada, e apenas quando o próprio tenant habilitar — o padrão é compartilhar entre filiais do mesmo CNPJ raiz e isolar entre CNPJs distintos.
  - Auditoria: todo acesso a ficha de cliente registra usuário, tenant e horário; impersonation pelo provedor é sempre registrada e visível na auditoria do tenant.
- **Identidade**: login único; um usuário pode pertencer a **N tenants** com papéis distintos (gerente, financeiro, consultor, técnico). Troca de contexto disponível no topo do app e auditada.
- **Fiscal**: cada tenant tem CNPJ, certificado A1 e **faixas de numeração próprias** (séries NF-e/NFS-e/NFC-e); filas de transmissão independentes. Numeração nunca colide entre inquilinos.
- **Portal do cliente**: acesso escopado a `tenant_id` + documento (CPF/CNPJ) do cliente. O cliente nunca alcança OS, valores, veículos ou dados de outro cliente nem de outra oficina.
- **White-label**: logo, cor e domínio por inquilino (`vertentes.mecanix.app`), refletidos no app, no portal, nos boletos, nas notas e nos painéis de setor.
- **Planos** (limites aplicados por tenant):

| Plano | Preço/mês | Usuários | Limites | Destaques |
|---|---|---|---|---|
| Iniciante | R$ 249 | até 5 | 1 CNPJ · 20 GB · 300 OS/mês | Cadastros, OS, orçamentos, estoque mínimo, caixa, NFC-e/NFS-e, portal básico (status + chat) |
| Intermediária | R$ 589 | até 15 | 2 CNPJs · 50 GB · 1.500 OS/mês | + XML de compra, cotação, contas a pagar/receber, boletos, NF-e conjugada e devolução, checklist, comissão, agenda, portal com aprovação e agendamento |
| Profissional | R$ 1.290 | ilimitados | CNPJs ilimitados · 100 GB+ · OS ilimitadas | + multiempresa e transferência entre filiais, DRE/balancete/fluxo de caixa, integrações de orçamentação e catálogos, portal white-label com domínio próprio, schema dedicado e auditoria completa |

---

## Design Tokens

### Cores — neutros
| Token | Valor | Uso |
|---|---|---|
| `ink` | `#16181c` | Texto principal, sidebar, botões escuros, cards "hero" |
| `ink-2` | `#24282e` | Item ativo da sidebar, hover escuro |
| `ink-3` | `#1c2026` | Botões secundários dentro da sidebar |
| `border-dark` | `#2c3138` | Bordas em superfícies escuras |
| `page-bg` | `#eceef0` | Fundo da aplicação |
| `surface` | `#ffffff` | Cards, tabelas, header |
| `surface-2` | `#f7f8f9` | Cabeçalho de tabela, rodapé, campos, blocos de resumo |
| `surface-3` | `#e4e7ea` | Colunas do kanban de pátio |
| `border` | `#dfe3e7` | Borda padrão de card/campo |
| `border-2` | `#e6e9ec` / `#eef0f2` / `#f4f6f7` | Bordas internas, divisores de linha |
| `text-muted` | `#6b747d` | Texto secundário |
| `text-dim` | `#79828b` | Labels mono, metadados |
| `text-faint` | `#8a939c` / `#9aa1a9` | Sublinhas, placeholders |
| `panel-bg` | `#0d1014` | Fundo do painel de setor (modo TV) |
| `panel-card` | `#14181d` | Card do painel |
| `panel-card-2` | `#10151a` | Cabeçalho de tabela do painel |
| `panel-border` | `#22282f` / `#1c2228` | Bordas do painel |
| `panel-text` | `#b6bec6` / `#8b95a0` / `#6f7a85` | Texto do painel em 3 níveis |

### Cores — semânticas (oklch, mesma escala de croma/luminosidade)
| Token | Valor | Significado |
|---|---|---|
| `blue` (primário) | `oklch(0.52 0.13 250)` | Ação primária, em execução, peças |
| `green` | `oklch(0.48 0.16 145)` | Sucesso, aprovado, pronto, serviços |
| `green-bright` | `oklch(0.68 0.15 145)` | CTA sobre fundo escuro |
| `amber` | `oklch(0.62 0.15 75)` | Atenção, aguardando aprovação |
| `red` | `oklch(0.55 0.19 25)` | Crítico, atrasado, aguardando peça |
| `teal` | `oklch(0.55 0.11 200)` | Painéis / sala de espera, indicadores de relacionamento |
| `violet` | `oklch(0.52 0.14 300)` | Painel de estoque, categorias auxiliares |
| `gray` | `#8a939c` | Neutro/encerrado |

**Tints de status** (fundo de chip, texto na cor semântica): aprovação `#fdf3e3` · execução `#eaf1fd` · peça `#fdecea` · pronto `#e8f5ec` · entregue `#f2f4f6`. Tints auxiliares: `#eef4fd` (azul), `#eef8f1` (verde).

**Cores de tenant** (avatar/white-label): `#16181c`, `oklch(0.5 0.16 40)`, `oklch(0.5 0.13 250)`.

### Tipografia
- **Sans**: `Archivo` (Google Fonts, pesos 400/500/600/700) — fallback `Helvetica, sans-serif`.
- **Mono**: `IBM Plex Mono` (400/500/600) — usado para números, códigos, placas, labels de tabela e relógio.
- Escala do back-office (denso): título de tela 19px/700/-0.5px · título de card 12–13px/700 · corpo 11,5–12,5px · label mono 8,5–9px/letter-spacing 0.6px (maiúsculas) · KPI 19–20px/700/-0.5px · KPI grande 24px.
- Portal do cliente (mobile-first): título 14px/700 · corpo 12,5px · total 21px mono/700.
- Painel de setor (TV): kicker 10px mono/letter-spacing 1.4px · nome do setor 25px/700 · relógio 34px mono · KPI **38px/700/-1.4px** · linhas de tabela 15px.

### Espaçamento, raio e sombra
- Escala de espaçamento: 2 · 3 · 5 · 6 · 7 · 9 · 10 · 12 · 13 · 16 · 18 · 20 px (gaps de grid/flex predominam sobre margens).
- Raio: 4–6px (chips, tags) · 7–9px (botões, campos) · 10–12px (cards) · 14–16px (cards do painel, portal) · 20px (pills) · 100% (avatares).
- Sombras: dropdown `0 18px 40px -16px rgba(16,24,32,0.35)` · card hover `0 8px 18px -12px rgba(16,24,32,0.4)` · toast `0 18px 40px -16px rgba(0,0,0,0.5)` · painel `0 30px 60px -30px rgba(9,12,15,0.6)` · drawer mobile `0 0 60px rgba(0,0,0,0.4)`.
- Transições: drawer `transform 0.2s ease`; entrada de blocos `riseIn` (opacity 0→1, translateY 6px→0, 0.14–0.18s ease-out).
- **Alvos de toque**: mínimo 38px de altura em controles densos de desktop e **44–46px** em qualquer controle usado em mobile/tablet (botões do portal, campos do wizard, itens de menu).

---

## Responsividade (pontos de quebra)
- **phone**: `< 760px`
- **tablet**: `760–1079px`
- **desktop**: `≥ 1080px`

Comportamento esperado:
| Elemento | Desktop | Tablet | Phone |
|---|---|---|---|
| Sidebar (226px) | fixa, `position: sticky` | drawer off-canvas com overlay `rgba(12,15,18,0.5)` | drawer off-canvas |
| Botão hambúrguer / fechar drawer | oculto | visível (38×38) | visível |
| Busca global no header | visível | visível | oculta |
| Slug do tenant no header | visível | oculto | oculto |
| Unidade do tenant no chip | visível | visível | oculta |
| CTA "+ Novo orçamento" | texto completo | completo | "+ Orçam." |
| Menu de tenants | 340px | 340px | 272px |
| Tabelas de módulo | grid com colunas específicas + cabeçalho | idem | **cabeçalho oculto; cada linha vira um card**: uma célula por linha, label mono à esquerda e valor à direita, padding 13px/14px, gap 5px |
| Grades de cards (KPIs, planos, integrações, kanban) | `repeat(auto-fit, minmax(Xpx, 1fr))` — sem JS | idem | idem |

Larguras mínimas de `auto-fit` usadas: KPI 148–150px · kanban de pátio 196px · integrações 210px · planos 240px · cards de arquitetura 210px · tiles do painel 190px · specs do wizard 140–150px.

Regiões de duas colunas (dashboard, detalhe de OS, passo 3 do wizard, portal) usam **flex-wrap com bases flexíveis** em vez de grid fixo: ex. gráfico `flex: 2 1 420px` + coluna lateral `flex: 1 1 280px`; OS: coluna do veículo `flex: 1 1 300px` + coluna de itens `flex: 2 1 420px`.

---

## Screens / Views

### 1. Login / seleção de oficina
**Propósito**: mostrar que o login é único e dá acesso a N tenants.
**Layout**: duas colunas em `flex-wrap` (`flex: 1 1 420px` escura + `flex: 1 1 380px` branca); empilham em telas estreitas.
- Coluna escura (`#16181c`, padding 40/36): marca (quadrado 30px raio 8px na cor de acento + "Mecanix Cloud" 14px/600 + "ERP MULTI-TENANT PARA OFICINAS" 9,5px mono/`#6b747d`); manchete 34px/700/-1.1px `#ffffff` ("Uma instância. Um código. Cada oficina em seu próprio mundo."); parágrafo 14px/1.6 `#9aa4ae` citando `tenant_id`; três estatísticas (21px mono/600 + legenda 11px): 3 oficinas atendidas, 31 usuários com acesso, 99,9% de uptime em 90 dias.
- Coluna branca: kicker mono "SESSÃO INICIADA · RAFAEL SOUZA"; título "Escolha a oficina" 21px/700; três botões de tenant (min-height 62px, raio 11px, borda `#dfe3e7`, hover borda `#16181c` + fundo `#fafbfc`): avatar 38px com iniciais, nome 13,5px/600, slug mono 9,5px, unidade 11px, pill do plano; depois dois botões lado a lado em `flex-wrap`: "Entrar no portal do cliente" (fundo `ink`) e "Entrar como provedor" (borda tracejada `#cfd5da`).

### 2. App da oficina — chrome
**Sidebar (226px, `#16181c`)**: cabeçalho com avatar do tenant (27px, cor do tenant), nome, plano em mono 9px; navegação com 10 itens (`Dashboard gerencial`, `Pátio & OS`, `Orçamentos`, `Cadastros`, `Estoque`, `Financeiro`, `Fiscal`, `Relacionamento`, `Integrações`, `Painéis de setor`) — cada item tem ponto colorido 5px, label 12,5px/500, badge mono à direita (12, 31, 14, 8, 6), min-height 38px, ativo = fundo `#24282e` + texto branco, hover = mesmo fundo; rodapé com "Portal do cliente", "Console do provedor" e "Sair / trocar de login".
**Header (min-height 56px, branco, sticky)**: hambúrguer (mobile), chip de tenant que abre dropdown de troca (largura 340px; lista de tenants com avatar/nome/unidade/plano + nota explicando que a troca recarrega dados, estoque, séries fiscais e permissões), campo de busca ("Placa, OS, cliente, CPF/CNPJ ou peça"), slug do tenant em mono, CTA "+ Novo orçamento" na cor de acento, avatar do usuário 32px.
**Toast**: fixo, bottom 18px, centralizado, `#16181c`, raio 10px, 12px/500, max-width 90vw, desaparece em 2,8s. Usado como confirmação de toda ação.

### 3. Dashboard gerencial
- Cabeçalho com título + seletor de período (pills `Semana` / `Mês` / `Trimestre`; ativo = `ink`).
- 6 KPIs em `auto-fit minmax(148px,1fr)`: Faturamento R$ 344,1k (+9,4% vs. julho) · OS encerradas 187 (+14) · Ticket médio R$ 1.840 (+R$ 122) · Ocupação de boxes 82% (6 boxes · 2 livres) · Conversão orç. 61% (−3 p.p., em vermelho) · Aprovações no portal 48%.
- Gráfico de barras empilhadas por semana (S27→S34), peças `oklch(0.58 0.13 250)` em cima e serviços `oklch(0.6 0.15 145)` embaixo, altura 178px, valor total em mono acima de cada barra, legenda + "Ticket médio R$ 1.840 · custo/hora R$ 148,00".
- Funil de orçamentos (4 barras horizontais 7px, raio 7px): criados 312 (100%, `#c6cbd1`) · enviados 298 (95%, acento) · aprovados 190 (61%, verde) · perdidos por prazo 46 (15%, vermelho).
- Alertas (4 linhas com ponto colorido 6px): 3 peças críticas abaixo do mínimo · OS-8412 vence hoje 17h sem aprovação no portal · certificado A1 expira em 84 dias · 2 XMLs de compra a conferir.

### 4. Pátio & ordens de serviço (kanban)
- 4 KPIs de pátio: OS abertas 12 (4 sem aprovação) · Em execução 5 (boxes 1–5) · Aguardando peça 2 (prazo médio 2 dias) · Entregas hoje 3 (R$ 9,2k a receber).
- 5 colunas (`auto-fit minmax(196px,1fr)`, fundo `#e4e7ea`, raio 11px, padding 9px): Aguardando aprovação (amber) · Em execução (azul) · Aguardando peça (vermelho) · Pronto p/ entrega (verde) · Entregue (cinza). Cabeçalho com ponto 7px + nome 11px/700 + contagem em mono.
- Card de OS (branco, raio 9px, hover borda `ink` + sombra): placa em chip mono `#f2f4f6`, id da OS em mono à direita, veículo 11,5px/600, cliente 10,5px, rodapé **empilhado** (`flex-direction: column`, gap 3px) com total em mono/600 e prazo 9,5px/700 na cor semântica. Coluna vazia mostra placeholder tracejado "nenhuma OS".
- Clique no card abre o detalhe da OS.

### 5. Detalhe da OS
- Barra superior: botão "← Pátio", id da OS 18px/700 + chip de status (tint + cor semântica), linha de metadados (abertura, consultor, técnico, box) e botão verde de avanço de etapa cujo rótulo depende do status atual ("Aprovar e liberar execução" → "Solicitar peça faltante" → "Peça recebida · finalizar" → "Entregar veículo" → "OS encerrada").
- Coluna esquerda (`flex: 1 1 300px`): card do veículo (faixa de placeholder listrada 100px `repeating-linear-gradient(135deg, #e7eaed 0 8px, #dde1e5 8px 16px)` com legenda mono "foto do veículo na entrada"; placa em chip escuro; modelo; especificações chassi/ano/KM/combustível/cor) · card do cliente (nome, tipo PF/PJ, documento em mono, contato, tags de visitas/seguradora/portal, botão "Abrir portal deste cliente") · checklist de entrada (6 itens, caixa 17px, marcados em verde, contador "3/6", itens clicáveis com min-height 34px).
- Coluna direita (`flex: 2 1 420px`): lista de peças e serviços (chip TIPO 9px/700 colorido — peça = acento, serviço = verde —, nome + código mono, `qtd × unit`, total alinhado à direita 84px) e rodapé com somas de peças, serviços e **total da OS** (17px mono/700); linha do tempo (pontos coloridos + evento 11,5px + "quando · quem"); painel de ações: "Publicar no portal do cliente" (verde), "Enviar por WhatsApp", "Emitir NF conjugada", "Agendar próxima revisão", "Ver como o cliente vê".
- **Integração de processos**: avançar etapa, publicar orçamento, emitir NF e mensagens do portal **escrevem na linha do tempo da OS**; mudanças de status notificam o cliente no portal.

### 6. Novo orçamento (wizard de 4 passos)
Passos em cards (`flex: 1 1 148px`): 1 Veículo · 2 Cliente · 3 Itens e kits · 4 Revisão e envio. Passo concluído mostra "✓" em círculo verde; passo atual tem borda `ink`.
1. **Veículo**: campo PLACA (mono 15px, letter-spacing 2px, maiúsculas, min-height 46px) + "Buscar veículo"; mensagem de estado ("consultando base de veículos…" → "veículo encontrado ✓ 4 OS anteriores"); resultado em grid `auto-fit minmax(140px,1fr)` com marca/modelo, ano, cor, combustível, chassi, renavam, KM da última visita, histórico. Validação: placa com menos de 5 caracteres → "Informe uma placa válida".
2. **Cliente**: campo CPF/CNPJ + "Buscar cliente"; validação de 11/14 dígitos; retorno com razão social, tipo, situação, cidade, contato, e-mail, limite de crédito, títulos em atraso.
3. **Itens e kits**: abas pill `Kits` / `Peças` / `Serviços`; lista de itens clicáveis (nome 12px/600 + metadados mono com estoque/custo/tempo, preço em mono, botão "+" 24px); carrinho lateral sticky (`flex: 1 1 260px`) com itens removíveis, total 18px mono/700 e linha "Custo hora R$ 148,00 · margem estimada X%". Vazio → placeholder tracejado "toque nos itens ao lado".
4. **Revisão e envio**: três cards de resumo (veículo, cliente, itens/validade de 7 dias) e barra escura com total 24px mono e dois CTAs: "Gerar OS e publicar no portal" (verde claro sobre escuro) e "Só e-mail".
Regras de avanço: sem veículo buscado, sem cliente buscado ou com carrinho vazio o botão "Continuar" bloqueia e emite toast explicativo; concluir gera "OS-8413" e volta ao pátio.

### 7. Telas de módulo em tabela (Cadastros, Estoque, Financeiro, Fiscal, Relacionamento)
Estrutura comum: título + subtítulo, botões de ação à direita (o primeiro é primário `ink`), 4 KPIs, filtros em pills, tabela e nota explicativa com borda esquerda 3px `ink`. Rodapé da tabela mostra a contagem de registros e, à direita, `tenant_id = t1` em mono — evidência visual do isolamento.

- **Cadastros** — colunas NOME / DOCUMENTO / VÍNCULO / LTV / HISTÓRICO / TIPO; 8 linhas cobrindo cliente PJ com frota, cliente PF, contrato, fornecedor, seguradora e funcionário. KPIs: 1.284 clientes ativos (+38) · 212 PJ/frotas · 47 fornecedores · 612 acessos ao portal. Ações: "+ Novo cadastro", "Convidar para o portal". Nota: a busca por CPF/CNPJ preenche endereço, razão social e situação cadastral a partir da base pública, e o registro nasce no tenant atual já com acesso ao portal. **A carteira de clientes é exclusiva desta oficina** — nenhum dado vem de outra oficina, e o mesmo CPF/CNPJ atendido em outra unidade é um cadastro separado.
- **Estoque** — ITEM / CÓDIGO-MARCA / SALDO / MÍN. / CUSTO MÉD. / SITUAÇÃO (Crítico, Ok, Repor, Em cotação, com cores). KPIs: R$ 386,4k em estoque · 14 abaixo do mínimo (3 críticos) · giro 38 dias · 2 XMLs pendentes. Ações: "Importar XML de compra", "Nova cotação", "Transferir estoque". Nota: o XML lança entrada, atualiza custo médio, gera contas a pagar, registra auditoria e libera OS que aguardavam a peça.
- **Financeiro** — DATA / LANÇAMENTO / CATEGORIA / VALOR (negativos em vermelho com "−") / SITUAÇÃO. KPIs: saldo R$ 148,2k · a receber 30d R$ 312,7k · a pagar 30d R$ 204,9k · resultado do mês R$ 61,3k (margem 17,8%). Filtros: Movimento / A pagar / A receber / Calendário / DRE / Balancete. Ações: "Emitir boleto", "Lançamento bancário", "Exportar DRE".
- **Fiscal** — DOCUMENTO / TIPO / DESTINATÁRIO / VALOR / SITUAÇÃO (Autorizada, Em processamento, Cancelada, Homologada, Transmitido), incluindo NF-e conjugada, NFS-e, NFC-e, devolução/garantia, inutilização de faixa e SAT/MF-e. KPIs: 1.187 notas (99,4% autorizadas) · 7 rejeições · certificado A1 em 84 dias · 3 manifestações. Ações: "Emitir NF conjugada", "Buscar compras na SEFAZ", "Sintegra".
- **Relacionamento** — CAMPANHA/ROTINA / CANAL / ALCANCE / RESULTADO / STATUS. KPIs: NPS 74 · retorno em 12 meses 62% · 128 revisões agendadas (41 pelo próprio cliente) · R$ 22,4k recuperados em cobrança.

### 8. Integrações
Três grupos com título mono e grid `auto-fit minmax(210px,1fr)`:
- **Orçamentação e seguradoras**: Cília, Audatex, Soma, I360.
- **Catálogos e compra de peças**: Peça Aí, PartsLink24, Catálogo Fraga.
- **Pagamentos e fiscal**: Stone, Boleto Itaú, SEFAZ NF-e, SAT/MF-e.
Cada card: nome 12,5px/700, ponto de estado (verde conectado / `#cfd5da` desconectado), descrição 11px com min-height 32px, botão de alternância ("Conectar" com fundo `ink` quando desconectado; "Conectado · configurar" com borda quando conectado) e metadado mono ("chave do tenant · sincronia 12 min" ou "requer credencial da oficina"). **Credenciais são por tenant, nunca compartilhadas.**

### 9. Console do provedor (super-admin)
- Três cards de plano em `auto-fit minmax(240px,1fr)`; o plano do meio (Intermediária) é destacado com fundo `ink` e texto claro. Cada card: tag mono de usuários **na própria linha, acima do nome** (evita colisão em telas estreitas), nome 13,5px/700, preço 24px mono/700 + "/mês", público-alvo, lista de features com "✓" e rodapé mono com limites.
- Tabela de tenants (linhas em `flex-wrap`): avatar 30px, nome + slug/série em mono, plano na cor do tenant, usuários, barra de armazenamento 6px (vermelha acima de 80%) com legenda, botão "Entrar como" (impersonation). Cabeçalho com "MRR R$ 2.128 · churn 0,8%".
- Quatro cards de arquitetura: ISOLAMENTO (`tenant_id` em todas as tabelas) · IDENTIDADE (usuário em N tenants) · PORTAL (cliente vê só o próprio veículo) · WHITE-LABEL (marca da oficina em todo contato). O console mostra apenas **uso agregado** (usuários, armazenamento, séries, OS/mês) — o provedor não navega dados de clientes das oficinas.

### 10. Portal do cliente (mobile-first)
Header na cor do tenant com avatar, nome da oficina, "Portal do cliente · <cliente>" e botão "Sair". Corpo: `max-width 1120px`, `flex-wrap` com coluna principal `flex: 2 1 380px` e lateral `flex: 1 1 280px`.
- **Card de status**: placa em chip escuro mono, veículo 14px/700, id da OS + abertura em mono, chip de status com tint; barra de progresso 8px (`(etapa+1)/5`) na cor de acento; cinco etapas (Orçamento, Execução, Peça, Pronto, Entregue) com estado "concluído / agora / —"; fatos: previsão de entrega, técnico responsável, consultor, KM de entrada.
- **Orçamento aguardando aprovação** (só quando o status é "aguardando aprovação"): lista de itens com tipo, nome, `qtd × unit` e total; total 21px mono/700, linha "até 3× de R$ X sem juros · Pix, cartão ou boleto"; botões "Aprovar serviço" (verde, min-height 46px) e "Tenho uma dúvida". **Aprovar move a OS para "Em execução" no pátio da oficina e escreve na linha do tempo** — é a integração central do portal.
- **Chat com a oficina**: bolhas alinhadas (cliente à direita, fundo `ink`, texto branco; oficina à esquerda, fundo `#f4f5f6`), metadados mono 9px, área rolável com max-height 320px, campo + botão "Enviar" (Enter envia). Mensagem do cliente entra na linha do tempo da OS e recebe resposta automática de recebimento após ~900ms.
- **Agendar próxima visita**: 4 slots selecionáveis (`flex: 1 1 128px`, min-height 52px) com dia e observação ("box livre", "leva-e-traz", "plantão"); CTA muda de "Escolha um horário" para "Confirmar <dia>"; confirmar registra na agenda da oficina e na linha do tempo.
- **Histórico do veículo**: 4 entradas (data mono + serviço + OS/valor/NF) e botão "Baixar notas fiscais (PDF/XML)".
- **Pesquisa de satisfação**: card escuro com notas 1–10 (`flex: 1 1 34px`, min-height 40px); nota escolhida fica branca; mensagem de retorno diferente para notas ≥ 9 e ≤ 8; a resposta entra na linha do tempo da OS.

### 11. Painéis de setor (modo TV) — nova tela
Cabeçalho da página com nota "modo TV · 1920×1080". Bloco escuro (`#0d1014`, raio 16px, padding 20px, sombra grande) contendo:
- **Topo**: avatar do tenant 40px, kicker mono 10px/letter-spacing 1.4px na cor do setor, nome do setor 25px/700, "oficina · unidade" 11,5px `#8b95a0`; à direita relógio **34px mono ao vivo (atualiza a cada 1s)** e data.
- **Seletor de setor**: 6 pills (ativo = fundo branco/texto `#0d1014`; inativo = borda `#2a3138`, texto `#8b95a0`).
- **4 tiles de KPI** (`auto-fit minmax(190px,1fr)`, fundo `#14181d`, borda `#22282f`, raio 14px): label mono 9,5px, valor **38px/700/-1.4px** na cor do setor, sublinha 12px `#b6bec6`.
- **Tabela do setor** (4 colunas, cabeçalho `#10151a`, linhas 15px com borda `#1c2228`): a **primeira coluna muda de forma conforme o setor** — setores com código curto (sala de espera, pista, pátio) usam `112px` + IBM Plex Mono/letter-spacing 0.5px; setores com texto em prosa (estoque, vendas, administrativa) usam `minmax(0,1.25fr)` + Archivo. Quarta coluna é um chip de estado (fundo `rgba(255,255,255,0.06)`) na cor semântica.
- **Ticker** inferior: ponto na cor do setor + recado operacional do setor.

Conteúdo por setor:
| Setor | Acento | KPIs | Tabela | Ticker |
|---|---|---|---|---|
| Sala de espera | teal | Na sua vez A-14 · Espera média 12 min · Prontos p/ retirada 3 · Em atendimento 5 | Situação dos veículos (placa mascarada `RQK7•22`, veículo, etapa, previsão) | Wi-Fi, senha, café e desconto por aprovar no portal |
| Pista / boxes | azul | Ocupação 5/6 · Horas vendidas 31,4 h · Retrabalho 0 · Peças a separar 4 | Boxes em produção (box, OS/veículo, técnico, etapa com %) | Checklist de saída, EPI, peça trocada volta ao estoque |
| Estoque | violeta | Separações pendentes 4 · Abaixo do mínimo 14 · XML a conferir 2 · Transferências 1 | Fila de separação e reposição (item, código, destino, situação) | Entrada por XML, conferência 11h/17h, etiqueta obrigatória |
| Área de vendas | verde | Meta do dia 78% · Orçamentos hoje 17 · Conversão 61% · Ticket médio R$ 1.840 | Ranking de consultores (nome, orçamentos, conversão, faturado) | Kit mais vendido, ofertar leva-e-traz acima de R$ 1.500 |
| Pátio de entrada e saída | amber | Chegadas previstas 6 · Prontos p/ saída 3 · Vagas livres 9 · Leva-e-traz 2 | Movimentação de hoje (placa, veículo, movimento, horário) | Fotos dos 4 ângulos, chave etiquetada, vaga 12 reservada |
| Sala administrativa | vermelho | Caixa do dia R$ 18,4k · A receber hoje R$ 9,2k · A pagar na semana R$ 41,7k · NPS 74 | Pendências do dia (pendência, responsável, prazo, situação) | DRE fecha 05/09, custo/hora R$ 148,00, reunião sexta 8h |

**Privacidade nos painéis públicos**: em áreas visíveis a terceiros (sala de espera, pátio) as placas aparecem mascaradas (`RQK7•22`) e nunca há valores financeiros nem nome completo do cliente. Painéis internos (pista, estoque, vendas, administrativa) podem exibir OS, técnico e valores.

---

## Interactions & Behavior
- **Navegação**: sidebar troca a tela; card do kanban abre a OS; "← Pátio" volta; console do provedor e portal são superfícies próprias sem o chrome do app.
- **Troca de tenant**: dropdown no header ou "Entrar como" no console → reseta contexto (carrinho, wizard, buscas), volta ao pátio e emite toast "Contexto trocado para <oficina>".
- **Avanço de status da OS**: botão único que executa a próxima transição válida da máquina de estados `aprovação → execução → peça → pronto → entregue`; grava evento na linha do tempo e avisa o cliente.
- **Aprovação no portal**: muda o status da OS, grava "Orçamento APROVADO pelo cliente no portal" e emite toast.
- **Chat**: Enter ou botão envia; mensagem entra na timeline da OS; resposta automática após 900ms.
- **Agendamento**: seleção de slot → confirmação → evento na timeline + toast.
- **Pesquisa de satisfação**: seleção de nota → evento na timeline com cor conforme a nota.
- **Integrações**: alternância otimista com toast; estado por tenant.
- **Buscas simuladas**: placa e documento têm estado "consultando…" com 550ms de latência antes do resultado (implemente como request real com skeleton/spinner).
- **Feedback**: todas as ações sem tela dedicada confirmam por toast (2,8s) em vez de alert/modal.
- **Estados de erro/validação**: mensagens inline curtas ao lado do campo (placa inválida, dígitos de CPF/CNPJ) e toasts de bloqueio no wizard.
- **Hover**: cards e botões claros escurecem a borda para `#16181c`; itens da sidebar mudam para `#24282e`; botões coloridos usam `opacity: 0.88`.
- **Painel de setor**: relógio ao vivo (1s); dados anunciados como atualização a cada 30s — na implementação use polling ou websocket, e considere rotação automática entre setores como opção de configuração do dispositivo.

## State Management
Estado do protótipo (referência para o modelo de dados e para os stores da aplicação):
- **Sessão/contexto**: `tenant` (índice/id), `screen`, `tenantOpen`, `drawer`, `vw` (substituir por CSS), `setor`, `clock`.
- **Operação**: `osStatus[]` (status por OS), `extraTimeline[]` (eventos gerados em runtime), `checked[]` (checklist por OS), `osIdx`, `portalIdx`.
- **Wizard**: `wz` (1–4), `placa`, `doc`, `veiculoOk`, `clienteOk`, `placaMsg`, `docMsg`, `tab`, `cart[]`.
- **Portal**: `chat[]` (`{who: 'cliente'|'oficina', text, meta}`), `chatDraft`, `slot`, `nota`.
- **Módulos**: `filter{}` por tela, `period`, `integraOn{}` (por integração, por tenant).
- **Feedback**: `toast`.

Entidades sugeridas no backend: `tenants`, `tenant_users` (papel por tenant), `clientes` (PF/PJ), `veiculos`, `ordens_servico`, `os_itens`, `os_eventos` (timeline), `checklists`, `pecas`, `insumos`, `movimentos_estoque`, `cotacoes`, `fornecedores`, `seguradoras`, `lancamentos_financeiros`, `titulos`, `documentos_fiscais`, `series_fiscais`, `campanhas`, `agendamentos`, `mensagens_portal`, `pesquisas_satisfacao`, `integracoes_credenciais`, `planos`, `assinaturas`, `auditoria`. Todas com `tenant_id` + RLS.

Dados fictícios do protótipo (OS-8390 a OS-8412, três tenants, catálogo de kits/peças/serviços, seis conjuntos de painel) servem como seeds de desenvolvimento.

## Assets
Nenhuma imagem real. Fotos de veículo são **placeholders listrados** em CSS (`repeating-linear-gradient(135deg, #e7eaed 0 8px, #dde1e5 8px 16px)`) com legenda em mono — substitua por upload real de fotos de entrada/saída. Ícones limitam-se a glifos de texto (`☰`, `⌕`, `×`, `✓`, `▼`, `←`, `+`); troque pela biblioteca de ícones do codebase. Fontes: Archivo e IBM Plex Mono via Google Fonts.

---

## 12. Landing page de assinaturas (`Landing Page Mecanix.dc.html`)
Página pública de marketing e venda, largura de conteúdo `max-width: 1180px`, seções de 60–64px de padding vertical, fundo branco alternando com `#f7f8f9` e blocos escuros (`#16181c`, `#0d1014`). Acento comercial: verde `oklch(0.48 0.16 145)` / `oklch(0.7 0.15 145)` sobre escuro.

**Estrutura (ordem das seções)**
1. **Header sticky** com blur (`rgba(255,255,255,0.94)` + `backdrop-filter: blur(10px)`), logo, links de âncora (Módulos, Painéis, Portal do cliente, Planos, Dúvidas) e CTA "Testar 14 dias grátis".
2. **Hero** escuro em duas colunas (`flex: 1 1 460px` + `flex: 1 1 380px`): selo "MULTI-OFICINA · DADOS 100% ISOLADOS", H1 46px/-1.8px ("Sua oficina inteira em uma tela — do orçamento ao boleto."), subtítulo "Ordem de serviço, estoque, fiscal, financeiro e pós-venda em um sistema só. Seu cliente acompanha o serviço pelo celular e aprova o orçamento sem ligar. **Um sistema inteligente construído na medida certa para seu negócio.**", dois CTAs (primário verde "Começar teste de 14 dias", secundário "Ver planos e preços"), microcopy "Sem cartão de crédito · migração de cadastros inclusa · cancele quando quiser" e 4 provas (1 sistema · 48% aprovados no portal · −45% perguntas no balcão · 14 dias de teste). Coluna direita: mock do painel da sala de espera (janela com 3 KPIs e 4 linhas de veículo com placa mascarada).
3. **Faixa de integrações**: 10 chips (Cília, Audatex, Soma, I360, Peça Aí, PartsLink24, Catálogo Fraga, Stone, SEFAZ, SAT/MF-e).
4. **Problema → solução**: 3 cards com "HOJE" (vermelho) vs "COM O MECANIX" (verde) e a frase de ganho.
5. **Módulos** (`#modulos`): 7 abas em pill (Vendas & pátio, Estoque, Financeiro, Fiscal, Relacionamento, Cadastros, Painéis de setor). Cada aba troca um par de cards: à esquerda kicker + título 22px + texto + 6 bullets com "✓" na cor do módulo; à direita card escuro "NA PRÁTICA" com 3 métricas (valor em mono 20px) e uma frase de integração no rodapé.
6. **Portal do cliente** (`#portal`): texto + 4 mini-cards e, ao lado, **mock de celular** (moldura `border: 8px solid #16181c`, raio 34px, 300px de largura) com card de status, orçamento com CTA verde "Aprovar serviço" e duas bolhas de chat.
7. **Painéis de setor** (`#paineis`): bloco `#0d1014` com 6 cards (ponto colorido, título, descrição, métrica em mono 18px) — um por setor.
8. **Sigilo + prova social**: card com borda esquerda 3px `ink` listando as 5 garantias de isolamento (ambiente isolado, cadastro separado por CPF/CNPJ, nenhum relatório cruzado, certificado/credenciais próprios, auditoria e exportação) + 2 depoimentos.
9. **Planos** (`#planos`): alternador mensal/anual (anual −20%; Iniciante R$ 249→199, Intermediária R$ 589→471, Profissional R$ 1.290→1.032), 3 cards (`auto-fit minmax(272px,1fr)`) com o do meio destacado em `ink`, preço 34px mono, CTA por plano que seleciona o plano e rola até o formulário, 6 features e limites em mono. Abaixo, faixa "Rede com mais de 5 unidades ou concessionária?" com CTA "Falar com especialista".
10. **Formulário de trial** (`#teste`): bloco escuro com título, 4 passos de onboarding numerados e, ao lado, card branco com os campos nome da oficina (gera **preview do slug** `<oficina>.mecanix.app` em tempo real), seu nome, WhatsApp, e-mail e porte (3 opções). Validações inline: oficina e nome obrigatórios, telefone com ≥10 dígitos, e-mail com `@` e `.`. Sucesso troca o card por uma confirmação ("Recebemos seu pedido, <primeiro nome>!") com o slug e o plano escolhido e opção de novo cadastro. Rodapé do card: "Seus dados não são compartilhados com outras oficinas."
11. **FAQ** (`#faq`): acordeão de 6 perguntas (uma aberta por vez; a primeira aberta por padrão), sendo a primeira exatamente sobre sigilo entre oficinas.
12. **Footer** escuro com marca, três colunas de links (Produto, Planos, Suporte) e linha legal.

**Comportamentos**: navegação por âncora com `scrollTo` suave e offset de 70px (header sticky); troca de aba de módulo; alternador de ciclo recalcula os três preços; CTA de plano define o plano do formulário; acordeão de FAQ; validação e estado de sucesso do formulário. Na implementação real, o envio deve criar um lead + provisionar o tenant de trial, e o slug precisa ser validado quanto à disponibilidade.

**SEO/conversão a acrescentar na implementação** (fora do escopo do protótipo): `<title>`/meta description, Open Graph, dados estruturados de produto/preço, consentimento de cookies (LGPD), pixel/analytics e página de política de privacidade.

---

## Files
- `PROMPT-CLAUDE-CODE.md` — prompt pronto para colar na primeira mensagem do Claude Code.
- `Oficina Multi-Tenant.dc.html` — protótipo do produto (login, app da oficina com 9 módulos, portal do cliente, console do provedor, painéis de setor). Estilos inline; lógica em uma classe JS com `renderVals()`.
- `Landing Page Mecanix.dc.html` — protótipo da landing page de assinaturas.
- `screenshots/` — capturas de referência: `01-login-selecao-de-oficina`, `02-patio-e-ordens-de-servico`, `03-detalhe-da-os`, `04-dashboard-gerencial`, `05-cadastros`, `06-estoque`, `07-painel-setor-sala-de-espera`, `08-painel-setor-estoque`, `09-console-do-provedor-planos`, `10-portal-do-cliente`, `11-landing-page`.
- `support.js` — runtime do formato de protótipo. **Não é parte do design**; não porte para produção.
