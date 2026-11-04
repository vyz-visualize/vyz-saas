# VYZ · Arquitetura

Como o projeto está organizado: produtos, rotas, pastas, banco, segurança e os caminhos do usuário. Documentos irmãos:

| Documento | Assunto |
|---|---|
| `docs/BANCO.md` | tabelas, RLS, histórico, jobs e como mexer no banco |
| `docs/TEMPLATES.md` | como criar templates de dashboard e de landing page |
| `docs/MOBILE.md` | app nativo (iOS e Android), compras na loja e envio |
| `docs/PENDENCIAS.md` | o que ainda depende de credencial ou decisão |

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
              cobrança (mock → Stripe) · OAuth Meta/Google · RevenueCat (lojas)
                                         │
                        apps/mobile (Expo, iOS e Android) usa a mesma API
```

- **Stack:** Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, Tailwind v4, Supabase (Postgres, Auth, Storage, Vault, pg_cron), zod 4, vitest. App: Expo SDK 58 com `ios/` e `android/` (sem EAS).
- **Um repositório:** site, painel, API, banco (`supabase/migrations`), app (`apps/mobile`) e tipos compartilhados (`packages/shared`).

## 2. Dois produtos

O VYZ vende dois produtos separados, cada um com 3 planos (Básico, Padrão, Avançado):

| | Dashboards | Landing pages |
|---|---|---|
| Plano no banco | `base`, `pro`, `avancado` (+ `personalizado`) | `lp_base`, `lp_pro`, `lp_avancado` |
| Preço | por contas conectadas, mensal ou anual | por página: R$ 950 de criação + R$ 99/mês de hospedagem cada (1, 3 ou 5 páginas) |
| Depois do pagamento | onboarding (`/comecar`) e o primeiro dashboard | popup de boas-vindas com a galeria de templates |
| Endereço | `dash.vyzualize.com.br/<cliente>` | `lps.vyzualize.com.br/<cliente>` |
| Menu do painel | Início, Dashboards, Contas, Compartilhar, Plano, Configurações | Landing pages, Leads, Plano, Configurações |

**O caminho do usuário fica salvo no banco** (`product_line`: `dash` | `lp`):

- `plans.product` é a fonte.
- `checkout_sessions.product` guarda o que a pessoa escolheu na página de preços. Uma trigger confere com o plano.
- `subscriptions.product` é copiado do plano. A troca de plano só acontece dentro do mesmo produto (`plan:product_mismatch`).
- `workspaces.product` diz o lado da plataforma. Cada produto tem o seu workspace: comprar LP não mexe no workspace de dashboards.
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
  dashboards, dashboards/novo, [id], [id]/editar
  landing-pages, novo, [id] (editor), leads   com SHOW_LANDING_PAGES desligada: "em breve" + lista de espera (workspaces de dashboards)
  contas, compartilhar, plano, configuracoes
  w/[slug]/route.ts                     entrada do cliente: abre o workspace e leva ao produto dele
(publico)/p/[slug]                      landing page publicada
(publico)/r/[token]                     dashboard compartilhado (só leitura)
(legal)/termos, privacidade
(mock)/integracoes/simulacao/[provider] consentimento simulado de Meta/Google (sem credenciais reais)
auth/callback, auth/confirm             volta do OAuth e dos links de e-mail (Supabase, PKCE)
api/v1/...                              API do app nativo (Bearer do Supabase, mesmo RLS)
api/billing/webhook                     cobrança (Stripe, quando ligar)
api/webhooks/revenuecat                 compras nas lojas (créditos e planos)
api/integrations/[provider]/start|callback   OAuth das plataformas de anúncio
api/landing-pages/leads                 formulário das LPs publicadas
api/cron/sync                           sincronização agendada das contas
```

`src/proxy.ts` (o antigo middleware): renova a sessão, manda quem não está logado para `/entrar`, devolve 404 de verdade para `/p` e `/r` inexistentes e, nos subdomínios `dash.`/`lps.`, reescreve `/<cliente>` para `/painel/w/<cliente>`.

## 4. Pastas

```
src/
  app/                rotas (acima)
  proxy.ts
  components/
    brand/            Wordmark, geometria do logo
    ui/               botões, Modal, campos, Segmented, Toast, Paywall (recurso borrado + "Liberar no …")
    charts/           gráficos em SVG feitos à mão
    motion/           só para o site (Lenis, reveals, intro)
  features/           domínio + UI, código que roda no navegador ou é puro
    pricing/          preços (pricing.ts), itens de cobrança (catalog.ts), limites por plano (entitlements.ts)
    templates/        catálogos de dashboard e de LP, um arquivo por template (docs/TEMPLATES.md)
    metrics/          definições de métrica e regras de cálculo
    analytics/        dashboards com dados reais (Meta e Google), agregação e formatos
    dashboards/       widgets, galeria, fluxo de novo dashboard, visualização
    landing-pages/    galeria, editor, renderizador, leads
    checkout/         pedido (order.ts), formulário, pagamento, troca de plano, rótulos
    onboarding/       passos do /comecar
    workspace/        app shell, Início, Plano, Configurações, vitrine (Upsell), boas-vindas
    accounts/         plataformas e contas de anúncio
    agent/            assistente VYZ (só no painel): motor, drawer, mascote, voz
    marketing/        seções do site, estado do plano escolhido
    auth/, share/, integrations/, sync/, catalog/, legal/
  server/             só servidor ("server-only"): ações, consultas, integrações
    auth/             sessão, workspace atual (requireWorkspace/authorize), Google, Bearer do app
    billing/          checkout, provedor (mock/Stripe), assinatura, loja (RevenueCat)
    dashboards/, landing-pages/, onboarding/, workspace/, share/
    integrations/     OAuth Meta/Google, tokens no Vault
    sync/, analytics/ sincronização das contas e leitura do armazém de métricas
    agent/            contexto e ações do assistente
    history/          logs de auditoria e atividade
    security/         rate limit
    supabase/         clientes (usuário e admin) e tradução de erros do banco
    env.ts            variáveis validadas (zod)
  lib/                utilitários sem domínio: flags, format, whatsapp, ids, hooks, product-hosts, supabase/cookies
packages/shared/      tipos e regras usados pelo site e pelo app (API, créditos, planos da loja, termos proibidos no iOS)
apps/mobile/          app Expo (docs/MOBILE.md)
supabase/migrations/  o banco, em ordem (docs/BANCO.md)
scripts/
  db/                 gen-types (tipos do banco), sync-catalog (planos, preços, templates)
  dev/                conta de teste (--product dash|lp), cookie de sessão
  store/              lista dos produtos das lojas
docs/                 esta pasta
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
Pagamento (mock hoje: só os e-mails de BILLING_FREE_EMAILS em produção)
  → fulfill_checkout (banco, numa transação): workspace, assinatura, itens, fatura, transação
  → triggers: produto no workspace e no perfil, product_events, onboarding pulado em LP
        ▼
Concluído → entrada do produto (dash.…/<cliente> ou lps.…/<cliente>, ou /painel/w/<cliente>)
  dashboards: /comecar (onboarding) → primeiro dashboard
  landing pages: /painel/landing-pages?bemvindo=1 → popup "escolha o template" → editor
```

Dentro do painel, os recursos de planos acima aparecem borrados com "Liberar no <plano>" (`components/ui/Paywall.tsx`, `features/workspace/Upsell.tsx`), e a troca leva à tela Plano já com o plano escolhido (`/painel/plano?liberar=pro`). O outro produto aparece como oferta no fim do Início.

## 6. Banco (resumo)

Detalhes em `docs/BANCO.md`. Migrations em ordem:

| Migration | O quê |
|---|---|
| foundation, catalog, identity | extensões, catálogo (planos, preços, plataformas, templates), perfis, workspaces, membros, convites |
| billing | checkout, assinaturas, itens, faturas, transações, pedidos de serviço, `fulfill_checkout` |
| integrations, insights | conexões OAuth (tokens no Vault), contas de anúncio, armazém de métricas diárias |
| dashboards, landing_pages | dashboards e páginas, LPs, versões, leads, links compartilhados |
| entitlements | limites por plano aplicados por trigger (com lock) |
| history, housekeeping | logs particionados por mês (auditoria, login, atividade), limpeza e jobs (pg_cron) |
| hardening, billing_followups | revisão de segurança, troca de plano atômica, renovação simulada |
| native_app, public_link_exists | créditos e eventos das lojas, push, exclusão de conta; checagem de links públicos |
| store_plans_and_seats | planos vendidos nas lojas, usuários por plano |
| product_lines | os dois produtos e o caminho do usuário |
| landing_waitlist | lista de espera das LPs e visitas à página "em breve" |
| dashboard_metric_prefs | métricas escolhidas em cada dashboard, por plataforma |

Segurança: RLS em todas as tabelas (negado por padrão), funções `security definer` com `search_path` vazio no schema `private`, erros no formato `grupo:motivo` traduzidos em `server/supabase/errors.ts`.

### Métricas de cada dashboard

`features/dashboards/metric-prefs.ts` tem o catálogo por plataforma (grupo, explicação, se o investimento dá para recalcular a partir dela) e as regras: padrão, mínimo de 1 por seção, máximo de 10 cards. O banco guarda só a diferença para o padrão, em `dashboards.metric_prefs`, por plataforma. Vale no painel, no link e no PDF.

Nos dashboards de exemplo cada aba tem os próprios cards: `pageKpiIds` é a fonte única da tela, do PDF, do link e do contador do painel, que conta a aba aberta. Oculto some de todas as abas; adicionado aparece em todas as que têm fileira de cards; aba sem fileira continua sem. Nos dashboards com dados reais, a fileira só existe na Visão geral. Quem pode editar também oculta pelo card (grava na hora, com Desfazer; `MetricActions.tsx`). O contador do painel recebe a lista que a tela está desenhando, inclusive com escolhas não salvas. Topo do dashboard: botões e abas que não cabem vão para menus (`components/ui/fit-items.ts`), sem quebra de linha nem rolagem.

### Modo personalizar

"Personalizar métricas" liga a edição no próprio dashboard (`features/dashboards/MetricEditor.tsx`): faixa no topo, encaixes na fileira de cards e bandeja embaixo. Mexe só no rascunho de `useMetricPrefsState`; o que pode e o que grava continua em `metric-prefs.ts`. Links internos e o voltar pedem confirmação em janela própria; fechar ou recarregar usa o aviso nativo do navegador, porque não há outra forma. A posição do card segue a ordem padrão, então arrastar destaca a fileira inteira. A bandeja é `fixed` e repete as medidas da sidebar do `AppShell` (260 px, 104 px recolhida): mudou lá, muda em `MetricTray`.

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

- `BILLING_PROVIDER=mock` hoje (sem Stripe). Em produção, o mock só aceita os e-mails de `BILLING_FREE_EMAILS`; o resto vê "pagamento em breve" (`server/env.ts`, `canCheckout`).
- Itens: plano (por contas, dashboards) ou plano de LP (hospedagem) + itens únicos (criação de LP, dashboard sob medida). Tudo recalculado no servidor (`features/checkout/order.ts`) e conferido de novo no banco.
- App: assinaturas e créditos pela loja (RevenueCat), mesma regra de plano do site (docs/MOBILE.md).

## 9. Variáveis de ambiente

Lista completa e comentada em `.env.example`. As que mudam o comportamento:

| Variável | Efeito |
|---|---|
| `BILLING_PROVIDER`, `INTEGRATIONS_MODE` | `mock` ou real |
| `ALLOW_MOCKS_IN_PRODUCTION` | permite o mock em produção (sem ela, o build recusa) |
| `BILLING_FREE_EMAILS` | quem assina sem pagar enquanto o mock estiver em produção |
| `NEXT_PUBLIC_DASH_HOST`, `NEXT_PUBLIC_LPS_HOST` | ligam os subdomínios (só depois do DNS) |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | sessão compartilhada entre subdomínios |
| `REVENUECAT_*` | compras nas lojas |

## 10. Comandos

| Comando | Para quê |
|---|---|
| `npm run dev` | site e painel local |
| `npm test` / `npx tsc --noEmit` / `npx eslint .` | testes, tipos e lint |
| `npm run db:push` | aplica as migrations no Supabase |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |
| `npm run db:catalog` | copia planos, preços e templates do código para o banco |
| `npx tsx scripts/dev/create-test-account.ts --email … [--product lp]` | conta de teste paga (simulada) |

Commits e push sempre pela conta GitHub Vyzualize.
