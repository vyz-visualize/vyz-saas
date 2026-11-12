import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { GOOGLE_CATALOG, META_CATALOG, METRIC_GROUPS, sampleCatalog, sampleExtraCatalog, visibleIds } from "@/features/dashboards/metric-prefs";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { META_ACTION_FIELDS, readMetaActions } from "@/features/sync/meta-actions";
import { aggregateDashboard, redactSpend, SPEND_FIELDS } from "./aggregate";
import { sampleCreatives, sampleExtras } from "./creatives/sample";
import { COMPARE_METRICS } from "./creatives/metrics";
import { GOOGLE_EXTRA_METRICS, META_EXTRA_METRICS, RESULT_METRICS, ADD_TO_CART_METRIC, type AdMetric } from "./live-metrics";
import { sampleDashboardData, sampleRows } from "./preview";
import type { AdDayRow, CampaignDayRow, GoogleView, MetaView, WarehouseRows } from "./types";

const TODAY = "2026-10-30";
const meta = () => sampleDashboardData("meta-ecommerce", { today: TODAY })!.view as MetaView;
const google = () => sampleDashboardData("google-ecommerce", { today: TODAY })!.view as GoogleView;
const kpi = (v: MetaView | GoogleView, id: string) => v.extraKpis?.find((k) => k.id === id);
const adMetric = (id: string) => META_EXTRA_METRICS.find((m) => m.id === id) as AdMetric;
const googleMetric = (id: string) => GOOGLE_EXTRA_METRICS.find((m) => m.id === id)!;

const adDay = (over: Partial<AdDayRow>): AdDayRow => ({ adId: "a", date: "2026-10-01", spend: 0, impressions: 0, reach: null, clicks: 0, linkClicks: null, conversions: 0, conversionValue: 0, videoViews: null, videoThruplays: null, ...over });
const campaignDay = (over: Partial<CampaignDayRow>): CampaignDayRow => ({ campaignId: "c", date: "2026-10-01", spend: 0, impressions: 0, reach: null, clicks: 0, linkClicks: null, landingPageViews: null, addToCart: null, initiateCheckout: null, conversions: 0, conversionValue: 0, videoViews: null, videoThruplays: null, searchImpressionShare: null, searchLostIsBudget: null, searchLostIsRank: null, ...over });

describe("regras que não podem falhar", () => {
  it("custo por ThruPlay usa só o investimento dos anúncios de vídeo", () => {
    const rows = [adDay({ adId: "video", spend: 100, videoViews: 500, videoThruplays: 50 }), adDay({ adId: "imagem", spend: 900 })];
    expect(adMetric("costPerThruplay").value(rows)).toBe(2);
  });

  it("CPV usa só o investimento das campanhas de vídeo", () => {
    const rows = [campaignDay({ campaignId: "v", spend: 100, impressions: 1000, videoViews: 200 }), campaignDay({ campaignId: "s", spend: 900, impressions: 9000 })];
    const isVideo = (id: string) => id === "v";
    expect(googleMetric("cpv").value(rows, isVideo)).toBe(0.5);
    expect(googleMetric("viewRate").value(rows, isVideo)).toBe(0.2);
  });

  it("nos dados simulados, o CPV não leva o custo de quem não é vídeo", () => {
    const v = google();
    const cpv = kpi(v, "cpv")!.value!;
    const views = kpi(v, "videoViews")!.value!;
    expect(cpv * views).toBeLessThan(v.totals.spend! * 0.5);
  });

  it("tempo médio = segundos totais ÷ reproduções, nunca média de médias", () => {
    const rows = [adDay({ videoViews: 100, videoWatchSeconds: 1000 }), adDay({ date: "2026-10-02", videoViews: 900, videoWatchSeconds: 900 })];
    expect(adMetric("avgWatch").value(rows)).toBe(1.9);
  });

  describe("eventos da Meta sem contagem em dobro", () => {
    it("compra vem só do campo agrupado", () => {
      const r = readMetaActions([
        { action_type: "omni_purchase", value: "10" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "8" },
        { action_type: "onsite_conversion.purchase", value: "2" },
        { action_type: "purchase", value: "10" },
      ]);
      expect(r.conversions).toBe(10);
    });

    it("lead, cadastro, carrinho e checkout também", () => {
      const r = readMetaActions([
        { action_type: "lead", value: 7 },
        { action_type: "offsite_conversion.fb_pixel_lead", value: 5 },
        { action_type: "onsite_conversion.lead_grouped", value: 2 },
        { action_type: "omni_complete_registration", value: 4 },
        { action_type: "offsite_conversion.fb_pixel_complete_registration", value: 4 },
        { action_type: "omni_add_to_cart", value: 9 },
        { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: 9 },
        { action_type: "omni_initiated_checkout", value: 3 },
      ]);
      expect([r.leads, r.registrations, r.addToCart, r.initiateCheckout]).toEqual([7, 4, 9, 3]);
    });

    it("cada métrica tem um campo só, e nenhum campo serve a duas", () => {
      const fields = Object.values(META_ACTION_FIELDS);
      expect(new Set(fields).size).toBe(fields.length);
    });

    it("sem o campo na resposta: sem dado, não zero", () => {
      expect(readMetaActions([{ action_type: "offsite_conversion.fb_pixel_purchase", value: 8 }]).conversions).toBeNull();
      expect(readMetaActions(null).leads).toBeNull();
    });
  });
});

describe("investimento oculto cobre todo custo novo", () => {
  const novas = [...META_EXTRA_METRICS, ADD_TO_CART_METRIC, ...RESULT_METRICS, ...GOOGLE_EXTRA_METRICS];

  it("toda métrica de dinheiro é derivada do investimento", () => {
    for (const m of novas) if (m.format === "money") expect([m.id, !!m.spendDerived]).toEqual([m.id, true]);
    for (const m of COMPARE_METRICS) if (m.format === "money" && m.id !== "value") expect([m.id, !!m.spendDerived]).toEqual([m.id, true]);
  });

  it("nome com cara de custo também", () => {
    const costLike = /^(cost|cp[a-z]$|cpc|cpm|cpv|cpl|roas)/i;
    for (const m of [...META_CATALOG, ...GOOGLE_CATALOG]) if (costLike.test(m.id)) expect([m.id, !!m.spendDerived]).toEqual([m.id, true]);
  });

  it("todo id derivado entra na lista que o servidor apaga", () => {
    for (const m of novas) if (m.spendDerived) expect([m.id, SPEND_FIELDS.has(m.id)]).toEqual([m.id, true]);
  });

  /** Procura qualquer número sob um campo derivado, em qualquer profundidade. */
  function leaks(value: unknown, path = "", found: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v, i) => leaks(v, `${path}[${i}]`, found));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (SPEND_FIELDS.has(k) && v != null) found.push(`${path}.${k}`);
        leaks(v, `${path}.${k}`, found);
      }
    }
    return found;
  }

  it.each([
    ["meta", meta],
    ["google", google],
  ] as const)("%s: nada de investimento depois de apagar", (_, load) => {
    const view = redactSpend(load());
    expect(leaks(view)).toEqual([]);
    for (const k of [...view.kpis, ...(view.extraKpis ?? [])]) if (k.spendBased) expect([k.id, k.value, k.spark]).toEqual([k.id, null, []]);
    for (const c of view.campaigns) for (const m of novas) if (m.spendDerived) expect(c.extra?.[m.id] ?? null).toBeNull();
  });

  it("todo card derivado do catálogo também é marcado no card", () => {
    for (const [v, catalog] of [
      [meta(), META_CATALOG],
      [google(), GOOGLE_CATALOG],
    ] as const) {
      const all = [...v.kpis, ...(v.extraKpis ?? [])];
      for (const m of catalog) {
        const card = all.find((k) => k.id === m.id);
        if (card) expect([m.id, !!card.spendBased]).toEqual([m.id, !!m.spendDerived]);
      }
    }
  });

  it("no link, as derivadas não entram nem se o usuário ligou", () => {
    const shown = META_EXTRA_METRICS.filter((m) => m.spendDerived).map((m) => m.id);
    const visible = visibleIds(META_CATALOG, "kpis", { hidden: [], shown }, { hideSpend: true });
    for (const id of shown) expect(visible).not.toContain(id);
  });
});

describe("os padrões não mudam", () => {
  it("cards", () => {
    expect(visibleIds(META_CATALOG, "kpis", undefined)).toEqual(["spend", "revenue", "purchases", "ticket", "cpa", "cpm", "roas", "linkCtr", "frequency"]);
    expect(visibleIds(GOOGLE_CATALOG, "kpis", undefined)).toEqual(["spend", "value", "conversions", "cpa", "cpc", "roas", "ctr", "impressionShare"]);
  });

  it("tabelas", () => {
    expect(visibleIds(META_CATALOG, "columns", undefined)).toEqual(["spend", "revenue", "purchases", "linkClicks", "addToCart", "cpa", "cpm", "roas", "linkCtr", "frequency", "convRate"]);
    expect(visibleIds(GOOGLE_CATALOG, "columns", undefined)).toEqual(["spend", "value", "conversions", "impressions", "clicks", "cpa", "cpc", "roas", "ctr", "impressionShare"]);
  });

  it("amostras: as novas entram desligadas", () => {
    const t = dashboardTemplate("vyz-ecommerce")!;
    const defaults = ["conversions", "cpa"] as const;
    expect(visibleIds(sampleCatalog(t.profile, defaults, t.sources), "kpis", undefined).sort()).toEqual([...defaults].sort());
  });
});

describe("Personalizar", () => {
  it("tem tudo o que foi pedido", () => {
    const m = META_CATALOG.map((x) => x.id);
    for (const id of ["cpcLink", "landingPageViews", "addToCart", "costPerAddToCart", "initiateCheckout", "costPerCheckout", "videoViews", "thruplays", "costPerThruplay", "leads", "cpl", "registrations", "costPerRegistration", "engagement", "reactions", "comments", "shares", "saves", "p25", "p50", "p75", "p95", "p100", "avgWatch", "results", "costPerResult"]) expect(m).toContain(id);
    const g = GOOGLE_CATALOG.map((x) => x.id);
    for (const id of ["lostBudget", "lostRank", "videoViews", "viewRate", "cpv", "allConversions", "interactions", "convRate", "topPct", "absoluteTopPct"]) expect(g).toContain(id);
  });

  it("visitas ao perfil fica de fora", () => {
    for (const catalog of [META_CATALOG, GOOGLE_CATALOG, sampleExtraCatalog(["meta"])]) expect(catalog.map((x) => x.id)).not.toContain("profileVisits");
  });

  it("os grupos pedidos, e todo mundo com explicação", () => {
    expect(METRIC_GROUPS).toEqual(["gerais", "conversoes", "custos", "taxas", "video", "engajamento"]);
    expect(new Set(META_CATALOG.map((x) => x.group))).toEqual(new Set(METRIC_GROUPS));
    for (const x of [...META_CATALOG, ...GOOGLE_CATALOG]) expect([x.id, x.help.length > 8, METRIC_GROUPS.includes(x.group)]).toEqual([x.id, true, true]);
  });

  it("toda métrica do catálogo tem card", () => {
    for (const [v, catalog] of [
      [google(), GOOGLE_CATALOG],
      [meta(), META_CATALOG.filter((x) => x.id !== "results" && x.id !== "costPerResult")],
    ] as const) {
      const ids = [...v.kpis, ...(v.extraKpis ?? [])].map((k) => k.id);
      for (const x of catalog) if (x.kpi) expect([x.id, ids.includes(x.id)]).toEqual([x.id, true]);
    }
  });

  it("toda coluna nova existe na tabela de campanhas", () => {
    for (const c of meta().campaigns) for (const m of META_EXTRA_METRICS) expect(c.extra).toHaveProperty(m.id);
    for (const c of google().campaigns) for (const m of GOOGLE_EXTRA_METRICS) expect(c.extra).toHaveProperty(m.id);
  });
});

describe("total por conta certo", () => {
  const rows = () => sampleRows("meta", { today: TODAY });
  const inCur = (r: WarehouseRows, d: string) => d >= r.current.from && d <= r.current.to;

  it("a soma dos anúncios fecha com a soma das campanhas", () => {
    const r = rows();
    const ads = r.adDaily.filter((x) => inCur(r, x.date));
    const camps = r.campaignDaily.filter((x) => inCur(r, x.date));
    const sum = <T,>(l: T[], p: (x: T) => number | null | undefined) => l.reduce((a, x) => a + Number(p(x) ?? 0), 0);
    expect(sum(ads, (x) => x.impressions)).toBe(sum(camps, (x) => x.impressions));
    expect(sum(ads, (x) => x.clicks)).toBe(sum(camps, (x) => x.clicks));
    expect(sum(ads, (x) => x.spend)).toBeCloseTo(sum(camps, (x) => x.spend), 2);
    expect(sum(ads, (x) => x.conversions)).toBe(sum(camps, (x) => x.conversions));
  });

  it("os cards comparam com o período anterior", () => {
    const v = meta();
    for (const id of ["engagement", "registrations", "leads", "landingPageViews", "cpcLink"]) {
      expect([id, kpi(v, id)!.previous != null, kpi(v, id)!.spark.length]).toEqual([id, true, 30]);
    }
  });

  it("sem mudar o card por conta: Google lê as campanhas", () => {
    const v = google();
    expect(kpi(v, "interactions")!.value).toBeGreaterThan(kpi(v, "clicks")!.value!);
    expect(kpi(v, "allConversions")!.value!).toBeGreaterThan(v.kpis.find((k) => k.id === "conversions")!.value!);
    expect(kpi(v, "topPct")!.value!).toBeGreaterThan(kpi(v, "absoluteTopPct")!.value!);
    expect(kpi(v, "lostBudget")!.value).toBeCloseTo(v.impressionShare.lostBudget!, 6);
  });
});

describe("Resultados", () => {
  const rowsWith = (objective: (name: string) => string): WarehouseRows => {
    const r = sampleRows("meta", { today: TODAY });
    return { ...r, campaigns: r.campaigns.map((c) => ({ ...c, objective: objective(c.name) })) };
  };

  it("tipos diferentes no período: sem card, com o motivo", () => {
    const v = meta();
    expect(v.resultsMixed).toBe(true);
    expect(kpi(v, "results")).toBeUndefined();
    expect(kpi(v, "costPerResult")).toBeUndefined();
  });

  it("um tipo só: tem card, com custo = investimento ÷ resultados", () => {
    const v = aggregateDashboard(rowsWith(() => "OUTCOME_SALES"), { breakEvenRoas: 2.5 }) as MetaView;
    expect(v.resultsMixed).toBe(false);
    const results = kpi(v, "results")!.value!;
    expect(results).toBeGreaterThan(0);
    expect(kpi(v, "costPerResult")!.value).toBeCloseTo(v.totals.spend! / results, 2);
  });

  it("campanha de outro tipo sem entrega no período não mistura", () => {
    const r = rowsWith((name) => (name.includes("Retenção") ? "OUTCOME_ENGAGEMENT" : "OUTCOME_SALES"));
    const retention = r.campaigns.find((c) => c.name.includes("Retenção"))!.id;
    const ads = new Set(r.ads.filter((a) => a.campaignId === retention).map((a) => a.id));
    const v = aggregateDashboard({ ...r, adDaily: r.adDaily.filter((x) => !ads.has(x.adId)) }, { breakEvenRoas: 2.5 }) as MetaView;
    expect(v.resultsMixed).toBe(false);
    expect(kpi(v, "results")).toBeDefined();
  });

  it("na tabela, cada campanha mostra o seu resultado", () => {
    const v = meta();
    const labels = new Set(v.campaigns.map((c) => c.resultLabel));
    expect(labels).toEqual(new Set(["compras", "leads", "interações"]));
    for (const c of v.campaigns) {
      expect(c.extra?.results).toBeGreaterThan(0);
      expect(c.extra?.costPerResult).toBeCloseTo(c.spend! / c.extra!.results!, 2);
    }
  });
});

describe("amostras", () => {
  const spec = { name: "Teste", client: "Loja", settings: DEFAULT_SETTINGS };
  const opts = { period: "30d" as const, customDays: 30, today: TODAY };

  it("modelo só com Meta: nome normal", () => {
    const c = sampleExtraCatalog(["meta"]);
    expect(c.find((x) => x.id === "registrations")?.label).toBe("Cadastros");
    expect(c.find((x) => x.id === "registrations")?.help).not.toContain("parte da Meta");
  });

  it("modelo com Meta e Google: o nome diz que vale só para a Meta, e a ajuda explica", () => {
    const c = sampleExtraCatalog(["meta", "google", "ga4"]);
    for (const x of c) {
      expect(x.label).toMatch(/ · Meta$/);
      expect(x.help).toContain("Só a parte da Meta");
    }
    expect(c.find((x) => x.id === "registrations")?.label).toBe("Cadastros · Meta");
  });

  it("GA4 não conta como outra plataforma de anúncios", () => {
    expect(sampleExtraCatalog(["meta", "ga4"]).find((x) => x.id === "registrations")?.label).toBe("Cadastros");
  });

  it("modelo só com Google: as do Google", () => {
    const ids = sampleExtraCatalog(["google"]).map((x) => x.id);
    expect(ids).toContain("topPct");
    expect(ids).not.toContain("registrations");
  });

  it("TikTok, YouTube e sem plataforma de anúncios: nenhuma", () => {
    expect(sampleExtraCatalog(["tiktok"])).toEqual([]);
    expect(sampleExtraCatalog(["youtube"])).toEqual([]);
    expect(sampleExtras({ ...dashboardTemplate("vyz-ecommerce")!, sources: ["tiktok"] }, spec, opts)).toEqual([]);
  });

  it("não duplica o que o modelo já tem", () => {
    const ids = sampleExtraCatalog(["meta"]).map((x) => x.id);
    for (const id of ["leads", "cpl", "clicks", "ctr"]) expect(ids).not.toContain(id);
    expect(new Set(sampleCatalog("midia", [], ["meta"]).map((x) => x.id)).size).toBe(sampleCatalog("midia", [], ["meta"]).length);
  });

  it("valores nos dois períodos, com o rótulo do catálogo", () => {
    const list = sampleExtras(dashboardTemplate("lavanda-ecommerce")!, spec, opts);
    const reg = list.find((x) => x.id === "registrations")!;
    expect(reg.label).toBe("Cadastros · Meta");
    expect(reg.value).toBeGreaterThan(0);
    expect(reg.previous).toBeGreaterThan(0);
  });

  it("os custos fecham com a parte da Meta dos anúncios", () => {
    const t = dashboardTemplate("vyz-ecommerce")!;
    const list = sampleExtras(t, spec, opts);
    const c = sampleCreatives(t, spec, ["criativos"], { tier: "avancado", tab: "comparativo" }, opts)!;
    const days = c.compare.flatMap((a) => a.days);
    const spend = days.reduce((a, d) => a + d.spend, 0);
    const registrations = days.reduce((a, d) => a + Number(d.registrations ?? 0), 0);
    expect(list.find((x) => x.id === "registrations")!.value).toBe(registrations);
    expect(list.find((x) => x.id === "costPerRegistration")!.value).toBeCloseTo(spend / registrations, 4);
  });

  it("investimento oculto: nenhum custo sai do servidor", () => {
    const list = sampleExtras(dashboardTemplate("lavanda-ecommerce")!, spec, { ...opts, hideSpend: true });
    expect(list.length).toBeGreaterThan(5);
    for (const x of list) expect([x.id, x.format]).not.toEqual([x.id, "money"]);
  });

});
