import { describe, expect, it } from "vitest";
import { connectResult, RETURN_DEFAULT, storedReturnPath, withConnectResult } from "./results";

describe("destino guardado no state", () => {
  it("aceita o painel e o onboarding", () => {
    expect(storedReturnPath("/painel/contas")).toBe("/painel/contas");
    expect(storedReturnPath("/comecar")).toBe("/comecar");
    expect(storedReturnPath("/comecar?passo=conectar")).toBe("/comecar?passo=conectar");
  });

  it("outros caminhos e endereços externos viram o padrão", () => {
    expect(storedReturnPath("/api/integrations/meta/start")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath("//evil.com/painel")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath("/\\evil.com")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath("https://evil.com/painel")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath("/painelx")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath(null)).toBe(RETURN_DEFAULT);
    expect(storedReturnPath("")).toBe(RETURN_DEFAULT);
  });

  it("normaliza antes de conferir (sem fugir do painel com ..)", () => {
    expect(storedReturnPath("/painel/../api/integrations/meta/start")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath("/painel/./contas")).toBe("/painel/contas");
  });

  it("tira resultados antigos e o fragmento", () => {
    expect(storedReturnPath("/painel/contas?erro=cancelado&x=1#topo")).toBe("/painel/contas?x=1");
    expect(storedReturnPath("/comecar?conectado=meta")).toBe("/comecar");
  });

  it("só guarda o que o check do banco aceita", () => {
    expect(storedReturnPath("/painel/contas?q=a b")).toBe(RETURN_DEFAULT);
    expect(storedReturnPath(`/painel/${"a".repeat(600)}`)).toBe(RETURN_DEFAULT);
  });
});

describe("resultado na URL", () => {
  it("troca o resultado anterior e mantém o resto da query", () => {
    expect(withConnectResult("/comecar?passo=conectar&erro=cancelado", { conectado: "meta" })).toBe("/comecar?passo=conectar&conectado=meta");
    expect(withConnectResult("/painel/contas", { erro: "estado_expirado", provedor: "google" })).toBe("/painel/contas?erro=estado_expirado&provedor=google");
  });

  it("lê sucesso e erro conhecidos; ignora o resto", () => {
    expect(connectResult({ conectado: "meta" })).toMatchObject({ kind: "connected", provider: "meta" });
    expect(connectResult({ erro: "cancelado", provedor: "google" })).toMatchObject({ kind: "error", code: "cancelado", provider: "google" });
    expect(connectResult({ erro: "cancelado", provedor: "shopee" })).toMatchObject({ kind: "error", provider: null });
    expect(connectResult({ erro: "<script>" })).toBeNull();
    expect(connectResult({ erro: "toString" })).toBeNull();
    expect(connectResult({ conectado: "shopee" })).toBeNull();
    expect(connectResult({})).toBeNull();
  });
});
