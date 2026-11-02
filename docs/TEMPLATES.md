# VYZ · Templates de dashboard e de landing page

Padrão do projeto: **cada template é um arquivo**, e cada catálogo tem um índice que junta os arquivos na ordem dos planos. Template novo nunca entra no meio de uma lista grande; ele ganha o próprio arquivo.

## Onde fica cada coisa

```
src/features/templates/
  types.ts                         tipos dos dashboards (DashboardTemplate, PageId, WidgetSpec)
  pages.ts                         biblioteca de páginas do dashboard (o que cada aba mostra)
  live.ts                          templates com dados reais (Meta e Google · E-commerce) + catálogo completo
  dashboards/
    index.ts                       DASHBOARD_TEMPLATES (ordem: Básico, Padrão, Avançado), categorias, busca por id
    catalog/<id>.ts                um template de dashboard com dados de exemplo
  landing-pages/
    index.ts                       LANDING_TEMPLATES (mesma ordem), landingTemplate, landingDefaults
    types.ts                       LandingTemplate, LandingContent, seções do editor
    shared.ts                      textos repetidos entre templates (COMMON_FAQ)
    catalog/<id>.ts                um template de landing page
```

Quem importa continua usando `@/features/templates/dashboards` e `@/features/templates/landing-pages` (o índice da pasta).

## Criar um template de dashboard

1. Crie `src/features/templates/dashboards/catalog/<id>.ts`. O `id` é o nome do arquivo, em minúsculas e com hífen, e **não muda depois de publicado** (dashboards criados apontam para ele).

   ```ts
   import type { DashboardTemplate } from "../../types";

   export default {
     id: "varejo-local",
     name: "Varejo local · Visitas e rotas",
     category: "Negócio local",            // uma de DASHBOARD_CATEGORIES
     tier: "base",                          // base (Básico) | pro (Padrão) | avancado (Avançado)
     profile: "local",                      // perfil de métricas (features/metrics/definitions.ts)
     sources: ["meta", "google"],           // plataformas que o template lê
     pages: ["visao-geral", "por-plataforma", "campanhas", "funil"],
     description: "Uma frase sobre a decisão que este dashboard ajuda a tomar.",
   } satisfies DashboardTemplate;
   ```

2. Acrescente o import e a linha no `dashboards/index.ts`, dentro do grupo do plano.
3. Rode `npm run db:catalog` (o banco precisa do template para aceitar dashboards criados a partir dele).
4. Rode `npm test`. Os testes conferem, entre outras coisas, que o template só usa plataformas do próprio plano.

**Regras**
- As plataformas em `sources` precisam caber no plano do template (Básico: Meta, Google Ads e GA4).
- As páginas acima do plano do template aparecem com cadeado para quem não tem o plano; prefira páginas do próprio plano. Planos das páginas: `pages.ts` (Básico: visão geral, por plataforma, campanhas, funil; Padrão: + criativos, metas, público, comparativo, carteira, termos; Avançado: todas).
- Página nova (widget novo) entra em `pages.ts` e em `PageId` (`types.ts`), e depois no `db:catalog`.
- A quantidade de templates por plano que aparece no site e no painel é **contada no catálogo** (`features/pricing/entitlements.ts`); não existe número escrito à mão.

### Dashboards com dados reais

Os templates de `live.ts` (`dataMode: "live"`) leem o que a sincronização grava das contas conectadas e têm layout próprio em `src/features/analytics/meta` e `src/features/analytics/google`. Um template live novo precisa do layout dele nessa pasta e do mapeamento em `features/analytics/preview.ts` (`TEMPLATE_PLATFORM`).

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
| Básico | 8 (2 com dados reais) | 4 |
| Padrão | 14 | 8 |
| Avançado | 25 | 13 |
