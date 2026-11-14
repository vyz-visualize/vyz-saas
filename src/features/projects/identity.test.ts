import { describe, expect, it } from "vitest";
import { initials, isOwnProjectLogo, normalizeProjectColor, PROJECT_COLORS, projectLogoPath, textOn } from "./identity";

const WS = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";

describe("cor do workspace", () => {
  it("aceita #rrggbb e guarda em minúsculas", () => {
    expect(normalizeProjectColor("#2563EB")).toBe("#2563eb");
    expect(normalizeProjectColor(" #2f6b4f ")).toBe("#2f6b4f");
    expect(normalizeProjectColor("2563eb")).toBeNull();
    expect(normalizeProjectColor("#fff")).toBeNull();
    expect(normalizeProjectColor("blue")).toBeNull();
  });

  it("as cores prontas são válidas, únicas e levam iniciais em branco", () => {
    expect(new Set(PROJECT_COLORS.map((c) => c.hex)).size).toBe(PROJECT_COLORS.length);
    for (const c of PROJECT_COLORS) {
      expect(normalizeProjectColor(c.hex)).toBe(c.hex);
      expect(textOn(c.hex)).toBe("#ffffff");
    }
  });

  it("texto escuro nas cores claras", () => {
    expect(textOn("#fde68a")).toBe("#161714");
    expect(textOn("#ffffff")).toBe("#161714");
    expect(textOn("#000000")).toBe("#ffffff");
  });
});

describe("logo do workspace", () => {
  it("fica na pasta do workspace, dentro da pasta da organização", () => {
    expect(projectLogoPath(WS, P, "0123456789abcdef", "png")).toBe(`${WS}/projects/${P}/logo-0123456789abcdef.png`);
  });

  it("só apaga logos gravadas pelo servidor para este workspace", () => {
    expect(isOwnProjectLogo(WS, P, `${WS}/projects/${P}/logo-0123456789abcdef.webp`)).toBe(true);
    expect(isOwnProjectLogo(WS, P, `${WS}/logo-0123456789abcdef.png`)).toBe(false);
    expect(isOwnProjectLogo(WS, P, `${WS}/projects/33333333-3333-4333-8333-333333333333/logo-0123456789abcdef.png`)).toBe(false);
    expect(isOwnProjectLogo(WS, P, `${WS}/projects/${P}/../logo-0123456789abcdef.png`)).toBe(false);
    expect(isOwnProjectLogo(WS, P, null)).toBe(false);
  });

  it("iniciais de até duas palavras", () => {
    expect(initials("Loja Aurora")).toBe("LA");
    expect(initials("Imobiliária Vista do Parque")).toBe("IV");
    expect(initials("  ")).toBe("V");
  });
});
