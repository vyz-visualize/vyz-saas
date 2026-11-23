# VYZ · Arquitetura

Como o projeto está organizado: produtos, rotas, pastas, banco, segurança e os caminhos do usuário. Os outros documentos estão listados em `docs/README.md`.

## 1. Visão geral

```
                      vyzualize.com.br (Next.js na Vercel)
   ┌──────────────┬───────────────┬──────────────┬───────────────┬──────────────┐
   │ site e planos│   checkout    │    painel    │ páginas       │ API do app   │
   │ (marketing)  │  (checkout)   │   (painel)   │ públicas      │ /api/v1      │
   └──────┬───────┴───────┬───────┴──────┬───────┴───────┬───────┴──────┬───────┘
          │               │              │               │              │
          └───────────────┴──── Supabase (Postgres + Auth + Storage + Vault) ┘
                                         │
        cobrança (Stripe) · OAuth das plataformas · RevenueCat (lojas) · Claude
                                         │
                        apps/mobile (Expo, iOS e Android) usa a mesma API
```

- **Stack:** Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, Tailwind v4, Supabase (Postgres, Auth, Storage, Vault, pg_cron), zod 4, vitest (com PGlite nos testes do banco), Stripe, Redis da Upstash (opcional, cache curto) e a API do Claude ("Pedir ao Vyz"). App: Expo SDK 58, pastas nativas geradas pelo `expo prebuild` e builds locais (sem EAS).
- **Um repositório:** site, painel, API, banco (`supabase/migrations`), app (`apps/mobile`) e tipos compartilhados (`packages/shared`).

## 2. Dois produtos

O VYZ tem dois produtos separados, cada um com 3 planos (Básico, Padrão, Avançado). Hoje o site vende só dashboards: as landing pages estão desligadas (`SHOW_LANDING_PAGES = false` em `lib/flags.ts`).

| | Dashboards | Landing pages |
|---|---|---|
| Plano no banco | `base`, `pro`, `avancado` (+ `personalizado`) | `lp_base`, `lp_pro`, `lp_avancado` |
| Preço | mensal ou anual (o anual é o total exato do ano, `PLAN_YEAR`, ~17% a menos); ver a tabela abaixo. Personalizado: sob consulta | por página: R$ 950 de criação + R$ 99/mês de hospedagem cada (1, 3 ou 5 páginas) |
| Depois do pagamento | onboarding (`/comecar`) e o primeiro dashboard | popup de boas-vindas com a galeria de templates |
| Endereço | `dash.vyzualize.com.br/<cliente>` | `lps.vyzualize.com.br/<cliente>` |
| Menu do painel | Início, o workspace aberto (Visão geral, Dashboards, Contas, Pessoas, Acessos, Ajustes) e Rotina (A Fazer, Compartilhar) | Landing pages, Leads, Plano, Configurações |

**Planos de dashboards** (fonte: `features/pricing/pricing.ts` e `entitlements.ts`; o banco recebe pelo `npm run db:catalog`):

| Plano | Mensal | Anual | Workspaces | Dashboards | Usuários |
|---|---|---|---|---|---|
| Básico | R$ 49,90 | R$ 499,90 | até 3 | 3 | 1 |
| Padrão | R$ 149,90 | R$ 1.499,90 | até 5 | 10 | ilimitados |
| Avançado | R$ 299,90 | R$ 2.999,90 | ilimitados | 40 | ilimitados |
| Personalizado | sob consulta | sob consulta | ilimitados | 100 | ilimitados |

- Todas as plataformas em todos os planos (sem restrição); as que funcionam hoje estão em `AVAILABLE_PLATFORMS` (`docs/PLATAFORMAS.md`).
- Logo e cor do workspace em todos os planos; sem a marca VYZ (`whiteLabel`) só no Personalizado.
- O anual é o total do ano (`PLAN_YEAR`); o banco guarda o por mês arredondado e aceita a diferença (`docs/BANCO.md`, "Preço anual").
- Os planos são os mesmos no app, vendidos pela loja (`docs/MOBILE.md`).

**O caminho do usuário fica salvo no banco** (`product_line`: `dash` | `lp`):

- `plans.product` é a fonte.
- `checkout_sessions.product` guarda o que a pessoa escolheu na página de preços. Uma trigger confere com o plano.
- `subscriptions.product` é copiado do plano. A troca de plano só acontece dentro do mesmo produto (`plan:product_mismatch`).
- `workspaces.product` diz o lado da plataforma. Cada produto tem a sua organização (tabela `workspaces`): comprar LP não mexe na de dashboards.
- `profiles.product` é o último produto em que o usuário entrou.
- `product_events` é o histórico (só cresce) de quem entrou em qual produto, por checkout, loja ou troca.

No código: `Product` e as funções de plano em `features/pricing/pricing.ts` (`planDbId`, `parsePlanDbId`, `PRODUCT_HOME`), e `session.workspace.product` em toda tela do painel.

## 3. Rotas (`src/app`)

Grupos de rota isolados: cada um tem o próprio layout, e nenhum importa o motion, o layout ou o estado de outro (regra de ESLint `no-restricted-imports`).

```
(marketing)/page.tsx                    site: hero, como funciona, Inteligência, planos (LP oculta: SHOW_LANDING_PAGES em lib/flags.ts)
(checkout)/assinar                      1. dados (Google ou e-mail) → pagamento/[id] → concluido/[id]
(auth)/entrar, recuperar-senha,         login (e-mail e senha ou Google), senha, convite de equipe
       redefinir-senha, convite/[token]
(onboarding)/comecar                    negócio → plataformas → conectar contas → primeiro dashboard (só dashboards)
(painel)/painel/...                     o SaaS (menu por produto)
  page.tsx                              Início (dashboards) · LP vai para /painel/landing-pages
  workspaces, workspaces/[id]           lista de workspaces e cada um: Visão geral e as abas dashboards,
                                        contas, pessoas, acessos, ajustes
  dashboards, dashboards/novo, [id], [id]/editar
  a-fazer, compartilhar                 Rotina
  contas                                Conexões (logins da organização e todas as contas)
  plano, configuracoes, whatsapp        organização, cobrança e relatórios pelo WhatsApp
  landing-pages, novo, [id] (editor), leads   com SHOW_LANDING_PAGES desligada: "em breve" + lista de espera
  interno                               painel interno, só para os admins da Vyzualize
  projetos                              endereço antigo, redireciona para workspaces
  w/[slug]/route.ts                     entrada do cliente: abre o workspace e leva ao produto dele
(publico)/p/[slug]                      landing page publicada
(publico)/r/[token]                     dashboard compartilhado (só leitura; conta a visita para a aba Acessos)
(legal)/termos, privacidade, exclusao-de-dados
(mock)/integracoes/simulacao/[provider] consentimento simulado das plataformas (sem credenciais reais)
dev/...                                 bancadas, só no next dev (painel, templates, dados, primeiro-acesso, configuracoes)
auth/callback, auth/confirm             volta do OAuth e dos links de e-mail (Supabase, PKCE)
api/v1/...                              API do app nativo (Bearer do Supabase, mesmo RLS)
api/billing/webhook, stripe/retorno     cobrança pela Stripe (webhook e volta do Checkout)
api/webhooks/revenuecat, whatsapp       compras nas lojas; status e respostas do WhatsApp
api/integrations/[provider]/start|callback   OAuth das plataformas
api/links/visita                        sinais de visita do link compartilhado (aba Acessos)
api/dashboards/[id]/atualizar           atualiza as contas atrasadas ao abrir um dashboard
api/landing-pages/leads                 formulário das LPs publicadas
api/sessao                              nome de quem está logado, para o site estático
api/cron/sync, digest, whatsapp, resumo-admin   agendamentos (vercel.json; rejectCron em server/sync/cron.ts exige o Bearer CRON_SECRET)
                                                 sync: ?grupo=anuncios (Meta, Google, GA4, CRMs; 09, 15, 21 UTC) e ?grupo=organico
                                                 (Instagram e Página; 07, 12, 19 UTC). Regras da rodada em features/sync/round.ts:
                                                 só começa conta que cabe no tempo, encerra a que passa do limite, fecha as
                                                 abertas há 15 min e avisa as contas há mais de 24 h sem sincronizar.
```

`src/proxy.ts` (o antigo middleware): renova a sessão, manda quem não está logado para `/entrar`, devolve 404 de verdade para `/p` e `/r` inexistentes e, nos subdomínios `dash.`/`lps.`, reescreve `/<cliente>` para `/painel/w/<cliente>`.

### Interface do painel

O painel (área logada) tem tokens próprios, a mesma paleta do app nativo. O site, o checkout, o login e as páginas públicas seguem nos tokens da marca.

- **Tokens** (`src/app/globals.css`): a moldura marca `[data-ui="app"]` e os tokens sobem para a raiz (`:root:has([data-ui="app"])`), para valer também nos menus e selects que o Radix desenha no `<body>`. Fundo neutro, cartão branco, linha fina, oliva só como destaque, raios 10 e 16 (`--r-control`, `--r-card`), elevação leve (`--elev-card`, `--elev-pop`) e `--surface-2` para preenchimentos discretos. Claro e escuro.
- **Dashboard do cliente**: fica nos tokens da marca dentro do painel (classe `.tokens-brand` no `<main>` da tela cheia e nas miniaturas), igual ao que o cliente vê no link e no PDF.
- **Moldura** (`features/workspace/AppShell.tsx`) e **menu integrado** (`Sidebar.tsx`): a moldura tem o oliva da marca (`--frame*`) e o conteúdo fica num painel arredondado encaixado nela, sem barra no topo e com largura fluida (sem coluna máxima). O item ativo é uma aba na cor do painel que se funde nele pelos cantos côncavos (`.side-tab`). O menu tem só o dia a dia: Início, o workspace aberto e a Rotina (A Fazer, Compartilhar). No topo dele, o seletor de workspaces (lista com busca a partir de 7, "Todos os workspaces", "Novo workspace" e a organização: plano, Conexões, configurações e troca de organização; nessas páginas ele fica aceso); na troca, a pessoa continua na mesma aba. No rodapé, o uso do plano e o menu da pessoa (Minha conta, Plano e cobrança, Sair). Recolhe para um trilho de 76 px pelo botão do rodapé ou com `[` (`vyz:sidebar`, em `<html data-sidebar>`, aplicado antes da primeira pintura). A navegação mora em `nav.ts` (fonte única do menu, da barra do celular e da folha "Mais"). No celular: topo com o workspace aberto, barra flutuante embaixo e a folha "Mais" (workspaces, o resto do menu nos mesmos grupos e as páginas da organização).
- **Identidade do workspace** (`features/projects/identity.ts`, `WorkspaceAvatar.tsx`, ações em `server/projects/identity.ts`): cada workspace pode ter cor e logo (aba Ajustes; member com acesso a ele). O avatar mostra a logo ou as iniciais na cor, no seletor do menu, nas listas, no cabeçalho, no topo do celular e na folha "Mais". Nos dashboards do workspace, a logo dele entra no lugar da logo da organização: na tela do painel e no editor (prévia) sempre; no link do cliente (e no PDF), com a mesma regra da marca própria do plano.
- **Tour do painel** (`PanelTour` em `features/onboarding/DashboardTour.tsx`, passos em `PANEL_TOUR_STEPS`): no primeiro acesso, onde fica cada coisa (workspaces, o workspace aberto, a Rotina, plano e conta, Pergunte ao VYZ; no celular, o topo, a barra e o "Mais"). Os alvos são `data-tour="..."`; o que não está na tela fica de fora. Uma vez por pessoa (`user_guides`, guia `panel_tour`), só no Dash e com plano ativo; o tour do primeiro dashboard é outro guia (`dashboard_tour`). Na bancada, `?tour=1`.
- **Workspace aberto**: o do endereço (`/painel/workspaces/<id>/...`) ou, fora dele, o último aberto (cookie `vyz-project`, gravado no navegador por `rememberProject`). O menu mostra o grupo dele (Visão geral, Dashboards, Contas, Pessoas, Acessos, Ajustes); `/painel/dashboards` redireciona para os dashboards dele; o dashboard novo sem conta nasce nele.
- **Área do workspace** (`/painel/workspaces/[id]` e as abas `dashboards`, `contas`, `pessoas`, `acessos`, `ajustes`; `features/projects/workspace/`, dados em `server/projects/detail.ts`): Visão geral (primeiros passos, números, destaques da semana, contas por plataforma, equipe), Dashboards (CRUD), Contas (ligar, desligar, sincronizar, mover, remover e trazer contas dos logins; `server/projects/accounts.ts`), Pessoas (quem acessa, quem está fora, convites e vagas), Acessos (seção "Acessos do cliente", abaixo) e Ajustes (nome, cor, logo e arquivar). No computador, o menu lateral é a navegação do workspace e a aba tem o próprio título (`PageHeader`); no celular, abas logo abaixo do caminho. `/painel/contas` é **Conexões**: os logins da organização e todas as contas.
- **Kit** (`components/ui/kit.tsx`, `styles.ts`): `PageHeader`, `SectionHeader`, `Tabs` (trilho), `Badge`, `StatTile`, `EmptyState`, `Modal` (vira folha que sobe no celular) e `ModalActions`; botões `btn.small` (principal), `btn.subtle`, `btn.quiet`, `btn.danger` e `btn.icon`. Cartão: `rounded-card border border-line bg-card` (a elevação entra sozinha no painel) ou o utilitário `surface`.
- **Padrões de tela**: uma ação principal por tela; ações secundárias no menu de três pontos; listas longas viram cartões abaixo de `lg` (nada rola de lado no celular); páginas longas em abas (Plano, Configurações).
- **Nomes**: na interface, o cliente ou marca (tabela `projects`) se chama **workspace** e a conta de cima (tabela `workspaces`: plano, cobrança, equipe) se chama **organização**. Tabelas, colunas e rotas de API continuam com os nomes antigos.
- **Equipe por workspace** (`project_members`, migration `20261118090000`): dono e admin da organização veem todos os workspaces; editor e leitor só os seus (regras restritivas no banco em contas, dashboards e filhas, tarefas, otimizações e métricas). Quem lê com a chave de serviço para mandar algo a uma pessoa (WhatsApp, push, Desfazer) filtra com `userProjectIds`.
- **Bancada** (`/dev/painel?tela=inicio`, só no `next dev`): a moldura com cada tela e dados de exemplo, sem banco nem conta de teste. Telas em `src/app/dev/painel/` (`harness.tsx`, `screens-*.tsx`; as do workspace em `screens-workspace.tsx`: `workspace`, `workspace-novo`, `workspace-dashboards`, `workspace-contas`, `workspace-contas-vazio`, `workspace-pessoas`, `workspace-acessos` (e `-parado`, `-nunca`, `-vazio`), `workspace-ajustes`); `?plano=base|pro|avancado` e `?papel=viewer|member|admin` trocam o plano e o papel; `?tour=1` mostra o tour do painel (sem gravar).

## 4. Pastas

```
src/
  app/                rotas (acima)
  proxy.ts
  components/
    brand/            Wordmark, geometria do logo
    ui/               botões, Modal, campos, abas, selos, Segmented, Toast, Paywall (recurso borrado + "Liberar no …"), kit
    charts/, bklit/   gráficos em SVG feitos à mão e a biblioteca de gráficos importada
    motion/           só para o site (Lenis, reveals, intro)
  features/           domínio + UI, código que roda no navegador ou é puro
    pricing/          preços (pricing.ts), itens de cobrança (catalog.ts), limites por plano (entitlements.ts)
    templates/        catálogos de dashboard e de LP, um arquivo por visual ou template (docs/TEMPLATES.md)
    metrics/          definições de métrica e regras de cálculo
    analytics/        dashboards com dados reais, agregação, filtros, criativos e formatos
    dashboards/       widgets, galeria, editor, Pedir ao Vyz (ask/), personalizar métricas
    accounts/         plataformas, modos de conexão e contas
    projects/         workspaces (clientes): identidade, equipe, acessos do cliente
    workspace/        moldura do painel (AppShell, Sidebar, nav.ts), Início, Plano, Configurações, Upsell
    todo/, insights/, optimize/   A Fazer, análises automáticas e otimizações aplicadas
    import/           leitura de planilhas (mídia e lançamento)
    whatsapp/         relatórios pelo WhatsApp (docs/WHATSAPP.md)
    agent/            assistente VYZ (só no painel): motor, drawer, mascote, voz
    landing-pages/    galeria, editor, renderizador, leads
    checkout/         pedido (order.ts), formulário, pagamento, troca de plano, linhas da Stripe
    onboarding/       passos do /comecar e tours
    marketing/        seções do site, estado do plano escolhido
    admin/            painel interno da Vyzualize
    auth/, share/, integrations/, sync/, catalog/, legal/
  server/             só servidor ("server-only"): ações, consultas, integrações
    actions/          runAndRefresh: o miolo comum das Server Actions que mudam dados
    auth/             sessão, workspace atual (requireWorkspace para páginas, authorize para ações, currentWorkspaceSession para leituras), Google, Bearer do app (apiJson, apiError)
    billing/          checkout, provedor (mock/Stripe), assinatura, loja (RevenueCat)
    integrations/     OAuth das plataformas (providers/), tokens no Vault
    sync/, analytics/ sincronização das contas (sync/live/) e leitura do armazém de métricas
    import/           planilhas: importação, Google Sheets e releitura agendada
    projects/         workspaces: detalhe, contas, identidade, acessos do cliente
    dashboards/, landing-pages/, onboarding/, workspace/, share/, guides/
    todo/, insights/, optimize/, whatsapp/, push/
    agent/, ai/       contexto do assistente e cliente do Claude
    admin/            exclusão de conta (script interno) e painel interno
    mmm/, cache/      carga do histórico do MMM e Redis (docs/MMM.md)
    history/          logs de auditoria e atividade
    security/, http/  rate limit e dados da requisição
    supabase/         clientes (usuário e admin) e tradução de erros do banco
    env.ts            variáveis validadas (zod)
  lib/                utilitários sem domínio: flags, format (moeda, plural, meses), text (fold), guards (isRecord), random, whatsapp, ids, hooks, navigation, product-hosts, site, store (localStorage), supabase/cookies
packages/shared/      tipos e regras usados pelo site e pelo app (API, créditos, planos da loja)
apps/mobile/          app Expo (docs/MOBILE.md)
supabase/migrations/  o banco, em ordem (docs/BANCO.md)
scripts/
  db/                 gen-types (tipos do banco), sync-catalog (planos, preços, templates)
  dev/                conta de teste (--product dash|lp), cookie de sessão, sincronizar uma conta
  admin/              exclusão de dados de uma conta (docs/EXCLUSAO-DE-DADOS.md)
  mmm/                fila da carga do histórico do MMM
  build/              checagem de marcadores pendentes (postbuild)
  check/              consultas da Google Ads API
  store/              lista dos produtos das lojas
docs/                 esta pasta (índice em docs/README.md)
```

**Regras de organização**
1. **Uma fonte por assunto.** Preço e limite: `features/pricing`. Templates: `features/templates`. Métrica: `features/metrics`. O banco recebe uma cópia pelo `npm run db:catalog`; o código é a verdade.
2. **`features` não acessa o banco.** Leitura e escrita ficam em `server/` (Server Actions, consultas e Route Handlers). As páginas chamam `server/` e passam os dados prontos.
3. **O banco repete as regras.** Limites, papéis e produto são conferidos no servidor **e** no Postgres (RLS e triggers). A tela é só a primeira barreira.
4. **Um arquivo por template** (docs/TEMPLATES.md).
5. **Mock atrás de interface.** Cobrança (`server/billing/provider.ts`) e OAuth (`server/integrations/providers`) têm a versão simulada e a real com a mesma interface; a variável de ambiente escolhe.

## 5. Fluxo do cliente

```
Site (/#planos)
  toggle Dashboards | Landing pages  →  "Assinar o Padrão"
        │  /assinar?produto=lp&plano=pro&periodo=mensal
        ▼
Checkout
  sem conta: Criar conta com Google (volta ao pedido logado) ou com e-mail e senha
  com conta: só empresa e aceite
  → checkout_sessions + checkout_items (o servidor recalcula o preço; o navegador nunca manda valor)
        ▼
Pagamento (Checkout hospedado da Stripe; simulado no dev e para CHECKOUT_SIMULATED_EMAILS)
  → fulfill_checkout (banco, numa transação): workspace, assinatura, itens, fatura, transação
  → triggers: produto no workspace e no perfil, product_events, onboarding pulado em LP
        ▼
Concluído → entrada do produto (dash.…/<cliente> ou lps.…/<cliente>, ou /painel/w/<cliente>)
  dashboards: /comecar (onboarding) → primeiro dashboard
  landing pages: /painel/landing-pages?bemvindo=1 → popup "escolha o template" → editor
```

Dentro do painel, os recursos de planos acima aparecem borrados com "Liberar no <plano>" (`components/ui/Paywall.tsx`, `features/workspace/Upsell.tsx`), e a troca leva à tela Plano já com o plano escolhido (`/painel/plano?liberar=pro`). O outro produto aparece como oferta no fim do Início.

## 6. Banco (resumo)

Detalhes em `docs/BANCO.md`, com a lista de todas as migrations (`supabase/migrations/`). Em resumo: catálogo e identidade, cobrança, integrações e armazém de métricas (anúncio, orgânico, GA4 e CRM), dashboards e links, LPs, limites do plano por gatilho, histórico particionado, app nativo, workspaces com equipe própria, A Fazer, otimizações, WhatsApp, MMM e acessos do cliente.

Segurança: RLS em todas as tabelas (negado por padrão), funções `security definer` com `search_path` vazio no schema `private`, erros no formato `grupo:motivo` traduzidos em `server/supabase/errors.ts`.

### Métricas de cada dashboard

`features/dashboards/metric-prefs.ts` tem o catálogo por plataforma (grupo, explicação, se o investimento dá para recalcular a partir dela) e as regras: padrão, mínimo de 1 por seção, máximo de 10 cards. O banco guarda só a diferença para o padrão, em `dashboards.metric_prefs`, por plataforma. Vale no painel, no link e no PDF.

Nos dashboards de exemplo cada aba tem os próprios cards: `pageKpiIds` é a fonte única da tela, do PDF, do link e do contador do painel, que conta a aba aberta. Oculto some de todas as abas; adicionado aparece em todas as que têm fileira de cards; aba sem fileira continua sem. Nos dashboards com dados reais, a fileira só existe na Visão geral. Quem pode editar também oculta pelo card (grava na hora, com Desfazer; `MetricActions.tsx`). O contador do painel recebe a lista que a tela está desenhando, inclusive com escolhas não salvas. Topo do dashboard: botões e abas que não cabem vão para menus (`components/ui/fit-items.ts`), sem quebra de linha nem rolagem.

### Modo personalizar

"Personalizar métricas" liga a edição no próprio dashboard (`features/dashboards/MetricEditor.tsx`): faixa no topo, encaixes na fileira de cards e bandeja embaixo. Mexe só no rascunho de `useMetricPrefsState`; o que pode e o que grava continua em `metric-prefs.ts`. Links internos e o voltar pedem confirmação em janela própria; fechar ou recarregar usa o aviso nativo do navegador, porque não há outra forma. A posição do card segue a ordem padrão, então arrastar destaca a fileira inteira. A bandeja é `fixed` e segue a tela cheia do dashboard (sem o menu lateral): 12 px de respiro dos dois lados no computador, largura toda no celular.

### Dashboard interativo

Clicar filtra o dashboard inteiro. Os filtros ficam só na URL (`campanha`, `anuncio`, `plataforma`, `de`, `ate`), nunca no dashboard: `features/analytics/filters.ts` lê, escreve e decide o que cada clique faz. Dados reais: o servidor recorta as linhas do armazém e agrega de novo (`features/analytics/filtered.ts`), antes de ocultar o investimento; cada combinação tem entrada de cache, e as linhas têm a delas. Amostras: `features/metrics/filter-dataset.ts` recorta o Dataset, no navegador; galeria e métricas novas passam pelo servidor. A visualização onde se clica ignora a própria dimensão, para destacar o escolhido.

Nunca há número aproximado nos dados reais: o que as linhas não têm continua no total, com o selo "não filtrado por". Público, posicionamento, dispositivo, região, hora e produtos não têm campanha; anúncio não tem visualização da página, carrinho nem checkout; alcance não soma entre campanhas nem anúncios. Com um trecho de dias, a comparação usa os mesmos dias do período anterior. O comparativo de criativos ignora os filtros. Só a abertura da página conta: filtrar, limpar e trocar o período não contam visita do link nem gravam "dashboard visto" (`lib/navigation.ts` no painel; `sec-fetch-dest: empty` no link, que não manda Referer).

Nas amostras, cada anúncio simulado pertence a uma campanha do modelo e os números fecham por campanha (`linkToModel` e `scaleByCampaign` em `creatives/sample.ts`); as campanhas fecham com os cards (`closeCampaigns` em `metrics/source.ts`). A curva diária de uma campanha sai por proporção, porque o modelo não guarda campanha por dia. A frequência também é por campanha (`campaignFrequencies` em `metrics/compute.ts`), e as de cada plataforma fecham com a do card.

### Métricas novas do Personalizar

`features/analytics/live-metrics.ts` define de onde vem cada métrica, como é calculada e o texto que explica; cards, tabelas e o catálogo leem daí, e as novas entram desligadas. Meta: contagens por anúncio somam `insights_ad_daily`; página de destino, carrinho e checkout vêm das linhas por campanha e conta. Google: tudo das campanhas (`insights_campaign_daily`), porque Performance Max e Shopping não têm linha de anúncio. O `rollup_account_insights` não usa essas colunas. Custo por ThruPlay e CPV usam só o investimento de vídeo, e tempo médio é segundos totais ÷ reproduções. Resultados vira card só com um tipo de resultado no período; a tabela mostra por campanha. A lista do investimento oculto (`SPEND_FIELDS`) sai das mesmas definições. Eventos da Meta sem contagem em dobro: um campo por evento, em `features/sync/meta-actions.ts`.

### Página de Criativos

A profundidade vem de `ENTITLEMENTS[tier].creatives` (Básico: lista; Padrão: galeria; Avançado e Personalizado: galeria + comparativo), e a página é de todos os planos. `features/analytics/creatives/access.ts` corta os dados no servidor, depois do cache e do investimento oculto: o Básico só recebe os campos da lista, e os dias por anúncio só vão no Avançado, na aba Comparativo. Galeria e comparativo são carregados sob demanda; as amostras com blur (`LockedSamples.tsx`) têm dados fixos de exemplo e nunca aparecem no link compartilhado. As contas do comparativo ficam em `compare.ts`, e o texto de "Gerar análise" em `features/agent/engine/creative-analysis.ts`, só com números calculados. Endereço: `?pagina=criativos&criativos=comparativo&anuncios=a,b,c`. Dashboards de amostra usam a mesma página só nos modelos com Meta (`sample.ts`); TikTok, YouTube e só Google mantêm o widget do modelo. Nas amostras, anúncios e métricas novas seguem a escala do modelo: com outras plataformas de anúncios, a parte da Meta, e os cards da aba Criativos também; as métricas novas levam "· Meta" no nome. Nas amostras elas existem só como card, porque as tabelas vêm do simulador do modelo.

Link com investimento oculto: `redactSpend` (`features/analytics/aggregate.ts`) tira no servidor o investimento e tudo de onde ele dá para recalcular (CPM, CPC, CPA, ROAS, custo por etapa). Campo novo com um desses nomes já nasce coberto, porque ele varre a estrutura inteira.

## 7. Autenticação

- Supabase Auth com cookies `httpOnly` (o navegador nunca lê o token). `NEXT_PUBLIC_COOKIE_DOMAIN=.vyzualize.com.br` faz a mesma sessão valer no site e nos subdomínios.
- E-mail e senha, Google (site: OAuth com PKCE; app: idToken nativo) e Apple (app iOS). Mesmo e-mail confirmado: o Supabase liga as identidades numa conta só.
- App nativo: `Authorization: Bearer <jwt>` em `/api/v1`, com o mesmo RLS (`server/auth/bearer.ts`).

## 8. Cobrança

- Stripe, pelo Checkout hospedado (`server/billing/stripe.ts`): o cartão nunca passa pelo VYZ e não há produtos cadastrados na Stripe (as linhas saem de `features/checkout/stripe-lines.ts`). A produção está em **modo de teste** até o lançamento; o checklist do modo live está em `docs/LANCAMENTO.md`.
- `BILLING_PROVIDER=mock` no desenvolvimento. Com o mock em produção, só os e-mails de `BILLING_FREE_EMAILS` assinam (`canCheckout` em `server/env.ts`). Com a Stripe ligada, a equipe usa `CHECKOUT_SIMULATED_EMAILS` (organização de teste que nunca chama a Stripe).
- Itens: plano (anual pelo total exato, `PLAN_YEAR`) ou plano de LP (hospedagem) + itens únicos (criação de LP, dashboard sob medida, dashboard adicional). Tudo recalculado no servidor (`features/checkout/order.ts`) e conferido de novo no banco (`fulfill_checkout`).
- Enquanto `BILLING_LIVE = false` (`lib/flags.ts`), o site avisa "Simulação · não é cobrança".
- App: assinaturas e créditos pela loja (RevenueCat), mesma regra de plano do site (docs/MOBILE.md).

## 9. Variáveis de ambiente

Lista completa e comentada em `.env.example`. As que mudam o comportamento:

| Variável | Efeito |
|---|---|
| `BILLING_PROVIDER` (`mock` ou `stripe`), `INTEGRATIONS_MODE` (`mock` ou `live`) | simulado ou real |
| `ALLOW_MOCKS_IN_PRODUCTION` | permite o simulado em produção (sem ela, o build recusa) |
| `BILLING_FREE_EMAILS` | quem assina sem pagar com o mock em produção |
| `CHECKOUT_SIMULATED_EMAILS` | equipe que testa o checkout sem chamar a Stripe |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | cobrança (`docs/LANCAMENTO.md`) |
| `<PLATAFORMA>_CLIENT_ID`/`_SECRET`, `META_*`, `GOOGLE_*` | logins das plataformas; sem o par, o login some da tela (`docs/PLATAFORMAS.md`) |
| `CRON_SECRET` | protege as rotas `api/cron/*` |
| `WHATSAPP_*` | relatórios pelo WhatsApp; sem eles, modo simulado (`docs/WHATSAPP.md`) |
| `CLAUDE_API_KEY` | "Pedir ao Vyz" com o Claude; sem ela, vale a leitura local |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis da Upstash; sem eles, tudo funciona sem cache |
| `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` | planilhas fechadas do lançamento (Fachada) |
| `NEXT_PUBLIC_DASH_HOST`, `NEXT_PUBLIC_LPS_HOST` | ligam os subdomínios (só depois do DNS) |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | sessão compartilhada entre subdomínios |
| `REVENUECAT_*`, `APNS_*`, `FCM_SERVICE_ACCOUNT_JSON` | compras nas lojas e push do app |

Interruptores do produto ficam no código, em `src/lib/flags.ts`: `SHOW_LANDING_PAGES`, `BILLING_LIVE` e `SITE_INDEXABLE`.

## 10. Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | site e painel local (um `next dev` por pasta) |
| `npm test` / `npm run typecheck` / `npm run lint` | testes (vitest), tipos e lint |
| `npm run build` | build de produção; o `postbuild` procura marcadores pendentes |
| `npm run db:new -- nome` / `npm run db:push` | cria uma migration / aplica as migrations no Supabase |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |
| `npm run db:catalog` | copia planos, preços, plataformas e templates do código para o banco |
| `npm run check:google-ads` | confere as consultas da Google Ads API |
| `npm run check:unused` | arquivos, exportações e dependências sem uso (knip, `knip.json`) |
| `npm run admin:delete-account` | exclusão de dados de uma conta (`docs/EXCLUSAO-DE-DADOS.md`) |
| `npm run mmm:backfill -- --status` | fila da carga do histórico do MMM (`docs/MMM.md`) |
| `npx tsx scripts/dev/create-test-account.ts --email … [--product lp]` | conta de teste paga (simulada) |

Commits e push sempre pela conta GitHub Vyzualize.

## 11. Acessos do cliente

Para quem vende dashboard para cliente (freelancers de BI, agências): a aba **Acessos** de cada workspace (`/painel/workspaces/<id>/acessos`) mostra se o cliente está usando o dash. Vale em todos os planos.

- **Quem é quem:** um link por pessoa. Ao compartilhar, o campo "Para quem é este link?" grava `share_links.recipient_name`; sem nome, o link aparece como "Link …abc123".
- **Visita:** a página do link (`/r/<token>`) monta `VisitTracker` (`features/share/VisitTracker.tsx`), que manda um sinal para `POST /api/links/visita` ao abrir, ao trocar de tela, a cada 30 s com a aba visível e ao sair (`sendBeacon`). O dashboard avisa a tela aberta por `useWatchPage` (`features/share/page-watch.ts`). O servidor (`server/share/visits.ts`) ignora robôs e prévias de link (WhatsApp, Slack...), limita por IP (`share_ping_ip`) e grava por `record_share_visit`, que confere se o link vale. Uma visita por aba; volta a valer depois de 30 min parada.
- **Situação:** pela última visita: até 7 dias, usando; até 21, esfriando; depois, parado. Com link e sem visita, nunca abriu. Regras puras em `features/projects/client-activity.ts`; leitura em `server/projects/client-activity.ts` (RLS: cada membro só vê os dashboards que acessa).
- **Onde aparece:** a aba Acessos (situação, visitas em 7 e 30 dias, tempo, pessoas, linha do tempo com as telas vistas, dashboards mais vistos) e uma linha em cada cartão da lista de workspaces.
- **LGPD:** o rodapé do link avisa que as visitas ficam registradas. Da visita só fica o tipo de aparelho (computador, celular, tablet); nada de IP nem navegador.

