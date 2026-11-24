import { describe, expect, it } from "vitest";
import { breakdownLabel, parseAgeGender } from "./breakdowns";
import type { CampaignDay, DailyMetrics } from "./dataset";
import { generateAccountData } from "./mock-generator";
import { rollupAccountDaily, sumMetrics } from "./rollup";
import { accountDailyRows, accountReachRows, adRows, campaignRows, FACT_KEYS, FACT_TABLES, factRows, idLookup, productRows } from "./rows";

const ds = generateAccountData({ platform: "google", accountExternalId: "123-456-7890", accountName: "Loja Exemplo · Brasil", endDate: "2026-10-28", days: 7 });
const scope = { workspaceId: "ws-1", adAccountId: "acc-1", syncedAt: "2026-10-29T10:00:00.000Z" };
const uuid = (externalId: string) => `id:${externalId}`;
const ids = { campaign: uuid, ad: uuid, product: uuid };

const zero: DailyMetrics = {
  leads: null,
  messages: null,
  spend: 0,
  impressions: 0,
  reach: null,
  clicks: 0,
  linkClicks: null,
  landingPageViews: null,
  addToCart: null,
  initiateCheckout: null,
  conversions: 0,
  conversionValue: 0,
  videoViews: null,
  videoThruplays: null,
  searchImpressionShare: null,
  searchLostIsBudget: null,
  searchLostIsRank: null,
};

describe("soma diária (as regras do rollup do banco)", () => {
  it("soma em centésimos, sem erro de ponto flutuante", () => {
    const total = sumMetrics([
      { ...zero, spend: 0.1, conversionValue: 0.7, conversions: 0.35 },
      { ...zero, spend: 0.2, conversionValue: 0.1, conversions: 0.35 },
    ]);
    expect(total.spend).toBe(0.3);
    expect(total.conversionValue).toBe(0.8);
    expect(total.conversions).toBe(0.7);
  });

  it("coluna só com null continua null; com algum valor, soma os que existem", () => {
    expect(sumMetrics([zero, zero]).reach).toBeNull();
    expect(sumMetrics([zero, { ...zero, reach: 40 }, { ...zero, reach: 2 }]).reach).toBe(42);
  });

  it("parcela de impressões ponderada pelas impressões das linhas que têm o dado", () => {
    const total = sumMetrics([
      { ...zero, impressions: 1000, searchImpressionShare: 0.9, searchLostIsBudget: 0, searchLostIsRank: 0.1 },
      { ...zero, impressions: 3000, searchImpressionShare: 0.5, searchLostIsBudget: 0.2, searchLostIsRank: 0.3 },
      { ...zero, impressions: 50_000 },
    ]);
    expect(total.searchImpressionShare).toBeCloseTo(0.6, 6);
    expect(total.searchLostIsBudget).toBeCloseTo(0.15, 6);
    expect(total.searchLostIsRank).toBeCloseTo(0.25, 6);
    expect(sumMetrics([{ ...zero, impressions: 0, searchImpressionShare: 0.5 }]).searchImpressionShare).toBeNull();
  });

  it("agrupa por dia, em ordem", () => {
    const rows: CampaignDay[] = [
      { ...zero, campaignExternalId: "b", date: "2026-10-02", spend: 2, impressions: 20, clicks: 2 },
      { ...zero, campaignExternalId: "a", date: "2026-10-01", spend: 1, impressions: 10, clicks: 1 },
      { ...zero, campaignExternalId: "a", date: "2026-10-02", spend: 3, impressions: 30, clicks: 3 },
    ];
    expect(rollupAccountDaily(rows).map((r) => [r.date, r.spend, r.impressions])).toEqual([
      ["2026-10-01", 1, 10],
      ["2026-10-02", 5, 50],
    ]);
  });
});

describe("linhas do armazém", () => {
  it("entidades com workspace, conta e ids externos", () => {
    const campaigns = campaignRows(ds, scope);
    expect(campaigns).toHaveLength(ds.campaigns.length);
    expect(campaigns[0]).toMatchObject({ workspace_id: "ws-1", ad_account_id: "acc-1", external_id: ds.campaigns[0].externalId, channel: "performance_max" });
    const ads = adRows(ds, scope, uuid);
    expect(ads.every((a) => a.campaign_id.startsWith("id:"))).toBe(true);
    expect(productRows(ds, scope)[0]).toMatchObject({ external_id: ds.products[0].externalId, title: ds.products[0].title, price: ds.products[0].price });
  });

  it("fatos com as colunas do banco e a chave primária completa", () => {
    const facts = factRows(ds, scope, ids);
    expect(Object.keys(facts).sort()).toEqual([...FACT_TABLES].sort());
    expect(facts.insights_campaign_daily).toHaveLength(ds.campaignDaily.length);
    expect(facts.insights_search_term_daily).toHaveLength(ds.searchTermDaily.length);
    const first = facts.insights_campaign_daily[0];
    expect(first).toMatchObject({ workspace_id: "ws-1", ad_account_id: "acc-1", synced_at: scope.syncedAt, campaign_id: uuid(ds.campaignDaily[0].campaignExternalId), date: ds.campaignDaily[0].date });
    expect(first.conversion_value).toBe(ds.campaignDaily[0].conversionValue);
    for (const table of FACT_TABLES) {
      for (const row of facts[table]) for (const key of FACT_KEYS[table]) expect(row[key as keyof typeof row], `${table}.${key}`).toBeDefined();
    }
  });

  it("chave repetida no lote fica uma só (a última)", () => {
    const twice = { ...ds, productDaily: [...ds.productDaily, { ...ds.productDaily[0], clicks: 999_999 }] };
    const rows = factRows(twice, scope, ids).insights_product_daily;
    expect(rows).toHaveLength(ds.productDaily.length);
    expect(rows.find((r) => r.product_id === uuid(ds.productDaily[0].productExternalId) && r.date === ds.productDaily[0].date)?.clicks).toBe(999_999);
  });

  it("linhas da conta por dia para as prévias", () => {
    const rows = accountDailyRows(ds, scope);
    expect(rows.map((r) => r.date)).toEqual(ds.accountDaily.map((r) => r.date));
    expect(rows[0].search_impression_share).toBe(ds.accountDaily[0].searchImpressionShare);
  });

  it("alcance da conta só nos dias em que a fonte trouxe o número", () => {
    const meta = generateAccountData({ platform: "meta", accountExternalId: "act_1", accountName: "Loja", endDate: "2026-10-28", days: 7 });
    const rows = accountReachRows(meta, scope);
    expect(rows.map((r) => [r.date, r.reach])).toEqual(meta.accountDaily.map((r) => [r.date, r.reach]));
    expect(Object.keys(rows[0]).sort()).toEqual(["ad_account_id", "date", "reach", "synced_at", "workspace_id"]);
    const google = generateAccountData({ platform: "google", accountExternalId: "123-456-7890", accountName: "Loja", endDate: "2026-10-28", days: 7 });
    expect(accountReachRows(google, scope)).toEqual([]);
  });

  it("busca de ids avisa quando a entidade não foi gravada", () => {
    const lookup = idLookup("Campanha", [{ id: "u1", external_id: "c1" }]);
    expect(lookup("c1")).toBe("u1");
    expect(() => lookup("c2")).toThrow("Campanha c2");
  });
});

describe("rótulos das quebras", () => {
  it("traduz as chaves para a tela", () => {
    expect(breakdownLabel("age_gender", "25-34|female")).toBe("25-34 · Mulheres");
    expect(breakdownLabel("placement", "instagram_reels")).toBe("Reels do Instagram");
    expect(breakdownLabel("device", "iphone")).toBe("iPhone");
    expect(breakdownLabel("region", "SP")).toBe("São Paulo");
    expect(breakdownLabel("hour", "07")).toBe("7h");
    expect(breakdownLabel("age", "65+")).toBe("65 ou mais");
    expect(breakdownLabel("placement", "algo_novo")).toBe("algo_novo");
    expect(parseAgeGender("25-34|robot")).toBeNull();
  });
});
