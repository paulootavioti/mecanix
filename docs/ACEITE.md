# Checklist de aceite por tela

Derivado de `README.md`. Cada item é verificável. `[T]` = coberto por teste automatizado.

## Transversal (vale para toda tela)
- [ ] Cores, tipografia, espaçamento, raio e sombra saem dos tokens do README — nenhum valor inventado. `[T]`
- [ ] Breakpoints em CSS: phone `< 760px`, tablet `760–1079px`, desktop `≥ 1080px`. Nenhuma medição de largura em JavaScript.
- [ ] Alvos de toque: ≥ 38px em controle denso de desktop, **44–46px** em qualquer controle usado em mobile/tablet. `[T]`
- [ ] Fontes Archivo (400/500/600/700) e IBM Plex Mono (400/500/600).
- [ ] Toda ação sem tela dedicada confirma por toast de 2,8s — nunca `alert` ou modal.
- [ ] Hover: borda de card/botão claro vai para `#16181c`; item de sidebar vai para `#24282e`; botão colorido usa `opacity: 0.88`.
- [ ] Nenhuma query sai sem contexto de tenant. `[T]`

## 1. Login / seleção de oficina
- [ ] Duas colunas `flex: 1 1 420px` (escura) + `flex: 1 1 380px` (branca), empilhando em telas estreitas.
- [ ] Manchete "Uma instância. Um código. Cada oficina em seu próprio mundo." em 34px/700/-1.1px.
- [ ] Três estatísticas: 3 oficinas atendidas · 31 usuários com acesso · 99,9% de uptime em 90 dias.
- [ ] Kicker "SESSÃO INICIADA · RAFAEL SOUZA"; título "Escolha a oficina" 21px/700.
- [ ] Três botões de tenant: min-height 62px, raio 11px, borda `#dfe3e7`, hover borda `#16181c` + fundo `#fafbfc`; avatar 38px com iniciais, nome 13,5px/600, slug mono 9,5px, unidade, pill do plano.
- [ ] Botões "Entrar no portal do cliente" (fundo `ink`) e "Entrar como provedor" (borda tracejada `#cfd5da`).
- [ ] Um mesmo login alcança N tenants com papéis distintos. `[T]`

## 2. Chrome do app
- [ ] Sidebar 226px `#16181c`, sticky no desktop, drawer off-canvas com overlay `rgba(12,15,18,0.5)` em tablet e phone.
- [ ] 10 itens de navegação na ordem do README, com ponto colorido 5px, label 12,5px/500, badge mono (12, 31, 14, 8, 6), min-height 38px; ativo `#24282e`.
- [ ] Rodapé da sidebar: "Portal do cliente", "Console do provedor", "Sair / trocar de login".
- [ ] Header 56px branco sticky: hambúrguer (só mobile/tablet, 38×38), chip de tenant, busca "Placa, OS, cliente, CPF/CNPJ ou peça", slug mono, CTA "+ Novo orçamento", avatar 32px.
- [ ] Responsivo: busca global some no phone; slug some no tablet; unidade some no phone; CTA vira "+ Orçam." no phone; menu de tenants 340px → 272px no phone.
- [ ] Dropdown de troca lista tenants e traz a nota sobre recarregar dados, estoque, séries fiscais e permissões.
- [ ] Trocar de tenant reseta carrinho, wizard e buscas, volta ao pátio e emite toast "Contexto trocado para <oficina>". `[T]`
- [ ] Troca de contexto é auditada. `[T]`

## 3. Dashboard gerencial
- [ ] Seletor de período: pills Semana / Mês / Trimestre; ativo `ink`.
- [ ] 6 KPIs em `auto-fit minmax(148px,1fr)` com os valores do README; conversão 61% com variação −3 p.p. em vermelho.
- [ ] Barras empilhadas S27→S34, altura 178px, peças `oklch(0.58 0.13 250)` acima e serviços `oklch(0.6 0.15 145)` abaixo, total em mono sobre cada barra.
- [ ] Legenda "Ticket médio R$ 1.840 · custo/hora R$ 148,00".
- [ ] Funil: criados 312 (100%) · enviados 298 (95%) · aprovados 190 (61%) · perdidos por prazo 46 (15%), barras 7px raio 7px.
- [ ] 4 alertas com ponto 6px, textos exatos do README.

## 4. Pátio & OS
- [ ] 4 KPIs de pátio com os valores do README.
- [ ] 5 colunas `auto-fit minmax(196px,1fr)`, fundo `#e4e7ea`, raio 11px, padding 9px, nas cores amber/azul/vermelho/verde/cinza.
- [ ] Card de OS: chip de placa mono `#f2f4f6`, id mono à direita, veículo 11,5px/600, cliente 10,5px, rodapé **empilhado** (column, gap 3px) com total mono/600 e prazo 9,5px/700 semântico.
- [ ] Coluna vazia mostra placeholder tracejado "nenhuma OS".
- [ ] Clique no card abre o detalhe da OS.
- [ ] Phone: cabeçalho de tabela oculto e cada linha vira card (label mono à esquerda, valor à direita, padding 13/14px, gap 5px).

## 5. Detalhe da OS
- [ ] Barra superior: "← Pátio", id 18px/700, chip de status com tint, metadados (abertura, consultor, técnico, box).
- [ ] Botão de avanço com rótulo conforme o status: "Aprovar e liberar execução" → "Solicitar peça faltante" → "Peça recebida · finalizar" → "Entregar veículo" → "OS encerrada". `[T]`
- [ ] Máquina de estados `aprovação → execução → peça → pronto → entregue`; transição inválida é rejeitada. `[T]`
- [ ] Coluna esquerda `flex: 1 1 300px`: placeholder listrado 100px `repeating-linear-gradient(135deg, #e7eaed 0 8px, #dde1e5 8px 16px)` com legenda mono "foto do veículo na entrada"; card do cliente com botão "Abrir portal deste cliente"; checklist de 6 itens, caixa 17px, contador "3/6", itens com min-height 34px.
- [ ] Coluna direita `flex: 2 1 420px`: itens com chip TIPO 9px/700 (peça = acento, serviço = verde), `qtd × unit`, total 84px à direita; rodapé com soma de peças, serviços e total 17px mono/700.
- [ ] Linha do tempo com ponto colorido, evento 11,5px e "quando · quem".
- [ ] Ações: "Publicar no portal do cliente", "Enviar por WhatsApp", "Emitir NF conjugada", "Agendar próxima revisão", "Ver como o cliente vê".
- [ ] Avançar etapa, publicar orçamento, emitir NF e mensagem do portal **escrevem na timeline**. `[T]`
- [ ] Abrir ficha de cliente grava auditoria com usuário, tenant e horário. `[T]`

## 6. Wizard de orçamento
- [ ] 4 passos em cards `flex: 1 1 148px`; concluído com "✓" em círculo verde; atual com borda `ink`.
- [ ] Passo 1: campo PLACA mono 15px, letter-spacing 2px, maiúsculas, min-height 46px; busca real com estado de carregamento e tratamento de erro; resultado em `auto-fit minmax(140px,1fr)`. `[T]`
- [ ] Placa com menos de 5 caracteres → "Informe uma placa válida". `[T]`
- [ ] Passo 2: CPF/CNPJ com validação de 11/14 dígitos; busca em dois estágios — base interna do tenant e consulta pública externa, nunca base de outro tenant. `[T]`
- [ ] Passo 3: abas pill Kits / Peças / Serviços; carrinho sticky `flex: 1 1 260px`, total 18px mono/700, linha "Custo hora R$ 148,00 · margem estimada X%"; vazio mostra "toque nos itens ao lado".
- [ ] Passo 4: três cards de resumo, validade de 7 dias, barra escura com total 24px mono e CTAs "Gerar OS e publicar no portal" e "Só e-mail".
- [ ] Sem veículo, sem cliente ou com carrinho vazio, "Continuar" bloqueia e emite toast explicativo. `[T]`
- [ ] Concluir gera "OS-8413" e volta ao pátio. `[T]`

## 7. Módulos em tabela
- [ ] Estrutura comum: título + subtítulo, ações à direita (primeira primária `ink`), 4 KPIs, filtros em pills, tabela, nota com borda esquerda 3px `ink`.
- [ ] Rodapé da tabela: contagem de registros à esquerda e `tenant_id = t1` em mono à direita.
- [ ] **Cadastros**: colunas NOME / DOCUMENTO / VÍNCULO / LTV / HISTÓRICO / TIPO, 8 linhas; KPIs 1.284 (+38) · 212 · 47 · 612; ações "+ Novo cadastro" e "Convidar para o portal"; nota sobre carteira exclusiva.
- [ ] **Estoque**: ITEM / CÓDIGO-MARCA / SALDO / MÍN. / CUSTO MÉD. / SITUAÇÃO (Crítico, Ok, Repor, Em cotação); KPIs R$ 386,4k · 14 (3 críticos) · 38 dias · 2 XMLs.
- [ ] **Financeiro**: DATA / LANÇAMENTO / CATEGORIA / VALOR (negativo em vermelho com "−") / SITUAÇÃO; filtros Movimento / A pagar / A receber / Calendário / DRE / Balancete.
- [ ] **Fiscal**: DOCUMENTO / TIPO / DESTINATÁRIO / VALOR / SITUAÇÃO; cobre NF-e conjugada, NFS-e, NFC-e, devolução/garantia, inutilização de faixa e SAT/MF-e.
- [ ] **Relacionamento**: CAMPANHA/ROTINA / CANAL / ALCANCE / RESULTADO / STATUS; KPIs NPS 74 · 62% · 128 (41) · R$ 22,4k.

## 8. Integrações
- [ ] Três grupos, grid `auto-fit minmax(210px,1fr)`, com as 11 integrações do README.
- [ ] Card: nome 12,5px/700, ponto verde/`#cfd5da`, descrição min-height 32px, botão alternável, metadado mono.
- [ ] Credenciais por tenant, nunca compartilhadas; alternância otimista com toast. `[T]`

## 9. Console do provedor
- [ ] Três cards de plano `auto-fit minmax(240px,1fr)`; Intermediária destacada com fundo `ink`.
- [ ] Tag mono de usuários **em linha própria acima do nome**; preço 24px mono/700 + "/mês".
- [ ] Tabela de tenants: avatar 30px, slug/série mono, barra de armazenamento 6px vermelha acima de 80%, botão "Entrar como".
- [ ] Cabeçalho "MRR R$ 2.128 · churn 0,8%".
- [ ] Quatro cards de arquitetura: ISOLAMENTO, IDENTIDADE, PORTAL, WHITE-LABEL.
- [ ] Console expõe apenas uso agregado — nenhuma ficha de cliente de oficina. `[T]`
- [ ] Impersonation fica registrada e **visível na auditoria do tenant**. `[T]`

## 10. Portal do cliente
- [ ] Acesso escopado a `tenant_id` + documento; nunca alcança OS, valor ou veículo de outro cliente ou de outra oficina. `[T]`
- [ ] Header na cor do tenant, "Portal do cliente · <cliente>", botão "Sair".
- [ ] Corpo `max-width 1120px`, principal `flex: 2 1 380px` + lateral `flex: 1 1 280px`.
- [ ] Card de status: barra de progresso 8px `(etapa+1)/5`; cinco etapas com "concluído / agora / —"; previsão, técnico, consultor, KM.
- [ ] Bloco de orçamento só aparece com status "aguardando aprovação"; total 21px mono/700; botão "Aprovar serviço" verde min-height 46px.
- [ ] **Aprovar move a OS para "Em execução" no pátio e escreve na timeline.** `[T]`
- [ ] Chat: cliente à direita `ink`/branco, oficina à esquerda `#f4f5f6`; área rolável max-height 320px; Enter envia; mensagem entra na timeline; resposta automática de recebimento.
- [ ] Agendamento: 4 slots `flex: 1 1 128px` min-height 52px; CTA muda de "Escolha um horário" para "Confirmar <dia>"; confirmar registra na agenda e na timeline.
- [ ] Histórico: 4 entradas + "Baixar notas fiscais (PDF/XML)".
- [ ] Satisfação: notas 1–10 `flex: 1 1 34px` min-height 40px; retorno diferente para ≥ 9 e ≤ 8; resposta entra na timeline.

## 11. Painéis de setor
- [ ] Bloco `#0d1014`, raio 16px, padding 20px, sombra `0 30px 60px -30px rgba(9,12,15,0.6)`.
- [ ] Topo: avatar 40px, kicker mono 10px/1.4px na cor do setor, nome 25px/700, relógio **34px mono atualizando a cada 1s**, data.
- [ ] 6 pills de setor; ativo branco com texto `#0d1014`.
- [ ] 4 tiles `auto-fit minmax(190px,1fr)`, valor **38px/700/-1.4px** na cor do setor.
- [ ] Primeira coluna da tabela muda de forma: `112px` + mono nos setores de código curto (sala de espera, pista, pátio); `minmax(0,1.25fr)` + Archivo nos de prosa (estoque, vendas, administrativa).
- [ ] Quarta coluna é chip `rgba(255,255,255,0.06)` na cor semântica.
- [ ] Ticker inferior com ponto na cor do setor e o recado do setor.
- [ ] KPIs, tabela e ticker conferem com a tabela de conteúdo por setor do README (6 setores).
- [ ] **Sala de espera e pátio**: placa mascarada `RQK7•22`, sem valor financeiro, sem nome completo do cliente. `[T]`
- [ ] **Pista, estoque, vendas, administrativa**: OS, técnico e valores permitidos. `[T]`
- [ ] Atualização de dados por polling ou websocket (anunciada como 30s).

## 12. Landing page
- [ ] Conteúdo `max-width 1180px`, seções com 60–64px de padding vertical.
- [ ] Header sticky `rgba(255,255,255,0.94)` + `backdrop-filter: blur(10px)`, âncoras Módulos / Painéis / Portal do cliente / Planos / Dúvidas, CTA "Testar 14 dias grátis".
- [ ] Hero: selo "MULTI-OFICINA · DADOS 100% ISOLADOS", H1 46px/-1.8px "Sua oficina inteira em uma tela — do orçamento ao boleto.", subtítulo exato, 2 CTAs, microcopy "Sem cartão de crédito · migração de cadastros inclusa · cancele quando quiser", 4 provas, mock da sala de espera com placa mascarada.
- [ ] Faixa com 10 chips de integração.
- [ ] Problema → solução: 3 cards "HOJE" (vermelho) vs "COM O MECANIX" (verde).
- [ ] Módulos: 7 abas pill, par de cards, card escuro "NA PRÁTICA" com 3 métricas mono 20px.
- [ ] Portal: mock de celular com moldura `8px solid #16181c`, raio 34px, largura 300px.
- [ ] Painéis: bloco `#0d1014` com 6 cards.
- [ ] Sigilo: card com borda esquerda 3px `ink`, 5 garantias + 2 depoimentos.
- [ ] Planos: alternador mensal/anual (−20%: 249→199, 589→471, 1.290→1.032), 3 cards `auto-fit minmax(272px,1fr)`, meio em `ink`, preço 34px mono; CTA seleciona o plano e rola até o formulário. `[T]`
- [ ] Faixa "Rede com mais de 5 unidades ou concessionária?" com CTA "Falar com especialista".
- [ ] Formulário: preview de slug `<oficina>.mecanix.app` em tempo real; validações inline (oficina e nome obrigatórios, telefone ≥ 10 dígitos, e-mail com `@` e `.`). `[T]`
- [ ] Envio cria lead **e** provisiona tenant de trial de 14 dias, validando disponibilidade do slug. `[T]`
- [ ] Sucesso troca o card por "Recebemos seu pedido, <primeiro nome>!" com slug e plano, e opção de novo cadastro.
- [ ] Rodapé do card: "Seus dados não são compartilhados com outras oficinas."
- [ ] FAQ: acordeão de 6 perguntas, uma aberta por vez, primeira aberta por padrão e sobre sigilo entre oficinas.
- [ ] Footer escuro com marca, três colunas (Produto, Planos, Suporte) e linha legal.
- [ ] Âncoras com scroll suave e offset de 70px.
- [ ] Acréscimos: `<title>`, meta description, Open Graph, JSON-LD de produto/preço, consentimento de cookies (LGPD), analytics, `/politica-de-privacidade`.

## Planos e limites
- [ ] Iniciante R$ 249: 5 usuários · 1 CNPJ · 20 GB · 300 OS/mês. `[T]`
- [ ] Intermediária R$ 589: 15 usuários · 2 CNPJs · 50 GB · 1.500 OS/mês. `[T]`
- [ ] Profissional R$ 1.290: usuários ilimitados · CNPJs ilimitados · OS ilimitadas. `[T]`
- [ ] Exceder usuários, CNPJs, armazenamento ou OS/mês bloqueia a operação. `[T]`
