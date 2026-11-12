import { describe, expect, it } from "vitest";
import { SAMPLE_NOTICE, showsSampleData } from "./sample-gate";

describe("dados de exemplo nunca saem sem aviso", () => {
  it("modelo sem conta ativa ligada mostra a amostra (e o compartilhar fica bloqueado)", () => {
    expect(showsSampleData({ live: false, sources: [] })).toBe(true);
    expect(showsSampleData({ live: false, sources: [{ isEnabled: false }] })).toBe(true);
    expect(showsSampleData({ live: false, sources: [{ isEnabled: false }, { isEnabled: true }] })).toBe(false);
  });

  it('dashboard "live" nunca usa amostra (sem conta, mostra o estado vazio)', () => {
    expect(showsSampleData({ live: true, sources: [] })).toBe(false);
  });

  it("o texto do aviso é o pedido", () => {
    expect(SAMPLE_NOTICE).toBe("Dados de exemplo — conecte o Meta Ads ou o Google Ads para ver os números reais");
  });
});
