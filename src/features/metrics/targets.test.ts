import { describe, expect, it } from "vitest";
import { breakEvenOf, hasBudget, hasGoal, hasMargin } from "./targets";

describe("verba, alvo e margem não definidos", () => {
  it("zero, NaN e infinito contam como não definidos (o card mostra o convite)", () => {
    expect(hasBudget({ budget: { monthly: 0, spent: 100, day: 3, daysInMonth: 30 } })).toBe(false);
    expect(hasBudget({ budget: { monthly: Number.NaN, spent: 0, day: 1, daysInMonth: 30 } })).toBe(false);
    expect(hasBudget({ budget: { monthly: 5000, spent: 100, day: 3, daysInMonth: 30 } })).toBe(true);
    expect(hasGoal({ goal: 0 })).toBe(false);
    expect(hasGoal({ goal: 5500 })).toBe(true);
  });

  it("sem margem, o equilíbrio é ROAS 1 (a regra do produto), nunca 0", () => {
    expect(breakEvenOf({ breakEven: 0 })).toBe(1);
    expect(breakEvenOf({ breakEven: Number.NaN })).toBe(1);
    expect(breakEvenOf({ breakEven: 2.5 })).toBe(2.5);
    expect(hasMargin({ marginSet: false })).toBe(false);
    // amostra: sem o campo, a margem existe
    expect(hasMargin({})).toBe(true);
  });
});
