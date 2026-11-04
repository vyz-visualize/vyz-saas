import { describe, expect, it } from "vitest";
import { fitItems } from "./fit-items";

describe("o que cabe na linha", () => {
  it("cabe tudo: sem menu", () => {
    expect(fitItems([100, 100, 100], 316, 60, { gap: 8 })).toEqual([0, 1, 2]);
  });

  it("não cabe: sai do fim e reserva o lugar do menu", () => {
    expect(fitItems([100, 100, 100], 315, 60, { gap: 8 })).toEqual([0, 1]);
    expect(fitItems([100, 100, 100], 200, 60, { gap: 8 })).toEqual([0]);
  });

  it("menu sempre presente reserva o lugar mesmo cabendo tudo", () => {
    expect(fitItems([100, 100, 100], 316, 40, { gap: 8, always: true })).toEqual([0, 1]);
    expect(fitItems([100, 100, 100], 364, 40, { gap: 8, always: true })).toEqual([0, 1, 2]);
  });

  it("a aba aberta nunca vai para o menu e mantém a ordem", () => {
    expect(fitItems([100, 100, 100, 100], 300, 60, { gap: 8, pinned: 3 })).toEqual([0, 3]);
    expect(fitItems([100, 100, 100, 100], 50, 60, { gap: 8, pinned: 2 })).toEqual([2]);
  });

  it("sem espaço nenhum, nada aparece fora do menu", () => {
    expect(fitItems([100, 100], 20, 40, { gap: 8, always: true })).toEqual([]);
  });
});
