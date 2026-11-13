import { describe, expect, it } from "vitest";
import { activityLabel, activityTone, auditLabel, authEventLabel, deviceLabel } from "./history";

describe("authEventLabel", () => {
  it("descreve o evento e o jeito de entrar", () => {
    expect(authEventLabel("sign_in", "password")).toEqual({ label: "Entrou · e-mail e senha", tone: "ok" });
    expect(authEventLabel("oauth_sign_in", "google").label).toBe("Entrou com o Google");
    expect(authEventLabel("sign_in_failed", "password").tone).toBe("warn");
    expect(authEventLabel("sign_out", null, { scope: "global" }).label).toBe("Saiu de todos os aparelhos");
    expect(authEventLabel("password_updated", null, { via: "recovery" }).label).toMatch(/link do e-mail/);
    expect(authEventLabel("algo_novo", null).label).toBe("Evento de acesso");
  });
});

describe("activityLabel", () => {
  it("traduz o evento e cita a plataforma", () => {
    expect(activityLabel("billing.plan_changed")).toBe("Plano alterado");
    expect(activityLabel("integration.connected", { provider: "meta" })).toBe("Plataforma conectada · Meta Ads");
    // sem frase própria: genérico, nunca o código cru
    expect(activityLabel("x.y")).toBe("Alteração registrada");
    expect(activityTone("sync.failed")).toBe("warn");
    expect(activityTone("integration.connect_failed")).toBe("warn");
    expect(activityTone("sync.finished")).toBe("neutral");
  });
});

describe("auditLabel", () => {
  it("monta a frase com o nome quando a coisa tem nome", () => {
    expect(auditLabel({ action: "insert", table: "dashboards", name: "Loja Verde" })).toBe("Criou o dashboard “Loja Verde”");
    expect(auditLabel({ action: "delete", table: "share_links", name: "x" })).toBe("Apagou um link compartilhado");
    expect(auditLabel({ action: "update", table: "workspaces", name: null })).toBe("Alterou o workspace");
    expect(auditLabel({ action: "insert", table: "workspace_members" })).toBe("Adicionou um membro à equipe");
  });

  it("ignora batimentos do servidor e tabelas de fora", () => {
    expect(auditLabel({ action: "update", table: "ad_accounts", changedColumns: ["last_synced_at", "updated_at"] })).toBeNull();
    expect(auditLabel({ action: "update", table: "ad_accounts", changedColumns: ["is_enabled", "updated_at"], name: "Conta" })).toBe("Alterou a conta “Conta”");
    expect(auditLabel({ action: "insert", table: "plans" })).toBeNull();
  });
});

describe("deviceLabel", () => {
  it("lê navegador e sistema do user agent", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome no macOS");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari no iPhone");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge no Windows");
    expect(deviceLabel("Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0")).toBe("Firefox no Android");
    expect(deviceLabel("curl/8.7.1")).toBe("Script");
    expect(deviceLabel(null)).toBe("Navegador desconhecido");
  });
});

import { activityLabel as label2, fallbackLabel } from "./history";

describe("atividade sem código cru", () => {
  it("traduz as métricas do dashboard e a troca de modelo", () => {
    expect(label2("dashboard.metrics_changed")).toBe("Alterou as métricas do dashboard");
    expect(label2("dashboard.template_changed")).toBe("Trocou o modelo do dashboard");
  });
  it("evento novo sem frase vira genérico, nunca o código", () => {
    expect(label2("dashboard.algo_novo")).toBe("Dashboard · alteração registrada");
    expect(fallbackLabel("xyz.coisa")).toBe("Alteração registrada");
    expect(label2("xyz.coisa")).not.toContain(".");
  });
});
