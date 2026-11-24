import { describe, expect, it } from "vitest";
import { authOrigin, trustedOrigin } from "./auth-origin";

const SITE = "https://www.vyzualize.com.br";

describe("origem do retorno do login", () => {
  it("aceita o site, o localhost:3000 e os previews de branch", () => {
    expect(trustedOrigin("www.vyzualize.com.br")).toBe(SITE);
    expect(trustedOrigin("WWW.Vyzualize.com.br")).toBe(SITE);
    expect(trustedOrigin("localhost:3000")).toBe("http://localhost:3000");
    expect(trustedOrigin("vyz-saas-git-fix-templates-revisao-vyzualize.vercel.app")).toBe("https://vyz-saas-git-fix-templates-revisao-vyzualize.vercel.app");
    expect(trustedOrigin("vyz-saas-git-main-vyzualize.vercel.app")).toBe("https://vyz-saas-git-main-vyzualize.vercel.app");
  });

  it("qualquer outra origem cai no site principal", () => {
    for (const host of [
      null,
      "",
      "evil.com",
      "vyzualize.com.br",
      "localhost:3111",
      "127.0.0.1:3000",
      "www.vyzualize.com.br.evil.com",
      "vyz-saas-git-x-vyzualize.vercel.app.evil.com",
      "evil-vyz-saas-git-x-vyzualize.vercel.app",
      "vyz-saas-git--vyzualize.vercel.app",
      "vyz-saas-git-x-outrotime.vercel.app",
      "vyz-saas-abc123-vyzualize.vercel.app",
      "user@vyz-saas-git-x-vyzualize.vercel.app",
      "vyz-saas-git-x-vyzualize.vercel.app:8080",
      "vyz-saas-git-x_y-vyzualize.vercel.app",
    ]) {
      expect(trustedOrigin(host), String(host)).toBeNull();
      expect(authOrigin(host, SITE)).toBe(SITE);
    }
  });
});
