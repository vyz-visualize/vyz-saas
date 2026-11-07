import { describe, expect, it } from "vitest";
import type { Insight } from "@/features/insights/insights";
import { dailyParams, weeklyParams, welcomeParams } from "./reports";
import { ALERT_MAX_PER_DAY, alertKey, parseReplyCommand, pickAlerts, planAllowsWhatsapp } from "./rules";
import { cleanParam, renderTemplate, TEMPLATES, type TemplateId } from "./templates";

const ins = (id: string, weight: number, tone: Insight["tone"] = "bad", dashboardId = "d1"): Insight => ({ id, dashboardId, dashboardName: "Meta", tone, title: `T ${id}`, body: `B ${id}`, weight });

describe("respostas PARAR / VOLTAR", () => {
  it.each(["PARAR", "parar", " Parar! ", "sair", "SAIR.", "pare por favor", "Stop"])("%s descadastra", (t) => expect(parseReplyCommand(t)).toBe("stop"));
  it.each(["VOLTAR", "voltar", "Voltar 🙂"])("%s volta", (t) => expect(parseReplyCommand(t)).toBe("resume"));
  it.each(["obrigado", "", null, "não quero parar de receber esses relatórios ótimos"])("%s não é comando", (t) => expect(parseReplyCommand(t)).toBeNull());
});

describe("templates", () => {
  it("renderiza com as variáveis na ordem", () => {
    expect(renderTemplate("alertas", ["Loja", "Meta", "Caiu.", "Detalhe"])).toBe("Alerta da VYZ em Loja, dashboard Meta: Caiu. Detalhe Para não receber mais, responda PARAR.");
  });
  it("recusa número errado de variáveis", () => expect(() => renderTemplate("diario", ["a"])).toThrow());
  it("cada template tem uma amostra por variável e as variáveis do corpo batem", () => {
    for (const id of Object.keys(TEMPLATES) as TemplateId[]) {
      const t = TEMPLATES[id];
      const used = new Set([...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
      expect(used.size).toBe(t.variables.length);
      expect(t.samples.length).toBe(t.variables.length);
      expect(t.body).not.toContain("—");
      expect(renderTemplate(id, t.samples)).not.toMatch(/\{\{/);
    }
  });
  it("limpa a variável (sem quebra de linha, sem vazio)", () => {
    expect(cleanParam("a\n\nb     c")).toBe("a b c");
    expect(cleanParam("")).toBe("-");
    expect(cleanParam("x".repeat(400)).length).toBe(300);
  });
  it("relatórios montam variáveis do motor de análises", () => {
    const pulse = [{ currency: "BRL", spend: 1100, conversions: 50, previousSpend: 1000, previousConversions: 40 }];
    const input = { firstName: "Ana Souza", workspaceName: "Loja", insights: [ins("kpi:cpa", 80)], pulse };
    expect(dailyParams(input)?.[0]).toBe("Ana");
    expect(weeklyParams(input)?.[3]).toBe("+10%");
    expect(weeklyParams(input)?.[5]).toBe("+25%");
    expect(dailyParams({ ...input, insights: [] })).toBeNull();
    expect(welcomeParams(input, { meta: 2, google: 1 })[2]).toBe("2 de Meta Ads e 1 de Google Ads");
  });
});

describe("limite de alertas", () => {
  const now = Date.parse("2026-11-07T11:00:00Z");
  it("só alertas fortes, no máximo por dia", () => {
    const out = pickAlerts([ins("a", 90), ins("b", 85), ins("c", 80), ins("fraco", 60), ins("bom", 95, "good")], [], now);
    expect(out.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out.length).toBe(ALERT_MAX_PER_DAY);
  });
  it("não repete a mesma chave em 24 h e conta os já enviados", () => {
    const sent = [{ refKey: alertKey(ins("a", 90)), createdAt: new Date(now - 3600_000).toISOString() }];
    expect(pickAlerts([ins("a", 90), ins("b", 85), ins("c", 80)], sent, now).map((i) => i.id)).toEqual(["b"]);
  });
  it("depois de 24 h pode repetir", () => {
    const sent = [{ refKey: alertKey(ins("a", 90)), createdAt: new Date(now - 25 * 3600_000).toISOString() }];
    expect(pickAlerts([ins("a", 90)], sent, now).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("plano", () => {
  it("só Avançado e Personalizado com assinatura ativa", () => {
    expect(planAllowsWhatsapp({ pages_plan_id: "avancado", has_access: true })).toBe(true);
    expect(planAllowsWhatsapp({ pages_plan_id: "personalizado", has_access: true })).toBe(true);
    expect(planAllowsWhatsapp({ pages_plan_id: "pro", has_access: true })).toBe(false);
    expect(planAllowsWhatsapp({ pages_plan_id: "base", has_access: true })).toBe(false);
    expect(planAllowsWhatsapp({ pages_plan_id: "avancado", has_access: false })).toBe(false);
    expect(planAllowsWhatsapp(null)).toBe(false);
  });
});
