import { describe, expect, it } from "vitest";
import { linkedinDate, mapLinkedInCampaign, mapLinkedInCampaignDay, mapLinkedInCreative, mapLinkedInCreativeDay, mapTikTokAd, mapTikTokAdDay, mapTikTokCampaign, mapTikTokCampaignDay, urnId, windows } from "./ads-map";

describe("TikTok", () => {
  it("campanha: status, orçamento diário e início", () => {
    const c = mapTikTokCampaign({ campaign_id: 123, campaign_name: "Vendas", operation_status: "ENABLE", objective_type: "WEB_CONVERSIONS", budget: "150.5", budget_mode: "BUDGET_MODE_DAY", create_time: "2026-10-02 10:00:00" });
    expect(c).toMatchObject({ externalId: "123", status: "active", dailyBudget: 150.5, startedOn: "2026-10-02", objective: "WEB_CONVERSIONS" });
    expect(mapTikTokCampaign({ campaign_id: 1, operation_status: "DISABLE", budget: 100, budget_mode: "BUDGET_MODE_TOTAL" })).toMatchObject({ status: "paused", dailyBudget: null });
    expect(mapTikTokCampaign({ campaign_id: 2, secondary_status: "CAMPAIGN_STATUS_DELETE" }).status).toBe("removed");
  });

  it("anúncio: formato e capa do vídeo", () => {
    const ad = mapTikTokAd({ ad_id: "9", campaign_id: "123", ad_format: "SINGLE_VIDEO", video_id: "v1", ad_text: "Compre já", landing_page_url: "https://x.com" }, new Map([["v1", "https://cdn/capa.jpg"]]));
    expect(ad).toMatchObject({ externalId: "9", campaignExternalId: "123", format: "video", thumbnailUrl: "https://cdn/capa.jpg", body: "Compre já" });
  });

  it("relatório diário: data, compras e valor", () => {
    const d = mapTikTokCampaignDay({
      dimensions: { campaign_id: 123, stat_time_day: "2026-11-01 00:00:00" },
      metrics: { spend: "10.555", impressions: "1000", clicks: "20", reach: "800", conversion: "3", complete_payment: "2", total_complete_payment_rate: "300.1", video_play_actions: "50", video_views_p100: "5" },
    });
    expect(d).toMatchObject({ campaignExternalId: "123", date: "2026-11-01", spend: 10.56, impressions: 1000, clicks: 20, reach: 800, conversions: 2, conversionValue: 300.1, videoViews: 50, videoThruplays: 5 });
  });

  it("sem compra usa as conversões; dia vazio some", () => {
    expect(mapTikTokCampaignDay({ dimensions: { campaign_id: 1, stat_time_day: "2026-11-01 00:00:00" }, metrics: { spend: "5", conversion: "4", complete_payment: "0" } })?.conversions).toBe(4);
    expect(mapTikTokCampaignDay({ dimensions: { campaign_id: 1, stat_time_day: "2026-11-01 00:00:00" }, metrics: { spend: "0", impressions: "0" } })).toBeNull();
    expect(mapTikTokAdDay({ dimensions: { ad_id: 7, stat_time_day: "2026-11-02 00:00:00" }, metrics: { spend: "1", impressions: "10", likes: "3", video_views_p25: "4" } })).toMatchObject({ adExternalId: "7", postReactions: 3, videoP25: 4 });
  });
});

describe("LinkedIn", () => {
  it("URN e data", () => {
    expect(urnId("urn:li:sponsoredCampaign:456")).toBe("456");
    expect(linkedinDate({ year: 2026, month: 3, day: 7 })).toBe("2026-03-07");
  });

  it("campanha e criativo", () => {
    expect(mapLinkedInCampaign({ id: 456, name: "Leads", status: "ACTIVE", objectiveType: "LEAD_GENERATION", dailyBudget: { amount: "80" }, runSchedule: { start: Date.UTC(2026, 9, 1) } })).toMatchObject({ externalId: "456", status: "active", dailyBudget: 80, startedOn: "2026-10-01" });
    expect(mapLinkedInCampaign({ id: 1, status: "COMPLETED" }).status).toBe("archived");
    expect(mapLinkedInCreative({ id: "urn:li:sponsoredCreative:9", campaign: "urn:li:sponsoredCampaign:456", intendedStatus: "PAUSED", content: { reference: "urn:li:video:1" } })).toMatchObject({ externalId: "9", campaignExternalId: "456", status: "paused", format: "video" });
    expect(mapLinkedInCreative({ id: "urn:li:sponsoredCreative:9" })).toBeNull();
  });

  it("analytics: leads somam com conversões do site", () => {
    const row = { dateRange: { start: { year: 2026, month: 11, day: 1 } }, pivotValues: ["urn:li:sponsoredCampaign:456"], costInLocalCurrency: "42.129", impressions: 900, clicks: 12, landingPageClicks: 9, externalWebsiteConversions: 2, oneClickLeads: 3, conversionValueInLocalCurrency: "0" };
    expect(mapLinkedInCampaignDay(row)).toMatchObject({ campaignExternalId: "456", date: "2026-11-01", spend: 42.13, conversions: 5, linkClicks: 9 });
    expect(mapLinkedInCreativeDay({ ...row, pivotValues: ["urn:li:sponsoredCreative:9"], likes: 4 })).toMatchObject({ adExternalId: "9", leads: 3, postReactions: 4 });
    expect(mapLinkedInCampaignDay({ ...row, costInLocalCurrency: 0, impressions: 0, clicks: 0, externalWebsiteConversions: 0, oneClickLeads: 0 })).toBeNull();
  });
});

describe("janelas", () => {
  it("corta em blocos de 30 dias, inclusive", () => {
    const w = windows("2026-08-01", "2026-10-29", 30);
    expect(w).toEqual([
      { from: "2026-08-01", to: "2026-08-30" },
      { from: "2026-08-31", to: "2026-09-29" },
      { from: "2026-09-30", to: "2026-10-29" },
    ]);
    expect(windows("2026-11-01", "2026-11-01", 30)).toEqual([{ from: "2026-11-01", to: "2026-11-01" }]);
  });
});
