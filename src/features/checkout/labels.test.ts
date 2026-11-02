import { describe, expect, it } from "vitest";
import { describeSubscriptionChange, formatDate, invoiceDescription } from "./labels";

describe("linha do tempo da assinatura", () => {
  it("descreve cada mudança em português", () => {
    expect(describeSubscriptionChange({ change: "created", fromValue: null, toValue: "pro · year · 2 conta(s)" })).toBe(
      "Assinatura criada: Padrão, anual, 2 contas",
    );
    expect(describeSubscriptionChange({ change: "created", fromValue: null, toValue: "base · month · 1 conta(s)" })).toBe(
      "Assinatura criada: Básico, mensal, 1 conta",
    );
    expect(describeSubscriptionChange({ change: "plan_changed", fromValue: "base", toValue: "avancado" })).toBe("Plano: Básico → Avançado");
    expect(describeSubscriptionChange({ change: "quantity_changed", fromValue: "2", toValue: "5" })).toBe("Contas contratadas: 2 → 5");
    expect(describeSubscriptionChange({ change: "interval_changed", fromValue: "month", toValue: "year" })).toBe("Período: mensal → anual");
    expect(describeSubscriptionChange({ change: "status_changed", fromValue: "active", toValue: "past_due" })).toBe("Situação: Ativa → Pagamento atrasado");
    expect(describeSubscriptionChange({ change: "cancel_reverted", fromValue: null, toValue: null })).toBe("Cancelamento desfeito");
  });

  it("datas do Postgres no horário de Brasília", () => {
    expect(describeSubscriptionChange({ change: "cancel_scheduled", fromValue: null, toValue: "2026-11-29 22:14:01.123+00" })).toBe(
      "Cancelamento agendado para 29/11/2026",
    );
    // 01h UTC ainda é o dia anterior em Brasília
    expect(formatDate("2026-12-01T01:00:00Z")).toBe("30/11/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("ontem")).toBe("—");
  });
});

describe("planos de landing pages nos textos", () => {
  it("lp_pro vira Padrão (landing pages)", () => {
    expect(invoiceDescription("Assinatura lp_pro")).toBe("Assinatura Padrão (landing pages)");
    expect(invoiceDescription("Assinatura pro")).toBe("Assinatura Padrão");
    expect(invoiceDescription("Pedido avulso")).toBe("Pedido avulso");
  });
});
