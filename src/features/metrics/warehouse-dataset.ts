// Dados reais em qualquer modelo: as linhas do armazém (Meta e Google, já sincronizadas)
// viram o mesmo Dataset que a amostra gera, e os widgets de todos os modelos desenham
// sem saber de onde veio. Valores do armazém em reais; o Dataset trabalha em centavos.
// O CRM vem das contas de CRM ligadas (crm_daily); o que as contas não trazem
// (carteira de clientes, projetos) fica vazio.

import type { PlatformId } from "@/features/accounts/platforms";
import type { WarehouseRows } from "@/features/analytics/types";
import { parseAgeGender } from "@/features/sync/breakdowns";
import type { Profile } from "./definitions";
import { crmStagesForDataset, type CrmRow } from "./crm";
import { metaPurchaseFunnel, type FunnelStep } from "./funnel";
import { FORMAT_LABEL } from "@/features/analytics/format";

/** Cores da miniatura de amostra dos criativos (as 5 do widget). */
const CREATIVE_TONES = 5;
/** O formato da plataforma ("video") no rótulo da tela ("Vídeo"). */
const formatLabel = (format: string | null | undefined) => (format ? (FORMAT_LABEL[format] ?? format) : "Imagem");
import type { AudienceRow, Campaign, Creative, Dataset, DayRow, Product } from "./source";

export type WarehouseDatasetSpec = {
  profile: Profile;
  /** Hoje, no fuso das contas (YYYY-MM-DD): conta o "dias atrás" e o mês da verba. */
  today: string;
  /** Meta de CPA (centavos), margem (0 a 1) e verba mensal (centavos), das configurações. */
  goal?: number;
  margin?: number;
  budget?: number;
  maturingDays?: number;
  /** Períodos (quando não há conta de anúncio para dar o intervalo, só o GA4). */
  current?: { from: string; to: string };
  previous?: { from: string; to: string };
};

/** GA4 por dia e canal (analytics_daily), somado entre propriedades. Receita em reais. */
export type AnalyticsRow = { date: string; channel: string; sessions: number; users: number; engagedSessions: number; keyEvents: number; transactions: number; revenue: number };

/** Perfis em que a conversão confirmada é a compra (no resto, o evento-chave). */
const PURCHASE_PROFILES: readonly Profile[] = ["ecommerce", "marketplace", "executivo"];

/** Perfis de loja: o funil é o de compra da Meta (quando a Meta está ligada). */
const SHOP_PROFILES: readonly Profile[] = ["ecommerce", "marketplace"];

const DAY = 86_400_000;
const cents = (v: number | null | undefined) => Math.round((v ?? 0) * 100);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);
const isoAdd = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

function emptyDay(ago: number): DayRow {
  return { ago, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, leads: 0, qualified: 0, visits: 0, calls: 0, sessions: 0, views: 0, byPlatform: {}, maturing: false };
}

/** Dias do intervalo, do mais antigo ao mais novo, somando todas as plataformas. */
function daysOf(sets: readonly WarehouseRows[], range: { from: string; to: string }, today: string, profile: Profile, maturingDays: number): DayRow[] {
  const n = dayDiff(range.to, range.from) + 1;
  const out: DayRow[] = [];
  const at = new Map<string, DayRow>();
  for (let i = 0; i < n; i++) {
    const date = isoAdd(range.from, i);
    const ago = dayDiff(today, date);
    const d = emptyDay(ago);
    // como no ao vivo: os últimos dias do período ainda recebem conversões
    d.maturing = dayDiff(range.to, date) < maturingDays;
    out.push(d);
    at.set(date, d);
  }
  for (const rows of sets) {
    const pid = rows.platform as PlatformId;
    for (const r of rows.accountDaily) {
      const d = at.get(r.date);
      if (!d) continue;
      const spend = cents(r.spend);
      const conv = Math.round(r.conversions);
      d.spend += spend;
      d.impressions += r.impressions;
      d.clicks += r.clicks;
      d.conversions += conv;
      d.revenue += cents(r.conversionValue);
      d.sessions += r.landingPageViews ?? r.linkClicks ?? r.clicks;
      d.views += r.videoViews ?? 0;
      const p = d.byPlatform[pid] ?? { spend: 0, impressions: 0, clicks: 0, conv: 0 };
      d.byPlatform[pid] = { spend: p.spend + spend, impressions: p.impressions + r.impressions, clicks: p.clicks + r.clicks, conv: p.conv + conv };
    }
  }
  // as contas trazem conversões; nos modelos de leads, a conversão é o lead
  for (const d of out) {
    d.leads = d.conversions;
    if (profile === "imob") d.qualified = d.conversions;
  }
  return out;
}

const inRange = (date: string, r: { from: string; to: string }) => date >= r.from && date <= r.to;

function campaignsOf(sets: readonly WarehouseRows[]): Campaign[] {
  const out: Campaign[] = [];
  for (const rows of sets) {
    const names = new Map(rows.campaigns.map((c) => [c.id, c.name]));
    const sum = new Map<string, Campaign>();
    for (const r of rows.campaignDaily) {
      if (!inRange(r.date, rows.current)) continue;
      const c = sum.get(r.campaignId) ?? { id: r.campaignId, name: names.get(r.campaignId) ?? "Campanha", platform: rows.platform as PlatformId, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      c.spend += cents(r.spend);
      c.impressions += r.impressions;
      c.clicks += r.clicks;
      c.conversions += Math.round(r.conversions);
      c.revenue += cents(r.conversionValue);
      sum.set(r.campaignId, c);
    }
    out.push(...sum.values());
  }
  return out.filter((c) => c.spend > 0 || c.impressions > 0).sort((a, b) => b.spend - a.spend);
}

function creativesOf(sets: readonly WarehouseRows[]): Creative[] {
  const out: Creative[] = [];
  for (const rows of sets) {
    const info = new Map(rows.ads.map((a) => [a.id, a]));
    const sum = new Map<string, Creative & { reach: number }>();
    for (const r of rows.adDaily) {
      if (!inRange(r.date, rows.current)) continue;
      const a = info.get(r.adId);
      const c =
        sum.get(r.adId) ??
        { id: r.adId, name: a?.name ?? "Anúncio", format: formatLabel(a?.format), platform: rows.platform as PlatformId, spend: 0, impressions: 0, clicks: 0, conversions: 0, frequency: 0, tone: 0, reach: 0, imageUrl: a?.thumbnailUrl ?? null };
      c.spend += cents(r.spend);
      c.impressions += r.impressions;
      c.clicks += r.linkClicks ?? r.clicks;
      c.conversions += Math.round(r.conversions);
      c.reach += r.reach ?? 0;
      sum.set(r.adId, c);
    }
    out.push(
      ...[...sum.values()].map(({ reach, ...c }, i) => ({ ...c, frequency: reach > 0 ? Math.round((c.impressions / reach) * 10) / 10 : 0, tone: i % CREATIVE_TONES })),
    );
  }
  return out.filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend);
}

const AGE_LABEL: Record<string, string> = { "18-24": "18 a 24", "25-34": "25 a 34", "35-44": "35 a 44", "45-54": "45 a 54", "55-64": "55 a 64", "65+": "65+" };

function audienceOf(sets: readonly WarehouseRows[]): { audience: AudienceRow[]; gender: { label: string; share: number }[] } {
  const byAge = new Map<string, { spend: number; conv: number }>();
  const byGender = { female: 0, male: 0 };
  for (const rows of sets) {
    for (const r of rows.breakdownDaily) {
      if (r.dimension !== "age_gender" || !inRange(r.date, rows.current)) continue;
      const p = parseAgeGender(r.value);
      if (!p) continue;
      const a = byAge.get(p.age) ?? { spend: 0, conv: 0 };
      a.spend += cents(r.spend);
      a.conv += r.conversions;
      byAge.set(p.age, a);
      if (p.gender === "female" || p.gender === "male") byGender[p.gender] += r.impressions;
    }
  }
  const totalSpend = [...byAge.values()].reduce((s, a) => s + a.spend, 0);
  const audience = [...byAge.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([age, a]) => ({ label: AGE_LABEL[age] ?? age, share: totalSpend > 0 ? a.spend / totalSpend : 0, cpa: a.conv > 0 ? Math.round(a.spend / a.conv) : 0 }));
  const g = byGender.female + byGender.male;
  return {
    audience,
    gender: g > 0 ? [
      { label: "Mulheres", share: byGender.female / g },
      { label: "Homens", share: byGender.male / g },
    ] : [],
  };
}

function productsOf(sets: readonly WarehouseRows[]): Product[] {
  const out: Product[] = [];
  for (const rows of sets) {
    const titles = new Map(rows.products.map((p) => [p.id, p.title]));
    const sum = new Map<string, Product>();
    for (const r of rows.productDaily) {
      if (!inRange(r.date, rows.current)) continue;
      const p = sum.get(r.productId) ?? { name: titles.get(r.productId) ?? "Produto", sold: 0, revenue: 0, spend: 0 };
      p.sold += Math.round(r.conversions);
      p.revenue += cents(r.conversionValue);
      p.spend += cents(r.spend);
      sum.set(r.productId, p);
    }
    out.push(...sum.values());
  }
  return out.sort((a, b) => b.revenue - a.revenue);
}

/** Funil do site (GA4): sessões → engajadas → conversões (linhas já do período atual). */
function siteFunnel(current: readonly DayRow[], analytics: readonly AnalyticsRow[]): FunnelStep[] {
  const sessions = current.reduce((a, d) => a + d.sessions, 0);
  const conv = current.reduce((a, d) => a + d.conversions, 0);
  const engaged = analytics.reduce((a, r) => a + r.engagedSessions, 0);
  if (sessions <= 0) return [];
  // sem arredondar aqui: a tela formata (duas casas nos valores pequenos, nunca "0%" com conversão)
  const p = (v: number) => (v / sessions) * 100;
  return [
    { label: "Sessões", pct: 100 },
    { label: "Sessões engajadas", pct: Math.min(100, p(engaged)) },
    { label: "Conversões", pct: p(conv) },
  ];
}

/** Linhas do armazém de cada plataforma ligada → Dataset dos widgets. */
export function datasetFromWarehouse(sets: readonly WarehouseRows[], spec: WarehouseDatasetSpec, analytics: readonly AnalyticsRow[] = [], crm: readonly CrmRow[] = []): Dataset {
  const first = sets[0];
  const maturingDays = spec.maturingDays ?? 3;
  const curRange = first?.current ?? spec.current;
  const prevRange = first?.previous ?? spec.previous;
  const current = curRange ? daysOf(sets, curRange, spec.today, spec.profile, maturingDays) : [];
  const previous = prevRange ? daysOf(sets, prevRange, spec.today, spec.profile, maturingDays).map((d) => ({ ...d, maturing: false })) : [];
  // GA4: sessões do site e a conversão confirmada (sem a atribuição em dobro das plataformas)
  if (analytics.length) {
    const byDate = new Map<string, AnalyticsRow[]>();
    for (const r of analytics) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
    const purchase = PURCHASE_PROFILES.includes(spec.profile);
    const apply = (days: DayRow[], range: { from: string; to: string } | undefined) => {
      if (!range) return;
      for (const d of days) {
        const rows = byDate.get(isoAdd(spec.today, -d.ago)) ?? [];
        const sum = (k: keyof Omit<AnalyticsRow, "date" | "channel">) => rows.reduce((a, r) => a + r[k], 0);
        d.sessions = Math.round(sum("sessions"));
        d.conversions = Math.round(purchase ? sum("transactions") : sum("keyEvents"));
        d.revenue = cents(sum("revenue"));
        d.leads = d.conversions;
        if (spec.profile === "imob") d.qualified = d.conversions;
      }
    };
    apply(current, curRange);
    apply(previous, prevRange);
  }
  const totals = current.reduce((a, d) => ({ impressions: a.impressions + d.impressions, clicks: a.clicks + d.clicks, conv: a.conv + d.conversions }), { impressions: 0, clicks: 0, conv: 0 });
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const { audience, gender } = audienceOf(sets);
  const meta = sets.find((s) => s.platform === "meta");
  const metaFunnel = meta && curRange && SHOP_PROFILES.includes(spec.profile) ? metaPurchaseFunnel(meta.accountDaily, curRange) : [];

  // verba: gasto do mês corrente (até hoje) contra a verba mensal das configurações
  const month = spec.today.slice(0, 7);
  const spentMonth = current.concat(previous).reduce((s, d) => (isoAdd(spec.today, -d.ago).slice(0, 7) === month ? s + d.spend : s), 0);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Number(spec.today.slice(8, 10));

  return {
    spec: { seed: "warehouse", profile: spec.profile, sources: sets.map((s) => s.platform as PlatformId), days: current.length, goal: spec.goal, margin: spec.margin, budget: spec.budget },
    current,
    previous,
    adPlatforms: sets.map((s) => s.platform as PlatformId),
    campaigns: campaignsOf(sets),
    creatives: creativesOf(sets),
    // e-commerce com a Meta: o funil de compra dela (cada etapa sobre a anterior); senão o do
    // site (GA4); senão impressões → cliques → conversões
    funnel: (metaFunnel.length ? metaFunnel : null) ??
      (analytics.length
        ? siteFunnel(current, curRange ? analytics.filter((r) => r.date >= curRange.from && r.date <= curRange.to) : [])
        : totals.impressions > 0
          ? [
              { label: "Impressões", pct: 100 },
              { label: "Cliques", pct: pct(totals.clicks, totals.impressions) },
              { label: "Conversões", pct: pct(totals.conv, totals.impressions) },
            ]
          : []),
    projects: [],
    audience,
    gender,
    products: productsOf(sets),
    crm: crmStagesForDataset(crm, curRange),
    clients: [],
    alerts: [],
    budget: { monthly: spec.budget ?? 0, spent: spentMonth, day, daysInMonth },
    goal: spec.goal ?? 0,
    // sem margem, a regra do produto: equilíbrio no ROAS 1 (receita = investimento)
    breakEven: spec.margin ? 1 / spec.margin : 1,
    marginSet: !!spec.margin,
  };
}
