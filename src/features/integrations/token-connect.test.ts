import { describe, expect, it } from "vitest";
import { PROVIDER_IDS } from "./providers";
import { cleanToken, isTokenConnection, jwtExpiry, META_TOKEN_PERMISSIONS, metaTokenProblem, tiktokAuthCode, TOKEN_GUIDES, TOKEN_SCOPE, tokenGuide } from "./token-connect";

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

  it("token em todas as plataformas com API e conferência pronta; Google Ads e RD Station seguem só pelo login", () => {
    expect(Object.keys(TOKEN_GUIDES).sort()).toEqual(["ga4", "hubspot", "kommo", "linkedin", "meta", "pipedrive", "tiktok"]);
    expect(tokenGuide("google")).toBeNull();
    expect(tokenGuide("rdstation")).toBeNull();
    for (const g of Object.values(TOKEN_GUIDES)) {
      expect(g!.fields.length).toBeGreaterThan(0);
      expect(g!.steps.length).toBeGreaterThan(1);
    }
  });

  it("acha o auth_code do TikTok no endereço inteiro ou sozinho", () => {
    expect(tiktokAuthCode("https://loja.com/retorno?state=1&auth_code=a%2Bb&x=2")).toBe("a+b");
    expect(tiktokAuthCode("  abc123 ")).toBe("abc123");
  });

  it("lê a validade de um token JWT (Kommo) sem conferir a assinatura", () => {
    const exp = 1_900_000_000;
    const jwt = `x.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.y`;
    expect(jwtExpiry(jwt)).toBe(new Date(exp * 1000).toISOString());
    expect(jwtExpiry("sem-pontos")).toBeUndefined();
    expect(jwtExpiry("a.b.c")).toBeUndefined();
  });
});
