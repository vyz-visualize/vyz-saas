import { describe, expect, it } from "vitest";
import { annualTotal, planMonthly } from "@/features/pricing/pricing";
import { addMonths, planChangeBlocker, planSelection, quotePlanChange, samePlan } from "./plan-change";

const start = new Date("2026-10-01T00:00:00Z");
const monthEnd = new Date("2026-11-01T00:00:00Z");
const half = new Date(start.getTime() + (monthEnd.getTime() - start.getTime()) / 2);

describe("troca de plano no mesmo período", () => {
  it("upgrade na metade do mês cobra metade da diferença", () => {
    const q = quotePlanChange({
      current: { tier: "base", period: "mensal", accounts: 2, periodStart: start, periodEnd: monthEnd },
      next: { tier: "pro", period: "mensal", accounts: 2 },
      extrasMonthlyCents: 0,
      now: half,
    });
    const diff = planMonthly("pro", "mensal") - planMonthly("base", "mensal");
    expect(q.prorationCents).toBe(Math.round(diff / 2));
    expect(q.creditCents).toBe(0);
    expect(q.resetsPeriod).toBe(false);
    expect(q.periodEnd).toEqual(monthEnd);
    expect(q.recurringCents).toBe(planMonthly("pro", "mensal"));
  });

  it("plano menor vira crédito, sem cobrança", () => {
    const q = quotePlanChange({
      current: { ...planSelection("pro", "mensal"), periodStart: start, periodEnd: monthEnd },
      next: planSelection("base", "mensal"),
      extrasMonthlyCents: 0,
      now: half,
    });
    expect(q.prorationCents).toBe(0);
    expect(q.creditCents).toBe(Math.round((14990 - 4990) / 2));
  });

  it("a seleção do plano traz os projetos fixos", () => {
    expect(planSelection("base", "anual").accounts).toBe(3);
    expect(planSelection("pro", "anual").accounts).toBe(5);
    expect(planSelection("avancado", "mensal").accounts).toBe(200);
  });

  it("os extras mensais entram na recorrência, não na diferença", () => {
    const base = {
      current: { tier: "base" as const, period: "mensal" as const, accounts: 1, periodStart: start, periodEnd: monthEnd },
      next: { tier: "pro" as const, period: "mensal" as const, accounts: 1 },
      now: start,
    };
    const without = quotePlanChange({ ...base, extrasMonthlyCents: 0 });
    const withExtras = quotePlanChange({ ...base, extrasMonthlyCents: 9900 });
    expect(withExtras.prorationCents).toBe(without.prorationCents);
    expect(withExtras.recurringCents).toBe(without.recurringCents + 9900);
  });

  it("depois do fim do ciclo não há o que ajustar", () => {
    const q = quotePlanChange({
      current: { tier: "base", period: "mensal", accounts: 1, periodStart: start, periodEnd: monthEnd },
      next: { tier: "avancado", period: "mensal", accounts: 1 },
      extrasMonthlyCents: 0,
      now: new Date("2026-11-15T00:00:00Z"),
    });
    expect(q.prorationCents).toBe(0);
  });
});

describe("troca de período", () => {
  it("mensal para anual recomeça o ciclo e desconta a sobra do mês", () => {
    const q = quotePlanChange({
      current: { tier: "pro", period: "mensal", accounts: 2, periodStart: start, periodEnd: monthEnd },
      next: { tier: "pro", period: "anual", accounts: 2 },
      extrasMonthlyCents: 0,
      now: half,
    });
    // o anual cobra o total exato do ano (R$ 1.499,90), não o por mês × 12
    const yearly = annualTotal("pro");
    expect(yearly).toBe(149990);
    expect(q.resetsPeriod).toBe(true);
    expect(q.recurringCents).toBe(yearly);
    expect(q.prorationCents).toBe(yearly - Math.round(planMonthly("pro", "mensal") / 2));
    expect(q.periodStart).toEqual(half);
    expect(q.periodEnd).toEqual(addMonths(half, 12));
  });

  it("anual para mensal no começo do ano vira crédito", () => {
    const yearEnd = new Date("2027-10-01T00:00:00Z");
    const q = quotePlanChange({
      current: { tier: "pro", period: "anual", accounts: 2, periodStart: start, periodEnd: yearEnd },
      next: { tier: "pro", period: "mensal", accounts: 2 },
      extrasMonthlyCents: 0,
      now: start,
    });
    expect(q.prorationCents).toBe(0);
    expect(q.creditCents).toBe(annualTotal("pro") - planMonthly("pro", "mensal"));
    expect(q.periodEnd).toEqual(monthEnd);
  });
});

describe("datas", () => {
  it("soma meses como o Postgres", () => {
    expect(addMonths(new Date("2026-01-31T12:00:00Z"), 1).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T12:00:00Z"), 1).toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(addMonths(new Date("2026-10-29T10:00:00Z"), 12).toISOString()).toBe("2027-10-29T10:00:00.000Z");
  });

  it("mesmo plano", () => {
    expect(samePlan({ tier: "pro", period: "anual", accounts: 2 }, { tier: "pro", period: "anual", accounts: 2 })).toBe(true);
    expect(samePlan({ tier: "pro", period: "anual", accounts: 2 }, { tier: "pro", period: "anual", accounts: 3 })).toBe(false);
  });
});

describe("uso atual no plano novo", () => {
  const usage = { projects: 2, dashboards: 2, publishedLandingPages: 1, enabledPlatforms: ["meta", "google"] };

  it("cabe: nenhum bloqueio", () => {
    expect(planChangeBlocker({ tier: "base", period: "mensal", accounts: 2 }, usage)).toBeNull();
  });

  it("menos projetos do que os ativos", () => {
    expect(planChangeBlocker({ tier: "pro", period: "anual", accounts: 1 }, usage)).toEqual({
      code: "limit:projects_in_use",
      message: "Você tem 2 workspaces ativos. O Padrão vai até 1. Arquive workspaces em Workspaces antes de trocar.",
    });
  });

  it("dashboards e LPs publicadas acima do plano novo", () => {
    expect(planChangeBlocker({ tier: "base", period: "anual", accounts: 2 }, { ...usage, dashboards: 5 })?.code).toBe("limit:dashboards_in_use");
    expect(planChangeBlocker({ tier: "base", period: "anual", accounts: 2 }, { ...usage, publishedLandingPages: 2 })?.message).toBe(
      "O Básico permite até 1 landing page publicada e você tem 2. Despublique antes de trocar.",
    );
  });

  it("dashboards: o Básico vai até 3, o Padrão até 10 e o Avançado até 40", () => {
    expect(planChangeBlocker({ tier: "base", period: "anual", accounts: 3 }, { ...usage, dashboards: 3 })).toBeNull();
    expect(planChangeBlocker({ tier: "base", period: "anual", accounts: 3 }, { ...usage, dashboards: 4 })?.message).toBe("O Básico permite até 3 dashboards e você tem 4. Apague alguns antes de trocar.");
    expect(planChangeBlocker({ tier: "pro", period: "anual", accounts: 5 }, { ...usage, dashboards: 11 })?.code).toBe("limit:dashboards_in_use");
    expect(planChangeBlocker({ tier: "avancado", period: "anual", accounts: 200 }, { ...usage, dashboards: 40 })).toBeNull();
    expect(planChangeBlocker({ tier: "avancado", period: "anual", accounts: 200 }, { ...usage, dashboards: 41 })?.code).toBe("limit:dashboards_in_use");
  });

  it("equipe com mais de 1 pessoa não desce para o Básico", () => {
    expect(planChangeBlocker({ tier: "base", period: "mensal", accounts: 3 }, { ...usage, members: 1 })).toBeNull();
    expect(planChangeBlocker({ tier: "base", period: "mensal", accounts: 3 }, { ...usage, members: 3 })).toEqual({
      code: "limit:members_in_use",
      message: "O Básico permite 1 usuário e a equipe tem 3 pessoas (convites pendentes contam). Remova pessoas ou cancele convites antes de trocar.",
    });
  });

  it("usuários ilimitados: Padrão e Avançado nunca bloqueiam pela equipe nem mostram o número interno", () => {
    for (const tier of ["pro", "avancado"] as const) {
      expect(planChangeBlocker({ tier, period: "anual", accounts: tier === "pro" ? 5 : 200 }, { ...usage, members: 5000 })).toBeNull();
    }
  });

  it("plataforma nunca bloqueia a troca: todas valem em todos os planos", () => {
    const tiktok = { ...usage, enabledPlatforms: ["meta", "tiktok", "linkedin", "hubspot", "x"] };
    expect(planChangeBlocker({ tier: "base", period: "anual", accounts: 2 }, tiktok)).toBeNull();
    expect(planChangeBlocker({ tier: "pro", period: "anual", accounts: 2 }, tiktok)).toBeNull();
  });
});
