import { describe, expect, it } from "vitest";
import { campaignGoal, suggestObjective, type CampaignSignal } from "./objective";

const meta = (objective: string, spend: number): CampaignSignal => ({ platform: "meta", objective, channel: null, spend, conversions: 0, conversionValue: 0 });
const google = (spend: number, conversions: number, conversionValue: number, channel = "search"): CampaignSignal => ({ platform: "google", objective: null, channel, spend, conversions, conversionValue });

describe("objetivo de cada campanha", () => {
  it("Meta pelo objetivo da campanha", () => {
    expect(campaignGoal(meta("OUTCOME_SALES", 1))).toBe("sales");
    expect(campaignGoal(meta("OUTCOME_LEADS", 1))).toBe("leads");
    expect(campaignGoal(meta("MESSAGES", 1))).toBe("leads");
    expect(campaignGoal(meta("OUTCOME_AWARENESS", 1))).toBe("reach");
    expect(campaignGoal(meta("OUTCOME_TRAFFIC", 1))).toBe("reach");
    expect(campaignGoal(meta("ALGO_NOVO", 1))).toBeNull();
  });

  it("Google pelo resultado: valor é venda; conversão sem valor é lead; display e vídeo sem conversão é alcance", () => {
    expect(campaignGoal(google(100, 5, 800))).toBe("sales");
    expect(campaignGoal(google(100, 5, 0))).toBe("leads");
    expect(campaignGoal(google(100, 0, 0, "video"))).toBe("reach");
    expect(campaignGoal(google(100, 0, 0, "search"))).toBeNull();
  });
});

describe("modelo sugerido", () => {
  it("vence o objetivo com mais investimento nos últimos 30 dias, com uma linha do porquê", () => {
    const s = suggestObjective([meta("OUTCOME_LEADS", 800), meta("OUTCOME_SALES", 200)], "ecommerce");
    expect(s).toEqual({ objective: "leads", source: "campaigns", reason: "Sugerido porque 80% do investimento dos últimos 30 dias está em campanhas de leads." });
    expect(suggestObjective([google(900, 10, 5000), meta("OUTCOME_LEADS", 100)], "leads").objective).toBe("ecommerce");
  });

  it("um segmento que já é de venda ou de lead fica com o modelo dele", () => {
    expect(suggestObjective([meta("OUTCOME_LEADS", 500)], "imobiliario").objective).toBe("imob");
    expect(suggestObjective([meta("OUTCOME_SALES", 500)], "infoproduto").objective).toBe("infoproduto");
  });

  it("alcance não tem modelo: fica o do segmento, e a explicação diz isso", () => {
    const s = suggestObjective([meta("OUTCOME_AWARENESS", 900), meta("OUTCOME_SALES", 100)], "local");
    expect(s.objective).toBe("local");
    expect(s.reason).toBe("Não temos um modelo de alcance; usamos o do seu segmento (90% do investimento dos últimos 30 dias está em alcance).");
  });

  it("sem dados ainda (importação rodando), o segmento do passo 1", () => {
    expect(suggestObjective([], "leads")).toMatchObject({ objective: "leads", source: "segment" });
    expect(suggestObjective([meta("OUTCOME_SALES", 0)], null)).toMatchObject({ objective: "ecommerce", source: "segment" });
  });
});
