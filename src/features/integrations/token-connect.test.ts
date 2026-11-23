import { describe, expect, it } from "vitest";
import { PROVIDER_IDS } from "./providers";
import { cleanToken, isTokenConnection, META_TOKEN_PERMISSIONS, metaTokenProblem, TOKEN_GUIDES, TOKEN_SCOPE, tokenGuide } from "./token-connect";

describe("conexão por token", () => {
  it("limpa o que vem colado junto com o token", () => {
    expect(cleanToken('  "Bearer EAAabc\n123"  ')).toBe("EAAabc123");
    expect(cleanToken("bearer EAAx")).toBe("EAAx");
  });

  it("confere o formato do token do Meta antes de chamar a API", () => {
    expect(metaTokenProblem("")).toMatch(/Cole o token/);
    expect(metaTokenProblem("abc")).toMatch(/EAA/);
    expect(metaTokenProblem("EAA-com-traco".padEnd(80, "x"))).toMatch(/EAA/);
    expect(metaTokenProblem("EAAcurto")).toMatch(/incompleto/);
    expect(metaTokenProblem(`EAA${"a1".repeat(60)}`)).toBeNull();
  });

  it("a marca de token nos escopos", () => {
    expect(isTokenConnection(["ads_read", TOKEN_SCOPE])).toBe(true);
    expect(isTokenConnection(["ads_read"])).toBe(false);
    expect(isTokenConnection(null)).toBe(false);
  });

  it("o tutorial do Meta pede as permissões que o VYZ lê e diz como cortar o acesso", () => {
    const meta = tokenGuide("meta");
    expect(meta).not.toBeNull();
    const items = meta!.steps.flatMap((s) => s.items ?? []);
    for (const p of META_TOKEN_PERMISSIONS.required) expect(items).toContain(p);
    expect(items.some((i) => i.startsWith("ads_management"))).toBe(true);
    expect(meta!.fields.map((f) => f.name)).toEqual(["token"]);
    expect(meta!.notes.join(" ")).toMatch(/desconecte/);
  });

  it("tutoriais só de provedores que existem, com texto sem travessão", () => {
    for (const [id, g] of Object.entries(TOKEN_GUIDES)) {
      expect(PROVIDER_IDS).toContain(id);
      expect(g!.provider).toBe(id);
      const text = [g!.title, g!.intro, ...g!.notes, ...g!.steps.flatMap((s) => [s.title, s.text])].join(" ");
      expect(text).not.toMatch(/—/);
    }
  });
});
