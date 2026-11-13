import { describe, expect, it } from "vitest";
import { googleMediaRows, metaMediaRows, metaThrottle, monthRange, requestHash } from "./rows";

describe("carga do MMM: linhas da mídia tratada", () => {
  it("Meta: compras pelo omni_purchase, receita, moeda e reais", () => {
    const rows = metaMediaRows(
      [
        {
          campaign_id: "123",
          campaign_name: "Vendas",
          date_start: "2025-03-10",
          spend: "150.456",
          impressions: "10000",
          clicks: "320",
          actions: [
            { action_type: "omni_purchase", value: "4" },
            { action_type: "offsite_conversion.fb_pixel_purchase", value: "4" },
          ],
          action_values: [{ action_type: "omni_purchase", value: "880.5" }],
        },
        { date_start: "2025-03-10", spend: "1" },
      ],
      "brl",
    );
    expect(rows).toEqual([
      { campaign_external_id: "123", campaign_name: "Vendas", date: "2025-03-10", canal: "Meta Ads", moeda: "BRL", spend: 150.46, spend_brl: 150.46, impressions: 10000, clicks: 320, conversions: 4, conversion_value: 880.5 },
    ]);
  });

  it("Google: micros em moeda; conta em dólar não ganha valor em reais inventado", () => {
    const rows = googleMediaRows([{ campaign: { id: "9", name: "Pesquisa" }, segments: { date: "2025-03-02" }, metrics: { costMicros: "12500000", impressions: "800", clicks: "40", conversions: 2, conversionsValue: 300 } }], "USD");
    expect(rows[0]).toMatchObject({ campaign_external_id: "9", canal: "Google Ads", moeda: "USD", spend: 12.5, spend_brl: null, impressions: 800, clicks: 40, conversions: 2, conversion_value: 300 });
  });

  it("mês do trabalho, cota da Meta e assinatura do pedido", () => {
    expect(monthRange("2024-02-01")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange("2025-12-01")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(metaThrottle('{"app_id_util_pct": 12.5, "acc_id_util_pct": 81}')).toBe(81);
    expect(metaThrottle(null)).toBe(0);
    expect(metaThrottle("lixo")).toBe(0);
    expect(requestHash(["meta", "act_1", "2025-03-01"])).toBe(requestHash(["meta", "act_1", "2025-03-01"]));
    expect(requestHash(["meta", "act_1", "2025-03-01"])).not.toBe(requestHash(["meta", "act_1", "2025-04-01"]));
  });
});
