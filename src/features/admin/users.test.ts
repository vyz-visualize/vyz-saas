import { describe, expect, it } from "vitest";
import { countSignIns, grantPeriodEnd, workspaceSlug, matchesUser, projectsOf, statusOf, type AdminUserRow } from "./users";

const base: AdminUserRow = {
  id: "u1",
  email: "Pedro.Napoli@huggy.io",
  name: "Pedro Nápoli",
  createdAt: "2026-11-01T00:00:00Z",
  lastSignInAt: null,
  signIns: 0,
  banned: false,
  workspace: null,
  plan: null,
  openCheckout: null,
};

describe("gerenciador de usuários", () => {
  it("situação: inativado vence tudo; plano vivo; parou no pagamento; sem plano", () => {
    expect(statusOf({ ...base, banned: true, plan: { id: "avancado", tier: "avancado", status: "active", provider: "mock", periodEnd: null, courtesy: true } })).toBe("inativado");
    expect(statusOf({ ...base, plan: { id: "pro", tier: "pro", status: "past_due", provider: "stripe", periodEnd: null, courtesy: false } })).toBe("ativo");
    expect(statusOf({ ...base, plan: { id: "pro", tier: "pro", status: "unpaid", provider: "stripe", periodEnd: null, courtesy: false } })).toBe("sem_plano");
    expect(statusOf({ ...base, openCheckout: { id: "c", planId: "avancado", createdAt: "" } })).toBe("parou_no_pagamento");
    expect(statusOf(base)).toBe("sem_plano");
  });

  it("projetos por plano dentro do limite do banco (1 a 30)", () => {
    expect([projectsOf("base"), projectsOf("pro"), projectsOf("avancado"), projectsOf("personalizado")]).toEqual([5, 15, 30, 30]);
  });

  it("prazo: meses somados; 0 = sem prazo (100 anos)", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    expect(grantPeriodEnd(12, now).getUTCFullYear()).toBe(2027);
    expect(grantPeriodEnd(0, now).getUTCFullYear()).toBe(2126);
  });

  it("conta logins por usuário, ignorando linhas sem usuário", () => {
    const m = countSignIns([{ user_id: "a" }, { user_id: "a" }, { user_id: null }, { user_id: "b" }]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(1);
    expect(m.size).toBe(2);
  });

  it("busca sem acento e sem caixa, por e-mail, nome e workspace", () => {
    expect(matchesUser(base, "napoli")).toBe(true);
    expect(matchesUser(base, "NÁPOLI")).toBe(true);
    expect(matchesUser({ ...base, workspace: { id: "w", name: "Huggy Labs", role: "owner" } }, "labs")).toBe(true);
    expect(matchesUser(base, "outro")).toBe(false);
    expect(matchesUser(base, "  ")).toBe(true);
  });

  it("slug do workspace válido para o banco", () => {
    const re = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
    for (const n of ["CAP Digital", "Ação & Cia!!", "---", "x".repeat(90)]) expect(workspaceSlug(n, "7e0c6494-b816-4356")).toMatch(re);
    expect(workspaceSlug("CAP Digital", "7e0c6494-b816")).toBe("cap-digital-7e0c64");
  });
});
