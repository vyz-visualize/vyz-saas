import { describe, expect, it } from "vitest";
import { cookieDomainFor } from "./cookies";

const D = ".vyzualize.com.br";

describe("domain dos cookies da sessão", () => {
  it("no domínio configurado (site e subdomínios), mantém o domain compartilhado", () => {
    for (const host of ["www.vyzualize.com.br", "vyzualize.com.br", "dash.vyzualize.com.br", "lps.vyzualize.com.br", "WWW.VYZUALIZE.COM.BR", "www.vyzualize.com.br:443"]) expect(cookieDomainFor(host, D), host).toBe(D);
  });

  it("fora dele (preview da Vercel, localhost, outros), sem domain: o navegador aceitaria só assim", () => {
    for (const host of ["vyz-saas-git-fix-templates-revisao-vyzualize.vercel.app", "localhost:3000", "127.0.0.1:3000", "vyzualize.com.br.evil.com", "evilvyzualize.com.br", null, ""]) expect(cookieDomainFor(host, D), String(host)).toBeUndefined();
  });

  it("sem domínio configurado, nunca põe domain", () => {
    expect(cookieDomainFor("www.vyzualize.com.br", undefined)).toBeUndefined();
    expect(cookieDomainFor("www.vyzualize.com.br", "")).toBeUndefined();
  });
});
