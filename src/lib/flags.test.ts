import { describe, expect, it } from "vitest";
import { landingPagesEnabledFor } from "./flags";

describe("flag das landing pages", () => {
  it("desligada: só quem já é do produto LP usa o módulo", () => {
    expect(landingPagesEnabledFor("dash", false)).toBe(false);
    expect(landingPagesEnabledFor("lp", false)).toBe(true);
  });
  it("ligada: todos", () => {
    expect(landingPagesEnabledFor("dash", true)).toBe(true);
    expect(landingPagesEnabledFor("lp", true)).toBe(true);
  });
});
