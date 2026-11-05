import { describe, expect, it } from "vitest";
import { parseAgeGender } from "./breakdowns";
import type { AccountDataset, BasicMetrics, CampaignDay, DailyMetrics } from "./dataset";
import { addDays, dateRange } from "./dates";
import { generateAccountData, type GenerateAccountInput, type MockAccountDataset } from "./mock-generator";
import { rollupAccountDaily, sumMetrics } from "./rollup";

const END = "2026-10-28";
const META: GenerateAccountInput = { platform: "meta", accountExternalId: "act_1000000000000001", accountName: "Loja Exemplo · Brasil", currency: "BRL", endDate: END, days: 90 };
const GOOGLE: GenerateAccountInput = { platform: "google", accountExternalId: "123-456-7890", accountName: "Loja Exemplo · Brasil", currency: "BRL", endDate: END, days: 90 };

const meta = generateAccountData(META);
const google = generateAccountData(GOOGLE);
const BOTH: [string, MockAccountDataset][] = [
  ["Meta", meta],
  ["Google", google],
];

// ---- ajudantes ----------------------------------------------------------------------

/** Centavos/centésimos: compara somas sem erro de ponto flutuante. */
const hundredths = (v: number) => Math.round(v * 100);
const sum = <T>(rows: readonly T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

function groupBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

const basicTotals = (rows: readonly BasicMetrics[]) => ({
  spend: sum(rows, (r) => hundredths(r.spend)),
  impressions: sum(rows, (r) => r.impressions),
  clicks: sum(rows, (r) => r.clicks),
  conversions: sum(rows, (r) => hundredths(r.conversions)),
  value: sum(rows, (r) => hundredths(r.conversionValue)),
});

const lastDays = <T extends { date: string }>(rows: readonly T[], days: number, end = END) => rows.filter((r) => r.date > addDays(end, -days) && r.date <= end);

const roas = (m: DailyMetrics) => m.conversionValue / m.spend;
const campaignTotals = (ds: AccountDataset, id: string, days = 30) => sumMetrics(lastDays(ds.campaignDaily.filter((r) => r.campaignExternalId === id), days));
const byDate = <T extends { date: string }>(rows: readonly T[]) => groupBy(rows, (r) => r.date);

/** Uma conta qualquer, para conferir que as faixas valem para todas, não só para as do exemplo. */
const sample = (platform: "meta" | "google", n: number) =>
  Array.from({ length: n }, (_, i) =>
    generateAccountData({ platform, accountExternalId: platform === "meta" ? `act_9${i}0012345678` : `9${i}1-234-5678`, accountName: `Marca ${i}`, currency: "BRL", endDate: END, days: 30 }),
  );

// ---- determinismo ----------------------------------------------------------------------

describe("gerador simulado · determinismo", () => {
  it("o mesmo pedido gera exatamente os mesmos dados", () => {
    expect(generateAccountData(META)).toEqual(meta);
    expect(generateAccountData(GOOGLE)).toEqual(google);
  });

  it("contas diferentes geram números e ids diferentes", () => {
    const other = generateAccountData({ ...META, accountExternalId: "act_2000000000000002" });
    expect(sum(other.campaignDaily, (r) => r.spend)).not.toBe(sum(meta.campaignDaily, (r) => r.spend));
    expect(other.campaigns.map((c) => c.externalId)).not.toEqual(meta.campaigns.map((c) => c.externalId));
    expect(other.campaigns.map((c) => c.name)).toEqual(meta.campaigns.map((c) => c.name));
  });

  it("cada dia não depende do período pedido (90 ou 7 dias dão os mesmos números)", () => {
    for (const input of [META, GOOGLE]) {
      const full = generateAccountData(input);
      const week = generateAccountData({ ...input, days: 7 });
      const inWeek = <T extends { date: string }>(rows: T[]) => rows.filter((r) => r.date >= week.range.from);
      expect(week.range).toEqual({ from: addDays(END, -6), to: END });
      expect(week.campaignDaily).toEqual(inWeek(full.campaignDaily));
      expect(week.adDaily).toEqual(inWeek(full.adDaily));
      expect(week.breakdownDaily).toEqual(inWeek(full.breakdownDaily));
      expect(week.searchTermDaily).toEqual(inWeek(full.searchTermDaily));
      expect(week.productDaily).toEqual(inWeek(full.productDaily));
      expect(week.accountDaily).toEqual(inWeek(full.accountDaily));
      expect(week.campaigns).toEqual(full.campaigns);
    }
  });

  it("com a mesma âncora, um período mais novo repete os dias maduros e só revisa os 3 últimos", () => {
    const later = generateAccountData({ ...META, endDate: addDays(END, 10), days: 30, anchorDate: END });
    const matured = (rows: CampaignDay[]) => rows.filter((r) => r.date >= later.range.from && r.date <= addDays(END, -3));
    expect(matured(later.campaignDaily)).toEqual(matured(meta.campaignDaily));

    // nos 3 últimos dias do período antigo as compras ainda estavam chegando
    for (const date of dateRange(END, 3)) {
      const before = meta.accountDaily.find((r) => r.date === date)!;
      const after = later.accountDaily.find((r) => r.date === date)!;
      expect(after.spend).toBe(before.spend);
      expect(after.clicks).toBe(before.clicks);
      expect(after.conversions).toBeGreaterThanOrEqual(before.conversions);
      if (date === END) expect(after.conversions).toBeGreaterThan(before.conversions * 1.1);
    }
  });

  it("sem âncora, a referência das histórias é o fim do período", () => {
    expect(generateAccountData({ ...META, anchorDate: END })).toEqual(meta);
  });

  it("outra moeda muda a escala, não a forma", () => {
    const usd = generateAccountData({ ...META, currency: "USD" });
    const brl = sumMetrics(meta.accountDaily);
    const dollars = sumMetrics(usd.accountDaily);
    expect(usd.currency).toBe("USD");
    expect(dollars.spend / brl.spend).toBeCloseTo(0.18, 2);
    expect(dollars.impressions).toBeGreaterThan(brl.impressions * 0.97);
    expect(dollars.impressions).toBeLessThan(brl.impressions * 1.03);
  });

  it("recusa entrada inválida", () => {
    expect(() => generateAccountData({ ...META, platform: "tiktok" as never })).toThrow(RangeError);
    expect(() => generateAccountData({ ...META, days: 0 })).toThrow(RangeError);
    expect(() => generateAccountData({ ...META, days: 1.5 })).toThrow(RangeError);
    expect(() => generateAccountData({ ...META, endDate: "2026-02-30" })).toThrow(RangeError);
    expect(() => generateAccountData({ ...META, anchorDate: "ontem" })).toThrow(RangeError);
    expect(() => generateAccountData({ ...META, accountExternalId: " " })).toThrow(RangeError);
  });
});

// ---- coerência ------------------------------------------------------------------------------

describe.each(BOTH)("gerador simulado · coerência (%s)", (_, ds) => {
  const campaignOf = new Map(ds.ads.map((a) => [a.externalId, a.campaignExternalId]));
  const dates = new Set(dateRange(END, 90));

  it("cobre o período pedido, todos os dias", () => {
    expect(ds.range).toEqual({ from: addDays(END, -89), to: END });
    expect(ds.accountDaily.map((r) => r.date)).toEqual(dateRange(END, 90));
    for (const table of [ds.campaignDaily, ds.adDaily, ds.breakdownDaily, ds.searchTermDaily, ds.productDaily]) {
      for (const r of table) expect(dates.has(r.date)).toBe(true);
    }
  });

  it("os anúncios somam a campanha", () => {
    const ads = groupBy(ds.adDaily, (r) => `${campaignOf.get(r.adExternalId)}|${r.date}`);
    for (const c of ds.campaignDaily) {
      const rows = ads.get(`${c.campaignExternalId}|${c.date}`) ?? [];
      expect(rows.length).toBeGreaterThan(0);
      expect(sum(rows, (r) => hundredths(r.spend))).toBe(hundredths(c.spend));
      expect(sum(rows, (r) => r.impressions)).toBe(c.impressions);
      expect(sum(rows, (r) => r.clicks)).toBe(c.clicks);
      expect(sum(rows, (r) => hundredths(r.conversions))).toBe(hundredths(c.conversions));
      expect(sum(rows, (r) => hundredths(r.conversionValue))).toBe(hundredths(c.conversionValue));
      if (c.linkClicks !== null) expect(sum(rows, (r) => r.linkClicks ?? 0)).toBe(c.linkClicks);
      if (c.videoViews !== null) expect(sum(rows, (r) => r.videoViews ?? 0)).toBe(c.videoViews);
      if (c.videoThruplays !== null) expect(sum(rows, (r) => r.videoThruplays ?? 0)).toBe(c.videoThruplays);
      // a mesma pessoa vê mais de um anúncio: o alcance da campanha é menor que a soma
      if (c.reach !== null) expect(c.reach).toBeLessThanOrEqual(sum(rows, (r) => r.reach ?? 0));
    }
  });

  it("as campanhas somam a conta (as mesmas regras do rollup do banco)", () => {
    // o alcance da conta vem do nível account (pessoas únicas), não da soma
    const noReach = <T extends { reach: number | null }>(rows: T[]) => rows.map((r) => ({ ...r, reach: null }));
    expect(noReach(rollupAccountDaily(ds.campaignDaily))).toEqual(noReach(ds.accountDaily));
    const campaigns = byDate(ds.campaignDaily);
    for (const day of ds.accountDaily) {
      const rows = campaigns.get(day.date)!;
      expect(basicTotals(rows)).toEqual(basicTotals([day]));
    }
  });

  it("o alcance da conta fica entre o maior alcance de campanha e a soma deles", () => {
    const campaigns = byDate(ds.campaignDaily);
    for (const day of ds.accountDaily) {
      const reaches = campaigns.get(day.date)!.map((r) => r.reach);
      if (ds.platform === "google") {
        expect(day.reach).toBeNull();
        continue;
      }
      const total = sum(reaches, (r) => r ?? 0);
      expect(day.reach).toBeGreaterThanOrEqual(Math.max(...reaches.map((r) => r ?? 0)));
      expect(day.reach).toBeLessThanOrEqual(total);
      if (reaches.length > 1) expect(day.reach).toBeLessThan(total);
      expect(day.reach).toBeLessThanOrEqual(day.impressions);
    }
  });

  it("cada quebra soma exatamente o total da conta no dia", () => {
    const expected = ds.platform === "meta" ? ["age_gender", "device", "placement", "region"] : ["device", "hour"];
    expect([...new Set(ds.breakdownDaily.map((r) => r.dimension))].sort()).toEqual(expected);
    const account = new Map(ds.accountDaily.map((r) => [r.date, basicTotals([r])]));
    for (const [key, rows] of groupBy(ds.breakdownDaily, (r) => `${r.date}|${r.dimension}`)) {
      expect(basicTotals(rows), key).toEqual(account.get(key.split("|")[0]));
    }
  });

  it("os produtos somam as campanhas de catálogo (Meta) ou Shopping e PMax (Google)", () => {
    const catalog = new Set(
      ds.campaigns.filter((c) => (ds.platform === "meta" ? c.name.startsWith("Catálogo") : c.channel === "shopping" || c.channel === "performance_max")).map((c) => c.externalId),
    );
    expect(catalog.size).toBeGreaterThan(0);
    const products = byDate(ds.productDaily);
    for (const [date, rows] of byDate(ds.campaignDaily.filter((r) => catalog.has(r.campaignExternalId)))) {
      expect(basicTotals(products.get(date) ?? [])).toEqual(basicTotals(rows));
    }
    expect(ds.products.length).toBeGreaterThanOrEqual(12);
    for (const p of ds.products) expect(p.price).toBeGreaterThan(0);
  });

  // Checa todas as linhas e verifica uma vez só: um expect por campo eram milhares de
  // chamadas, e com a máquina ocupada o teste passava do limite de 5 s.
  it("funil em ordem, nada negativo e conversões ≤ cliques em toda tabela", () => {
    const problems: string[] = [];
    const check = (ok: boolean, what: string, row: unknown) => {
      if (!ok) problems.push(`${what}: ${JSON.stringify(row)}`);
    };
    const funnelRows: DailyMetrics[] = [...ds.campaignDaily, ...ds.accountDaily];
    for (const r of funnelRows) {
      check(r.clicks <= r.impressions, "cliques > impressões", r);
      check(r.conversions <= r.clicks, "conversões > cliques", r);
      if (r.reach !== null) check(r.reach <= r.impressions, "alcance > impressões", r);
      if (ds.platform === "meta") {
        const steps = [r.impressions, r.clicks, r.linkClicks!, r.landingPageViews!, r.addToCart!, r.initiateCheckout!, r.conversions];
        for (let i = 1; i < steps.length; i++) check(steps[i] <= steps[i - 1], `funil fora de ordem na etapa ${i}`, r);
      } else {
        check([r.reach, r.linkClicks, r.landingPageViews, r.addToCart, r.initiateCheckout].every((v) => v === null), "coluna da Meta no Google", r);
      }
      if (r.videoThruplays !== null) check(r.videoThruplays <= r.videoViews!, "ThruPlays > visualizações", r);
      if (r.videoViews !== null) check(r.videoViews <= r.impressions, "visualizações > impressões", r);
    }
    const all: (BasicMetrics & { linkClicks?: number | null; reach?: number | null })[] = [...funnelRows, ...ds.adDaily, ...ds.breakdownDaily, ...ds.searchTermDaily, ...ds.productDaily];
    for (const r of all) {
      for (const v of [r.spend, r.impressions, r.clicks, r.conversions, r.conversionValue, r.linkClicks ?? 0, r.reach ?? 0]) check(v >= 0, "valor negativo", r);
      check(r.clicks <= r.impressions, "cliques > impressões", r);
      check(r.conversions <= r.clicks, "conversões > cliques", r);
      if (r.linkClicks != null) check(r.linkClicks <= r.clicks, "cliques no link > cliques", r);
      // valor só onde houve conversão
      if (r.conversions === 0) check(r.conversionValue === 0, "valor sem conversão", r);
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });

  it("parcela de impressões só na pesquisa, entre 0 e 1, somando 100% com as perdas", () => {
    const search = new Set(ds.campaigns.filter((c) => c.channel === "search").map((c) => c.externalId));
    for (const r of [...ds.campaignDaily, ...ds.accountDaily]) {
      const share = [r.searchImpressionShare, r.searchLostIsBudget, r.searchLostIsRank];
      const hasShare = "campaignExternalId" in r ? search.has(r.campaignExternalId as string) : search.size > 0;
      if (!hasShare) {
        expect(share).toEqual([null, null, null]);
        continue;
      }
      for (const v of share) {
        expect(v).not.toBeNull();
        expect(v!).toBeGreaterThanOrEqual(0);
        expect(v!).toBeLessThanOrEqual(1);
      }
      expect(share[0]! + share[1]! + share[2]!).toBeCloseTo(1, 4);
    }
  });

  it("valores cabem nas colunas do banco", () => {
    const twoDecimals = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
    for (const r of [...ds.campaignDaily, ...ds.accountDaily, ...ds.adDaily, ...ds.breakdownDaily, ...ds.searchTermDaily, ...ds.productDaily]) {
      expect(twoDecimals(r.spend)).toBe(true);
      expect(twoDecimals(r.conversionValue)).toBe(true);
      expect(ds.platform === "meta" ? Number.isInteger(r.conversions) : twoDecimals(r.conversions)).toBe(true);
      expect(Number.isInteger(r.impressions) && Number.isInteger(r.clicks)).toBe(true);
    }
    for (const r of ds.campaignDaily) {
      for (const v of [r.reach, r.linkClicks, r.landingPageViews, r.addToCart, r.initiateCheckout, r.videoViews, r.videoThruplays]) if (v !== null) expect(Number.isInteger(v)).toBe(true);
      for (const v of [r.searchImpressionShare, r.searchLostIsBudget, r.searchLostIsRank]) if (v !== null) expect(Math.abs(v * 1e6 - Math.round(v * 1e6))).toBeLessThan(1e-6);
    }
    for (const r of ds.breakdownDaily) expect(r.value.length >= 1 && r.value.length <= 64).toBe(true);
    for (const r of ds.searchTermDaily) expect(r.searchTerm.length >= 1 && r.searchTerm.length <= 300).toBe(true);
  });

  it("chaves únicas e referências válidas (o upsert não aceita a mesma chave duas vezes)", () => {
    const unique = (keys: string[]) => expect(new Set(keys).size).toBe(keys.length);
    unique(ds.campaigns.map((c) => c.externalId));
    unique(ds.ads.map((a) => a.externalId));
    unique(ds.products.map((p) => p.externalId));
    unique(ds.campaignDaily.map((r) => `${r.campaignExternalId}|${r.date}`));
    unique(ds.adDaily.map((r) => `${r.adExternalId}|${r.date}`));
    unique(ds.breakdownDaily.map((r) => `${r.date}|${r.dimension}|${r.value}`));
    unique(ds.searchTermDaily.map((r) => `${r.campaignExternalId}|${r.date}|${r.searchTerm}|${r.matchType}`));
    unique(ds.productDaily.map((r) => `${r.productExternalId}|${r.date}`));

    const campaigns = new Set(ds.campaigns.map((c) => c.externalId));
    const ads = new Set(ds.ads.map((a) => a.externalId));
    const products = new Set(ds.products.map((p) => p.externalId));
    for (const a of ds.ads) expect(campaigns.has(a.campaignExternalId)).toBe(true);
    for (const r of ds.campaignDaily) expect(campaigns.has(r.campaignExternalId)).toBe(true);
    for (const r of ds.adDaily) expect(ads.has(r.adExternalId)).toBe(true);
    for (const r of ds.searchTermDaily) expect(campaigns.has(r.campaignExternalId)).toBe(true);
    for (const r of ds.productDaily) expect(products.has(r.productExternalId)).toBe(true);
  });
});

describe("gerador simulado · formato por plataforma", () => {
  it("Meta: campanhas por etapa do funil, 3 a 5 criativos cada, formatos do Meta", () => {
    expect(new Set(meta.campaigns.map((c) => c.funnelStage))).toEqual(new Set(["prospecting", "retargeting", "retention"]));
    expect(meta.campaigns.every((c) => c.channel === null && c.dailyBudget! > 0)).toBe(true);
    for (const [, ads] of groupBy(meta.ads, (a) => a.campaignExternalId)) {
      expect(ads.length).toBeGreaterThanOrEqual(3);
      expect(ads.length).toBeLessThanOrEqual(5);
    }
    expect(new Set(meta.ads.map((a) => a.format))).toEqual(new Set(["image", "video", "carousel", "collection"]));
    for (const id of meta.campaigns.map((c) => c.externalId)) expect(id).toMatch(/^\d{18}$/);
    for (const a of meta.ads) expect(a.landingUrl).toMatch(/^https:\/\/loja-exemplo\.example\//);
  });

  it("Meta: quebras com idade×gênero, posicionamento, dispositivo e UF válidos", () => {
    for (const r of meta.breakdownDaily.filter((b) => b.dimension === "age_gender")) expect(parseAgeGender(r.value)).not.toBeNull();
    const regions = new Set(meta.breakdownDaily.filter((b) => b.dimension === "region").map((b) => b.value));
    expect(regions.size).toBe(27);
    expect(new Set(meta.breakdownDaily.filter((b) => b.dimension === "device").map((b) => b.value))).toEqual(new Set(["android", "iphone", "desktop", "tablet"]));
  });

  it("Google: os tipos de campanha de e-commerce, poucos anúncios e cerca de 30 termos", () => {
    expect(new Set(google.campaigns.map((c) => c.channel))).toEqual(new Set(["performance_max", "shopping", "search", "display", "video"]));
    expect(google.campaigns.filter((c) => c.channel === "search")).toHaveLength(2);
    for (const [, ads] of groupBy(google.ads, (a) => a.campaignExternalId)) expect(ads.length).toBeLessThanOrEqual(3);
    const terms = new Set(google.searchTermDaily.map((r) => r.searchTerm));
    expect(terms.size).toBeGreaterThanOrEqual(25);
    expect(terms.size).toBeLessThanOrEqual(35);
    expect(terms.has("loja exemplo")).toBe(true);
    expect(new Set(google.searchTermDaily.map((r) => r.matchType)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(google.breakdownDaily.filter((b) => b.dimension === "hour").map((b) => b.value)).size).toBe(24);
    // vídeo só no YouTube
    const video = google.campaigns.find((c) => c.channel === "video")!.externalId;
    for (const r of google.campaignDaily) expect(r.videoViews === null).toBe(r.campaignExternalId !== video);
  });

  it("os termos de pesquisa ficam dentro da campanha (o relatório do Google não mostra tudo)", () => {
    const search = new Set(google.campaigns.filter((c) => c.channel === "search").map((c) => c.externalId));
    const campaigns = new Map(google.campaignDaily.map((r) => [`${r.campaignExternalId}|${r.date}`, basicTotals([r])]));
    for (const [key, rows] of groupBy(google.searchTermDaily, (r) => `${r.campaignExternalId}|${r.date}`)) {
      expect(search.has(key.split("|")[0])).toBe(true);
      const terms = basicTotals(rows);
      const campaign = campaigns.get(key)!;
      for (const k of ["spend", "impressions", "clicks", "conversions", "value"] as const) expect(terms[k]).toBeLessThanOrEqual(campaign[k]);
      expect(terms.clicks).toBeGreaterThan(campaign.clicks * 0.75);
    }
  });
});

// ---- números realistas ----------------------------------------------------------------------

describe("gerador simulado · números realistas (30 dias, várias contas)", () => {
  it("Meta: ROAS 2–6, CTR do link 0,8–2%, CPM R$ 15–45, frequência e ticket plausíveis", () => {
    for (const ds of [meta, ...sample("meta", 6)]) {
      const t = sumMetrics(lastDays(ds.accountDaily, 30));
      expect(roas(t)).toBeGreaterThanOrEqual(2);
      expect(roas(t)).toBeLessThanOrEqual(6);
      expect(t.linkClicks! / t.impressions).toBeGreaterThanOrEqual(0.008);
      expect(t.linkClicks! / t.impressions).toBeLessThanOrEqual(0.02);
      expect((t.spend / t.impressions) * 1000).toBeGreaterThanOrEqual(15);
      expect((t.spend / t.impressions) * 1000).toBeLessThanOrEqual(45);
      expect(t.impressions / t.reach!).toBeGreaterThanOrEqual(1.05);
      expect(t.impressions / t.reach!).toBeLessThanOrEqual(2);
      expect(t.conversionValue / t.conversions).toBeGreaterThanOrEqual(120);
      expect(t.conversionValue / t.conversions).toBeLessThanOrEqual(400);
      expect(t.conversions / t.linkClicks!).toBeGreaterThanOrEqual(0.01);
      expect(t.conversions / t.linkClicks!).toBeLessThanOrEqual(0.06);
      expect(t.spend / 30).toBeGreaterThanOrEqual(800);
      expect(t.spend / 30).toBeLessThanOrEqual(6000);
    }
  });

  it("Google: ROAS 2–6, CTR de pesquisa 3–7% (marca bem mais alto), CPC e parcela plausíveis", () => {
    for (const ds of [google, ...sample("google", 6)]) {
      const t = sumMetrics(lastDays(ds.accountDaily, 30));
      expect(roas(t)).toBeGreaterThanOrEqual(2);
      expect(roas(t)).toBeLessThanOrEqual(6);
      expect(t.clicks / t.impressions).toBeGreaterThanOrEqual(0.02);
      expect(t.clicks / t.impressions).toBeLessThanOrEqual(0.07);
      expect(t.spend / t.clicks).toBeGreaterThanOrEqual(0.3);
      expect(t.spend / t.clicks).toBeLessThanOrEqual(3.5);
      expect(t.searchImpressionShare!).toBeGreaterThan(0.3);
      expect(t.searchImpressionShare!).toBeLessThan(0.9);
      for (const c of ds.campaigns.filter((x) => x.channel === "search")) {
        const s = campaignTotals(ds, c.externalId);
        const ctr = s.clicks / s.impressions;
        if (c.name.includes("Marca")) expect(ctr).toBeGreaterThanOrEqual(0.12);
        else {
          expect(ctr).toBeGreaterThanOrEqual(0.03);
          expect(ctr).toBeLessThanOrEqual(0.07);
        }
      }
    }
  });

  it("há ritmo semanal e ruído, sem dias iguais", () => {
    for (const ds of [meta, google]) {
      const days = ds.accountDaily.map((r) => `${r.spend}|${r.impressions}|${r.clicks}|${r.conversions}`);
      expect(new Set(days).size).toBe(days.length);
      const spends = ds.accountDaily.map((r) => r.spend);
      const mean = sum(spends, (v) => v) / spends.length;
      const spread = Math.sqrt(sum(spends, (v) => (v - mean) ** 2) / spends.length) / mean;
      expect(spread).toBeGreaterThan(0.03);
      expect(spread).toBeLessThan(0.25);
    }
  });
});

// ---- histórias -------------------------------------------------------------------------------

describe("gerador simulado · histórias plantadas", () => {
  it("Meta: a campanha de interesses fica abaixo do equilíbrio enquanto a conta lucra", () => {
    for (const ds of [meta, ...sample("meta", 4)]) {
      expect(roas(campaignTotals(ds, ds.stories.belowBreakEvenCampaign))).toBeLessThan(1.8);
      expect(roas(campaignTotals(ds, ds.stories.belowBreakEvenCampaign, 7))).toBeLessThan(2);
      expect(roas(sumMetrics(lastDays(ds.accountDaily, 30)))).toBeGreaterThan(2.5);
    }
  });

  it("Meta: o criativo cansado tem a frequência subindo e o CTR caindo", () => {
    for (const ds of [meta, ...sample("meta", 4)]) {
      const rows = ds.adDaily.filter((r) => r.adExternalId === ds.stories.fatiguedAd);
      const window = (from: number, to: number) => {
        const slice = rows.filter((r) => r.date > addDays(END, -from) && r.date <= addDays(END, -to));
        return { frequency: sum(slice, (r) => r.impressions) / sum(slice, (r) => r.reach ?? 0), ctr: sum(slice, (r) => r.linkClicks ?? 0) / sum(slice, (r) => r.impressions) };
      };
      const before = window(28, 21);
      const now = window(7, 0);
      expect(now.frequency).toBeGreaterThan(before.frequency * 1.2);
      expect(now.ctr).toBeLessThan(before.ctr * 0.8);

      // na última semana, é o criativo de maior frequência da conta
      const lastWeek = groupBy(lastDays(ds.adDaily, 7), (r) => r.adExternalId);
      const freq = [...lastWeek].map(([id, list]) => [id, sum(list, (r) => r.impressions) / sum(list, (r) => r.reach ?? 0)] as const);
      expect(freq.sort((a, b) => b[1] - a[1])[0][0]).toBe(ds.stories.fatiguedAd);
    }
  });

  it("Meta: criativo novo só aparece nos últimos dias e o pausado para de gastar", () => {
    const first = new Map<string, string>();
    const last = new Map<string, string>();
    for (const r of meta.adDaily) {
      if (!first.has(r.adExternalId) || r.date < first.get(r.adExternalId)!) first.set(r.adExternalId, r.date);
      if (!last.has(r.adExternalId) || r.date > last.get(r.adExternalId)!) last.set(r.adExternalId, r.date);
    }
    const novo = meta.ads.find((a) => a.name.includes("Primavera"))!;
    const pausado = meta.ads.find((a) => a.status === "paused")!;
    expect(first.get(novo.externalId)).toBe(addDays(END, -9));
    expect(pausado.name).toContain("Inverno");
    expect(last.get(pausado.externalId)).toBe(addDays(END, -22));
    // antes de entrar no ar, o criativo nem aparece
    expect(generateAccountData({ ...META, days: 30, endDate: addDays(END, -12), anchorDate: END }).ads.some((a) => a.externalId === novo.externalId)).toBe(false);
  });

  it("Google: pesquisa genérica abaixo do equilíbrio e limitada pelo orçamento; marca domina", () => {
    for (const ds of [google, ...sample("google", 4)]) {
      const generic = campaignTotals(ds, ds.stories.belowBreakEvenCampaign);
      expect(ds.stories.budgetLimitedCampaign).toBe(ds.stories.belowBreakEvenCampaign);
      expect(roas(generic)).toBeLessThan(1.8);
      expect(generic.searchLostIsBudget!).toBeGreaterThan(0.1);
      const brand = ds.campaigns.find((c) => c.name.includes("Marca"))!;
      expect(campaignTotals(ds, brand.externalId).searchImpressionShare!).toBeGreaterThan(0.8);
      expect(roas(sumMetrics(lastDays(ds.accountDaily, 30)))).toBeGreaterThan(2.5);
    }
  });

  it("Google: termos que gastam e não convertem (desperdício)", () => {
    expect(google.stories.wastefulSearchTerms.length).toBeGreaterThanOrEqual(5);
    const terms = groupBy(lastDays(google.searchTermDaily, 30), (r) => r.searchTerm);
    for (const term of google.stories.wastefulSearchTerms) {
      const rows = terms.get(term)!;
      expect(sum(rows, (r) => r.spend)).toBeGreaterThan(0);
      expect(sum(rows, (r) => r.conversions)).toBe(0);
      expect(new Set(rows.map((r) => r.campaignExternalId))).toEqual(new Set([google.stories.budgetLimitedCampaign]));
    }
  });
});
