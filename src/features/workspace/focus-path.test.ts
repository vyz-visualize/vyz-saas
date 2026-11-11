import { describe, expect, it } from "vitest";
import { isFocusPath } from "./focus";

describe("isFocusPath", () => {
  it("abre em tela cheia o dashboard, a edição e a montagem", () => {
    expect(isFocusPath("/painel/dashboards/abc")).toBe(true);
    expect(isFocusPath("/painel/dashboards/abc/")).toBe(true);
    expect(isFocusPath("/painel/dashboards/abc/editar")).toBe(true);
  });
  it("mantém a lista, o novo e o resto do painel com a sidebar", () => {
    expect(isFocusPath("/painel/dashboards")).toBe(false);
    expect(isFocusPath("/painel/dashboards/novo")).toBe(false);
    expect(isFocusPath("/painel")).toBe(false);
    expect(isFocusPath("/painel/contas")).toBe(false);
    expect(isFocusPath(null)).toBe(false);
  });
});
