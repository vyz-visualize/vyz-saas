# VYZ · Modelos de dashboard e templates de landing page

Padrão do projeto: **cada visual é um arquivo** e cada catálogo tem um índice que junta os arquivos na ordem dos planos.

## Onde fica cada coisa

```
src/features/templates/
  types.ts                         tipos (DashboardTemplate, PageId, WidgetSpec)
  pages.ts                         biblioteca de páginas (o que cada aba mostra)
  live.ts                          catálogo completo (ALL_DASHBOARD_TEMPLATES) e busca por id
  dashboards/
    index.ts                       categorias e dashboardTemplate(id)
    composed.ts                    objetivos, recursos, montagem das páginas e métricas de mercado
    visuais/index.ts               os visuais na ordem da tela
    visuais/<id>.ts                um visual (vyz, lavanda, pulso, noturno, areia)
  landing-pages/
    index.ts                       LANDING_TEMPLATES, landingTemplate, landingDefaults
    catalog/<id>.ts                um template de landing page
```

## Como um dashboard é montado

Um dashboard é **visual × objetivo**, e as **páginas saem das contas** ligadas a ele:

- **Visual** (`visuais/<id>.ts`): só a aparência. Básico: VYZ e Lavanda; Padrão: + Pulso; Avançado: todos.
- **Objetivo** (`OBJECTIVES` em `composed.ts`): decide os números do topo e o funil (compra, lead, contato...).
- **Modelo** = `${visual}-${objetivo}` (ex.: `noturno-ecommerce`). É o id gravado no banco e **não muda depois de publicado**.
- **Páginas** (`composePages`): Visão geral quando há anúncio; uma página por plataforma (Meta Ads, Google Ads, Site GA4, Instagram, Página do Facebook), Força dos canais (GA4 com anúncios), Conteúdo (orgânico), os recursos escolhidos e o Funil.
- **Recursos** (`FEATURES`): Metas e pacing, Comparativo de períodos (Padrão); Comparativo de criativos, Análise preditiva e MMM (Avançado).
- **Métricas de mercado** (`composedLayout`): a Visão geral e as páginas da Meta e do Google trazem 8 números fixos por objetivo.

## Criar um visual

1. Crie `src/features/templates/dashboards/visuais/<id>.ts` (id em minúsculas, sem acento) e o desenho em `src/features/dashboards/skins/` (o visual VYZ não tem skin).
2. Acrescente o arquivo em `visuais/index.ts`, na ordem da tela.
3. `npm run db:catalog`: cadastra os modelos novos (visual × cada objetivo) e apaga do banco os que saíram do código e nenhum dashboard usa.
4. `npm test`: o teste que desenha todas as páginas de todos os modelos confere que nada quebra.

### Rascunho e bancada local

Para desenvolver um visual sem lançar: ponha `draft: true` no arquivo dele em `visuais/`. Assim ele:

- fica fora da galeria, do onboarding, do "Trocar modelo" e do banco (`VISUAL_LIST` só tem os lançados; o `db:catalog` não vê rascunho);
- pode ir para a `main` sem aparecer para ninguém;
- aparece na **bancada local**, `http://localhost:<porta>/dev/templates`, que só existe no `next dev`.

A bancada abre qualquer visual (os rascunhos vêm marcados) com dados de exemplo, o Personalizar funcionando sem banco (salvar fica só na aba do navegador) e tudo na URL, para mandar o link de uma tela exata:

```
/dev/templates?visual=lavanda&objetivo=ecommerce&contas=meta,google,ga4&recursos=previsao,mmm&plano=avancado&pagina=visao-geral
```

`ocultar=1` mostra com o investimento oculto e `barra=0` esconde a barra da bancada (print limpo).

Para lançar: tire o `draft`, rode `npm run db:catalog` e `npm test`.

Só um `next dev` por pasta: o Next recusa o segundo e sugere encerrar o primeiro. Com várias conversas na mesma pasta, usem o mesmo servidor (ou um worktree para cada uma).

## Criar um objetivo ou um recurso

- Objetivo: acrescente em `OBJECTIVES` (e o nicho do onboarding em `OBJECTIVE_BY_BUSINESS`) e as métricas em `KPIS_BY_PROFILE`.
- Recurso: acrescente em `FEATURES`, crie a página em `pages.ts` e o desenho dela em `DashboardBody` (sourcePage).


## Criar um template de landing page

1. Crie `src/features/templates/landing-pages/catalog/<id>.ts`:

   ```ts
   import { COMMON_FAQ } from "../shared";     // só se usar as perguntas comuns
   import type { LandingTemplate } from "../types";

   export default {
     id: "diagnostico-gratuito",
     name: "Diagnóstico gratuito",
     tier: "pro",
     category: "Leads",
     description: "Para quem é e o que a página faz, em uma frase.",
     hero: "form",                              // form: formulário no topo · cta: botão (WhatsApp) no topo
     defaults: {
       color: "#4B5320",
       headline: "…",
       sub: "…",
       cta: "…",
       sections: { beneficios: true, prova: true, faq: true, whatsapp: true },
       fields: ["Nome", "E-mail", "WhatsApp"],
     },
     copy: {
       benefits: [["Título", "Texto"], …],       // 3 itens
       stats: [["+300", "empresas atendidas"], …],  // com a seção prova
       quote: ["Depoimento.", "Nome, cargo"],
       offer: { title, price, note },            // com a seção oferta
       agenda: [["14h", "Abertura"], …],         // com a seção agenda
       address: ["Endereço", "Horário"],         // com a seção local
       countdown: "01 dia · 22 h",               // com a seção contagem
       faq: COMMON_FAQ,
     },
   } satisfies LandingTemplate;
   ```

2. Acrescente o import e a linha no `landing-pages/index.ts`, no grupo do plano.
3. `npm run db:catalog` e `npm test`.

**Regras**
- Cada seção ligada em `defaults.sections` precisa do texto correspondente em `copy` (oferta → `offer`, local → `address`, agenda → `agenda`, contagem → `countdown`, prova → `stats`/`quote`).
- Seção nova do editor entra em `LandingSection`, `SECTION_LABEL` e `LANDING_SECTIONS` (`landing-pages/types.ts` e `index.ts`) e no `LandingRenderer`.
- O texto do template é amostra: o cliente troca tudo no editor. Nada de preço, endereço ou nome reais de terceiros.

## Os produtos e os templates

- **Dashboards** (SaaS de dashboards): todos os templates de dashboard, gateados pelo plano (Básico, Padrão, Avançado).
- **Landing pages** (SaaS de LPs): todos os templates de LP, gateados pelo plano de LP com o mesmo tier (`lp_base`, `lp_pro`, `lp_avancado`).

## Catálogo atual

| Plano | Dashboards | Landing pages |
|---|---|---|
| Básico | 2 visuais (VYZ, Lavanda) × 8 objetivos | 4 |
| Padrão | 3 visuais (+ Pulso) | 8 |
| Avançado | 6 visuais (+ Noturno, Areia, Fachada) | 13 |

## Orgânico (Instagram e Página do Facebook)

O login do Meta também traz as Páginas e o Instagram profissional ligado a cada uma (`listAccounts` em `server/integrations/providers/meta.ts`). Cada perfil vira uma conta própria em `ad_accounts` (plataformas `instagram` e `facebook`, tipo `social`, `oauth_provider = meta` no catálogo) e conta 1 conta do plano. A sincronização grava em `organic_daily` (por dia) e `organic_posts` (cada post com os números de vida inteira), pelo `fetchOrganicDataset` (real) ou `generateOrganicData` (simulado). Desde 2025 o Meta não dá mais impressões: o número principal é **visualizações** (Instagram `views`, Página `page_media_view`).

No dashboard, o orgânico chega em `data.organic` (`aggregateOrganic`, `features/analytics/organic.ts`) para qualquer modelo com dados reais que tenha um Instagram ou uma Página ligados. As abas são `organico` (cards, série e tabela por perfil) e `conteudo` (ranking de posts, reels e stories), em `features/analytics/organic/OrganicPages.tsx`. Nos modelos, cada Instagram ligado vira a página `instagram`, cada Página a `pagina-facebook`, e os posts entram em `conteudo` (`composePages`).

Antes de publicar uma mudança aqui: `npm run db:push` (migração `20261112090000_organic.sql`) e `npm run db:catalog` (plataformas, páginas e modelos novos).

## Fachada: lançamento imobiliário e leads

Visual `fachada` (`visuais/fachada.ts`, desenho em `skins/Fachada.tsx` e `skins/fachada/`), plano Avançado. Lançado em 13/11/2026.

- **Capa** (primeira aba): título, endereço, campanhas em destaque, funil do período e a imagem do empreendimento. Sem imagem, uma ilustração padrão (`fachada/Tower.tsx`) na cor de destaque. A pessoa troca a imagem e o endereço pelo botão no canto (`CoverDialog`): PNG sem fundo vira "recorte", JPG vira "foto" (detecção automática, `cover.ts`).
- **Medidores**: resultado por origem, ritmo por trecho do período, verba do mês e custo contra o alvo. Seguem o objetivo (`goalOf`): leads e visitas no imobiliário, vendas e receita em venda.
- **Abas internas**: os blocos padrão com a disposição 16:9 do visual (`layout` em `visuais/fachada.ts`, novo campo opcional de `Visual`).
- **Planilha do lançamento** (`features/import/launch-sheet.ts`): data e leads obrigatórias; origem, atendimentos, visitas, propostas, vendas e valor vendido opcionais. Só contagens, nada de dado pessoal. `metrics/launch-dataset.ts` põe o funil da planilha por cima do Dataset (o investimento continua vindo das plataformas).
- **Leitura**: `server/import/launch.ts`. Com `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`, lê planilhas fechadas compartilhadas com o e-mail da conta de serviço (exige o código do workspace, `launchCode`, no cabeçalho). Sem ela, só planilha aberta por link.

- **Onde grava**: `dashboards.cover` (caminho da imagem no bucket `dashboard-covers`, recorte ou foto e endereço) e a tabela `dashboard_launch_sheets` (link e as linhas da última leitura). Migração `20261118150000_dashboard_cover_launch_sheet.sql`. Ações em `server/dashboards/cover-actions.ts`; releitura diária em `server/import/launch-scheduled.ts`, chamada pelo `/api/cron/sync`. Sem a migração aplicada, o dashboard abre com a capa padrão (a consulta tolera a falta).

Migração aplicada e registrada em 13/11/2026. Para ler planilhas fechadas, falta criar a conta de serviço (sem papel no projeto, com a Google Sheets API ligada) e pôr o JSON em `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` na Vercel; até lá, a tela pede a planilha em "Qualquer pessoa com o link".
