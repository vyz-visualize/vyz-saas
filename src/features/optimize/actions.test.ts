import { describe, expect, it } from "vitest";
import { budgetChange, checkAutopilot, cleanRules, DEFAULT_AUTOPILOT, describeAction, inverseAction, parseAction, proposeAction, type CampaignFacts } from "./actions";

const camp = (p: Partial<CampaignFacts> = {}): CampaignFacts => ({
  id: "c1",
  name: "Remarketing",
  status: "active",
  dailyBudget: 100,
  startedOn: "2026-10-01",
  currency: "BRL",
  platform: "meta",
  ...p,
});
const on = { ...DEFAULT_AUTOPILOT, enabled: true };

describe("proposeAction", () => {
  it("pausa campanha que gastou sem converter", () => {
    expect(proposeAction("zero:c1", camp())).toMatchObject({
      kind: "pause",
      from: "active",
      to: "paused",
    });
  });
  it("reduz 20% abaixo do equilíbrio e aumenta 20% na melhor", () => {
    expect(proposeAction("be:c1", camp())).toMatchObject({
      kind: "budget",
      from: 100,
      to: 80,
    });
    expect(proposeAction("best:c1", camp())).toMatchObject({
      kind: "budget",
      from: 100,
      to: 120,
    });
  });
  it("não propõe nada sem orçamento, em campanha pausada, em plataforma sem escrita ou em análise sem ação", () => {
    expect(proposeAction("be:c1", camp({ dailyBudget: null }))).toBeNull();
    expect(proposeAction("zero:c1", camp({ status: "paused" }))).toBeNull();
    expect(proposeAction("zero:c1", camp({ platform: "linkedin" }))).toBeNull();
    expect(proposeAction("fatigue:x", camp())).toBeNull();
    expect(proposeAction("zero:c1", null)).toBeNull();
  });
});

describe("descrição e desfazer", () => {
  it("mostra o de → para", () => {
    expect(describeAction(proposeAction("be:c1", camp())!)).toMatch(/de R\$\s?100,00 para R\$\s?80,00/);
    expect(describeAction(proposeAction("zero:c1", camp())!)).toBe("Pausar a campanha Remarketing");
  });
  it("inverte a ação", () => {
    const b = inverseAction(proposeAction("be:c1", camp())!);
    expect([b.from, b.to]).toEqual([80, 100]);
    const p = inverseAction(proposeAction("zero:c1", camp())!);
    expect([p.from, p.to]).toEqual(["paused", "active"]);
    expect(describeAction(p)).toBe("Reativar a campanha Remarketing");
    expect(parseAction(p)).not.toBeNull();
  });
  it("lê só ação válida", () => {
    expect(
      parseAction({
        kind: "budget",
        platform: "meta",
        campaignId: "c",
        campaignName: "n",
        currency: "BRL",
        from: 0,
        to: 1,
      }),
    ).toBeNull();
    expect(parseAction({ kind: "delete" })).toBeNull();
    expect(parseAction(null)).toBeNull();
  });
});

describe("checkAutopilot", () => {
  const ctx = { changedToday: 0, daysRunning: 30 };
  it("respeita ligado, idade mínima e pausa", () => {
    const pause = proposeAction("zero:c1", camp())!;
    expect(checkAutopilot(pause, DEFAULT_AUTOPILOT, ctx).ok).toBe(false);
    expect(checkAutopilot(pause, on, { ...ctx, daysRunning: 3 }).ok).toBe(false);
    expect(checkAutopilot(pause, on, { ...ctx, daysRunning: null }).ok).toBe(false);
    expect(checkAutopilot(pause, on, ctx).ok).toBe(true);
    expect(checkAutopilot(pause, { ...on, allowPause: false }, ctx).ok).toBe(false);
  });
  it("nunca reativa", () => {
    expect(checkAutopilot(inverseAction(proposeAction("zero:c1", camp())!), on, ctx).ok).toBe(false);
  });
  it("não aumenta orçamento sem permissão", () => {
    expect(checkAutopilot(proposeAction("best:c1", camp())!, on, ctx).ok).toBe(false);
    expect(checkAutopilot(proposeAction("best:c1", camp())!, { ...on, allowIncrease: true }, ctx).ok).toBe(true);
  });
  it("limita a variação do dia", () => {
    const cut = proposeAction("be:c1", camp())!;
    const r = checkAutopilot(cut, { ...on, maxBudgetChangePct: 10 }, ctx);
    expect(r.ok && r.action.to).toBe(90);
    const half = checkAutopilot(cut, on, { ...ctx, changedToday: -0.15 });
    expect(half.ok && budgetChange(half.action)).toBeCloseTo(-0.05);
    expect(checkAutopilot(cut, on, { ...ctx, changedToday: -0.2 }).ok).toBe(false);
  });
});

describe("cleanRules", () => {
  it("prende os limites", () => {
    expect(cleanRules({ maxBudgetChangePct: 99, minCampaignAgeDays: 0 })).toMatchObject({
      maxBudgetChangePct: 50,
      minCampaignAgeDays: 3,
      enabled: false,
    });
  });
});
