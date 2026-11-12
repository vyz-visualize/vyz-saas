// Copia o catálogo do código para o banco (planos, limites, preços, itens,
// plataformas, tipos de negócio, páginas e templates). O código é a fonte de
// verdade; o banco precisa da cópia para FKs e para aplicar os limites.
//
//   npm run db:catalog
//
// Idempotente, numa transação. O que sumiu do código fica inativo (não é
// apagado: dashboards antigos ainda apontam para ele).

import postgres from "postgres";
import { PLATFORMS, PLATFORM_ORDER, type PlatformId } from "@/features/accounts/platforms";
import { PROVIDER_IDS, type ProviderId } from "@/features/integrations/providers";
import { BUSINESS_TYPES, templateBusinessTypes } from "@/features/catalog/business-types";
import { BILLING_ITEMS, INTERVAL, planPriceId } from "@/features/pricing/catalog";
import { ENTITLEMENTS, TIER_LABEL, TIERS } from "@/features/pricing/entitlements";
import { LP_PLAN_PAGES, PLAN, PLAN_LABEL, lpMonthly, planDbId, type Period, type PlanId } from "@/features/pricing/pricing";
import { LANDING_TEMPLATES } from "@/features/templates/landing-pages";
import { ALL_DASHBOARD_TEMPLATES } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";

process.loadEnvFile?.(".env.local");
const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL não definido (.env.local)");

const PRICED: PlanId[] = ["base", "pro", "avancado"];
const PERIODS: Period[] = ["mensal", "anual"];
// Login que conecta cada plataforma (o YouTube entra pelo login do Google Ads).
// Instagram e Página do Facebook (orgânico) chegam pelo login do Meta.
const OAUTH: Partial<Record<PlatformId, ProviderId>> = { ...Object.fromEntries(PROVIDER_IDS.map((p) => [p, p])), youtube: "google", instagram: "meta", facebook: "meta" };
const CONNECT_READY: PlatformId[] = [...PROVIDER_IDS, "instagram", "facebook"];

async function main() {
  const sql = postgres(url!, { ssl: "require", max: 1, prepare: false, onnotice: () => {} });
  const counts: Record<string, number> = {};

  await sql.begin(async (tx) => {
    // planos
    const plans = [
      ...TIERS.map((id, rank) => ({ id, name: TIER_LABEL[id], rank, self_serve: id !== "personalizado", is_active: true, product: "dash" })),
      ...PRICED.map((tier, i) => ({ id: planDbId("lp", tier), name: `LP ${PLAN_LABEL[tier]}`, rank: 10 + i, self_serve: true, is_active: true, product: "lp" })),
    ];
    await tx`insert into public.plans ${tx(plans)}
      on conflict (id) do update set name = excluded.name, rank = excluded.rank, self_serve = excluded.self_serve, is_active = true, product = excluded.product`;
    await tx`update public.plans set is_active = false where id <> all(${plans.map((p) => p.id)})`;
    counts.plans = plans.length;

    const entitlements: Record<string, unknown>[] = TIERS.map((id) => {
      const e = ENTITLEMENTS[id];
      return {
        plan_id: id,
        dashboard_templates: e.dashboardTemplates,
        landing_templates: e.landingTemplates,
        platforms: e.platforms,
        pages_plan_id: e.pages,
        white_label: e.whiteLabel,
        audio: e.audio,
        custom_dashboards: e.customDashboards,
        agent_chat: e.agentChat,
        agent_voice: e.agentVoice,
        max_dashboards: e.maxDashboards,
        max_landing_pages: e.maxLandingPages,
        max_members: e.maxMembers,
        max_accounts_per_platform: e.maxAccountsPerPlatform,
      };
    });
    // landing pages: sem dashboards nem contas; LPs do pacote e templates por tier
    for (const tier of PRICED) {
      const e = ENTITLEMENTS[tier];
      entitlements.push({
        ...entitlements[TIERS.indexOf(tier)],
        plan_id: planDbId("lp", tier),
        dashboard_templates: 0,
        platforms: "core",
        custom_dashboards: false,
        audio: "none",
        agent_voice: false,
        max_dashboards: 0,
        max_landing_pages: LP_PLAN_PAGES[tier],
        landing_templates: e.landingTemplates,
      });
    }
    await tx`insert into public.plan_entitlements ${tx(entitlements)}
      on conflict (plan_id) do update set
        dashboard_templates = excluded.dashboard_templates, landing_templates = excluded.landing_templates,
        platforms = excluded.platforms, pages_plan_id = excluded.pages_plan_id, white_label = excluded.white_label,
        audio = excluded.audio, custom_dashboards = excluded.custom_dashboards, agent_chat = excluded.agent_chat,
        agent_voice = excluded.agent_voice, max_dashboards = excluded.max_dashboards, max_landing_pages = excluded.max_landing_pages,
        max_members = excluded.max_members, max_accounts_per_platform = excluded.max_accounts_per_platform`;
    counts.plan_entitlements = entitlements.length;

    const prices: Record<string, unknown>[] = PRICED.flatMap((plan) =>
      PERIODS.map((period) => ({
        id: planPriceId(plan, period),
        plan_id: plan,
        interval: INTERVAL[period],
        currency: "BRL",
        // o banco calcula first + extra × (projetos − 1); plano fixo: extra 0, first = preço do plano
        first_account_cents: PLAN[plan][period],
        extra_account_cents: 0,
        addon_cents: 0,
        is_active: true,
      })),
    );
    for (const tier of PRICED) {
      prices.push({
        id: `${planDbId("lp", tier)}_month`,
        plan_id: planDbId("lp", tier),
        interval: "month",
        currency: "BRL",
        first_account_cents: lpMonthly(tier),
        extra_account_cents: 0,
        addon_cents: 0,
        is_active: true,
      });
    }
    await tx`insert into public.plan_prices ${tx(prices)}
      on conflict (id) do update set
        plan_id = excluded.plan_id, interval = excluded.interval, currency = excluded.currency,
        first_account_cents = excluded.first_account_cents, extra_account_cents = excluded.extra_account_cents,
        addon_cents = excluded.addon_cents, is_active = true`;
    await tx`update public.plan_prices set is_active = false where id <> all(${prices.map((p) => p.id as string)})`;
    counts.plan_prices = prices.length;

    const items = Object.values(BILLING_ITEMS).map((i) => ({ id: i.id, name: i.name, kind: i.kind, unit_cents: i.unitCents, currency: "BRL", is_active: true }));
    await tx`insert into public.billing_items ${tx(items)}
      on conflict (id) do update set name = excluded.name, kind = excluded.kind, unit_cents = excluded.unit_cents, is_active = true`;
    await tx`update public.billing_items set is_active = false where id <> all(${items.map((i) => i.id)})`;
    counts.billing_items = items.length;

    // plataformas
    const platforms = PLATFORM_ORDER.map((id, sort) => {
      const p = PLATFORMS[id];
      return {
        id,
        name: p.name,
        short_name: p.short,
        kind: p.kind,
        min_plan_id: p.tier,
        oauth_provider: OAUTH[id] ?? null,
        connect_available: CONNECT_READY.includes(id),
        sort,
        is_active: true,
      };
    });
    await tx`insert into public.platforms ${tx(platforms)}
      on conflict (id) do update set
        name = excluded.name, short_name = excluded.short_name, kind = excluded.kind, min_plan_id = excluded.min_plan_id,
        oauth_provider = excluded.oauth_provider, connect_available = excluded.connect_available, sort = excluded.sort, is_active = true`;
    await tx`update public.platforms set is_active = false where id <> all(${PLATFORM_ORDER})`;
    counts.platforms = platforms.length;

    // tipos de negócio
    const business = BUSINESS_TYPES.map((b, sort) => ({ id: b.id, name: b.name, description: b.description, profile: b.profile, sort, is_available: b.available }));
    await tx`insert into public.business_types ${tx(business)}
      on conflict (id) do update set name = excluded.name, description = excluded.description, profile = excluded.profile, sort = excluded.sort, is_available = excluded.is_available`;
    await tx`update public.business_types set is_available = false where id <> all(${BUSINESS_TYPES.map((b) => b.id)})`;
    counts.business_types = business.length;

    // páginas
    const pages = Object.values(PAGES).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      min_plan_id: p.tier,
      template_only: !!p.templateOnly,
      is_soon: !!p.soon,
    }));
    await tx`insert into public.dashboard_page_types ${tx(pages)}
      on conflict (id) do update set name = excluded.name, description = excluded.description, min_plan_id = excluded.min_plan_id,
        template_only = excluded.template_only, is_soon = excluded.is_soon`;
    counts.dashboard_page_types = pages.length;

    // templates de dashboard (+ plataformas, páginas e tipos de negócio)
    const templates = ALL_DASHBOARD_TEMPLATES.map((t, sort) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      profile: t.profile,
      min_plan_id: t.tier,
      data_mode: t.dataMode ?? "sample",
      sort,
      is_active: true,
    }));
    await tx`insert into public.dashboard_templates ${tx(templates)}
      on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category,
        profile = excluded.profile, min_plan_id = excluded.min_plan_id, data_mode = excluded.data_mode, sort = excluded.sort, is_active = true`;
    const templateIds = templates.map((t) => t.id);
    await tx`update public.dashboard_templates set is_active = false where id <> all(${templateIds})`;
    // modelos que saíram do código e que nenhum dashboard usa: saem do banco (os filhos saem em cascata)
    const gone = await tx`delete from public.dashboard_templates t where t.id <> all(${templateIds})
      and not exists (select 1 from public.dashboards d where d.template_id = t.id) returning t.id`;
    counts.dashboard_templates_removed = gone.length;
    await tx`delete from public.dashboard_template_platforms where template_id = any(${templateIds})`;
    await tx`delete from public.dashboard_template_pages where template_id = any(${templateIds})`;
    await tx`delete from public.dashboard_template_business_types where template_id = any(${templateIds})`;
    const tPlatforms = ALL_DASHBOARD_TEMPLATES.flatMap((t) => t.sources.map((platform_id) => ({ template_id: t.id, platform_id })));
    const tPages = ALL_DASHBOARD_TEMPLATES.flatMap((t) => t.pages.map((page_type_id, position) => ({ template_id: t.id, page_type_id, position })));
    const tBusiness = ALL_DASHBOARD_TEMPLATES.flatMap((t) => templateBusinessTypes(t.profile).map((business_type_id) => ({ template_id: t.id, business_type_id })));
    await tx`insert into public.dashboard_template_platforms ${tx(tPlatforms)}`;
    await tx`insert into public.dashboard_template_pages ${tx(tPages)}`;
    await tx`insert into public.dashboard_template_business_types ${tx(tBusiness)}`;
    counts.dashboard_templates = templates.length;

    // templates de landing page
    const landing = LANDING_TEMPLATES.map((t, sort) => ({ id: t.id, name: t.name, description: t.description, category: t.category, min_plan_id: t.tier, sort, is_active: true }));
    await tx`insert into public.landing_templates ${tx(landing)}
      on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category,
        min_plan_id = excluded.min_plan_id, sort = excluded.sort, is_active = true`;
    await tx`update public.landing_templates set is_active = false where id <> all(${landing.map((l) => l.id)})`;
    counts.landing_templates = landing.length;
  });

  await sql.end();
  console.log("Catálogo sincronizado:", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
