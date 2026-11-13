import { describe, expect, it } from "vitest";
import { mapGoogleAd, mapGoogleCampaign, mapGoogleCampaignDay, mapMetaAd, mapMetaAdDay, mapMetaCampaign, mapMetaCampaignDay, metaBudget, sumAccountDays } from "./map";

describe("Meta", () => {
  it("campanha: status, orçamento em centavos e data de início", () => {
    const c = mapMetaCampaign({ id: "120", name: "Prospecção", effective_status: "ACTIVE", objective: "OUTCOME_SALES", daily_budget: "15050", start_time: "2026-10-01T10:00:00-0300" });
    expect(c).toMatchObject({ externalId: "120", status: "active", dailyBudget: 150.5, startedOn: "2026-10-01", objective: "OUTCOME_SALES" });
    expect(metaBudget(undefined)).toBeNull();
  });

  it("dia da campanha: compras pelo omni_purchase, sem contar em dobro", () => {
    const d = mapMetaCampaignDay({
      date_start: "2026-11-01",
      campaign_id: "120",
      spend: "100.456",
      impressions: "1000",
      reach: "800",
      clicks: "30",
      actions: [
        { action_type: "omni_purchase", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "3" },
        { action_type: "link_click", value: "25" },
      ],
      action_values: [{ action_type: "omni_purchase", value: "450.1" }],
    });
    expect(d).toMatchObject({ spend: 100.46, impressions: 1000, reach: 800, clicks: 30, linkClicks: 25, conversions: 3, conversionValue: 450.1, addToCart: null });
  });

  it("dia do anúncio: métricas de vídeo pelo primeiro item", () => {
    const d = mapMetaAdDay({ date_start: "2026-11-01", ad_id: "9", spend: "10", impressions: "100", clicks: "2", video_p50_watched_actions: [{ action_type: "video_view", value: "40" }] });
    expect(d).toMatchObject({ adExternalId: "9", videoP50: 40, videoP25: null, conversions: 0 });
  });
});

describe("Google", () => {
  it("campanha: canal, orçamento em micros e orçamento compartilhado vira null", () => {
    expect(mapGoogleCampaign({ campaign: { id: "1", name: "Busca", status: "ENABLED", advertisingChannelType: "SEARCH" }, campaignBudget: { amountMicros: "50000000" } })).toMatchObject({
      channel: "search",
      dailyBudget: 50,
      status: "active",
    });
    expect(mapGoogleCampaign({ campaign: { id: "2", advertisingChannelType: "PERFORMANCE_MAX" }, campaignBudget: { amountMicros: "1", explicitlyShared: true } })?.dailyBudget).toBeNull();
  });

  it("dia da campanha: custo em micros e parcelas limitadas a 0..1", () => {
    const d = mapGoogleCampaignDay({
      campaign: { id: "1" },
      segments: { date: "2026-11-01" },
      metrics: { costMicros: "12345678", impressions: "500", clicks: "40", conversions: 2.5, conversionsValue: 300, searchImpressionShare: 0.42, topImpressionPercentage: 1.2 },
    });
    expect(d).toMatchObject({ spend: 12.35, conversions: 2.5, conversionValue: 300, reach: null, searchImpressionShare: 0.42, topImpressionPct: 1 });
  });

  it("anúncio responsivo usa o primeiro título", () => {
    const a = mapGoogleAd({ campaign: { id: "1" }, adGroupAd: { status: "PAUSED", ad: { id: "7", type: "RESPONSIVE_SEARCH_AD", finalUrls: ["https://x.com"], responsiveSearchAd: { headlines: [{ text: "Título" }] } } } });
    expect(a).toMatchObject({ name: "Título", format: "responsive", status: "paused", landingUrl: "https://x.com" });
  });
});

describe("total da conta", () => {
  it("soma as campanhas por dia e usa o alcance da conta à parte", () => {
    const base = { impressions: 10, reach: 5, clicks: 1, linkClicks: null, landingPageViews: null, addToCart: null, initiateCheckout: null, conversions: 1, conversionValue: 10, videoViews: null, videoThruplays: null, searchImpressionShare: null, searchLostIsBudget: null, searchLostIsRank: null };
    const days = sumAccountDays(
      [
        { ...base, spend: 1.1, campaignExternalId: "a", date: "2026-11-02" },
        { ...base, spend: 2.2, campaignExternalId: "b", date: "2026-11-02" },
        { ...base, spend: 3, campaignExternalId: "a", date: "2026-11-01" },
      ],
      new Map([["2026-11-02", 7]]),
    );
    expect(days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02"]);
    expect(days[1]).toMatchObject({ spend: 3.3, impressions: 20, conversions: 2, reach: 7, linkClicks: null });
    expect(days[0].reach).toBeNull();
  });
});

describe("anúncio da Meta", () => {
  it("vídeo, carrossel e imagem; a miniatura grande antes da image_url", () => {
    const video = mapMetaAd({ id: "1", campaign_id: "c", creative: { video_id: "v", object_type: "VIDEO", thumbnail_url: "https://x/thumb640.jpg" } });
    expect(video).toMatchObject({ format: "video", thumbnailUrl: "https://x/thumb640.jpg" });
    const carousel = mapMetaAd({ id: "2", campaign_id: "c", creative: { object_type: "SHARE", thumbnail_url: "https://x/t.jpg", object_story_spec: { link_data: { child_attachments: [{}, {}, {}] } } } });
    expect(carousel?.format).toBe("carousel");
    const image = mapMetaAd({ id: "3", campaign_id: "c", creative: { object_type: "SHARE", image_url: "https://x/full.jpg" } });
    expect(image).toMatchObject({ format: "image", thumbnailUrl: "https://x/full.jpg" });
    const oneCard = mapMetaAd({ id: "4", campaign_id: "c", creative: { object_type: "SHARE", object_story_spec: { link_data: { child_attachments: [{}] } } } });
    expect(oneCard?.format).toBe("image");
  });
});
