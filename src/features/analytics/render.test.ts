import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { redactSpend } from "./aggregate";
import { LiveDashboardPreview } from "./LiveDashboardPreview";
import { LIVE_PAGES, livePages, LiveDashboardView } from "./LiveDashboardView";
import { sampleDashboardData } from "./preview";
import type { LiveDashboardData } from "./types";

const TODAY = "2026-10-30";

function render(data: LiveDashboardData, page: string) {
  return renderToString(createElement(LiveDashboardView, { data, initialPage: page as never }));
}

describe("renderização (smoke)", () => {
  for (const templateId of ["meta-ecommerce", "google-ecommerce"]) {
    const data = sampleDashboardData(templateId, { today: TODAY })!;
    for (const page of livePages(data.platform)) {
      it(`${templateId} · ${page}`, () => {
        const html = render(data, page);
        expect(html).toContain(data.dashboard.name);
        expect(html).toContain('role="tabpanel"');
        expect(html.length).toBeGreaterThan(2000);
      });
    }
  }

  it("só mostra as abas pedidas que a plataforma tem", () => {
    expect(livePages("google", ["termos", "criativos", "visao-geral"])).toEqual(["termos", "visao-geral"]);
    expect(livePages("meta", [])).toEqual(Object.keys(LIVE_PAGES.meta));
  });

  it("investimento oculto não aparece no HTML", () => {
    const data = sampleDashboardData("meta-ecommerce", { today: TODAY })!;
    const spend = data.view.campaigns[0].spend!;
    const hidden = { ...data, hideSpend: true, view: redactSpend(data.view) };
    const html = render(hidden, "campanhas");
    expect(html).not.toContain(`R$ ${Math.trunc(spend).toLocaleString("pt-BR")}`);
  });

  it.each([
    ["meta-ecommerce", ["visao-geral", "campanhas", "funil", "criativos", "publico"]],
    ["google-ecommerce", ["visao-geral", "campanhas", "termos", "produtos"]],
  ] as const)("investimento oculto: %s não mostra custo nem ROAS em nenhuma aba", (template, pages) => {
    const data = sampleDashboardData(template, { today: TODAY })!;
    const hidden = { ...data, hideSpend: true, view: redactSpend(data.view) };
    for (const page of pages) {
      const html = render(hidden, page);
      for (const term of ["ROAS", "CPM", "CPC", "CPA", "Custo por compra"]) expect([page, term, html.includes(term)]).toEqual([page, term, false]);
    }
  });

  it("escolhas salvas valem no link: card e coluna ocultos não aparecem, card ligado aparece", () => {
    const data = sampleDashboardData("meta-ecommerce", { today: TODAY })!;
    const prefs = { meta: { kpis: { hidden: ["ticket"], shown: ["reach"] }, columns: { hidden: ["cpm"], shown: [] } } };
    const overview = renderToString(createElement(LiveDashboardView, { data, initialPage: "visao-geral", metricPrefs: prefs }));
    expect(overview).not.toContain("Ticket médio");
    expect(overview).toContain("Alcance médio por dia");
    const campaigns = renderToString(createElement(LiveDashboardView, { data, initialPage: "campanhas", metricPrefs: prefs }));
    expect(campaigns).not.toContain(">CPM<");
    expect(campaigns).toContain("CTR do link");
  });

  it("o botão Personalizar não aparece no link", () => {
    const data = sampleDashboardData("meta-ecommerce", { today: TODAY })!;
    expect(renderToString(createElement(LiveDashboardView, { data }))).not.toContain("Personalizar");
    expect(renderToString(createElement(LiveDashboardView, { data, canCustomize: true }))).toContain("Personalizar");
  });

  it("sem personalização: os cards e as colunas de sempre", () => {
    const data = sampleDashboardData("meta-ecommerce", { today: TODAY })!;
    const html = renderToString(createElement(LiveDashboardView, { data, initialPage: "visao-geral" }));
    expect(html).toContain("Ticket médio");
    expect(html).not.toContain("Alcance médio por dia");
  });

  it("estados vazios", () => {
    const data = sampleDashboardData("google-ecommerce", { today: TODAY })!;
    expect(render({ ...data, status: "no_accounts" }, "visao-geral")).toContain("Nenhuma conta ativa");
    expect(render({ ...data, status: "no_data" }, "visao-geral")).toContain("Os dados ainda estão chegando");
  });

  it("prévia do template", () => {
    const html = renderToString(createElement(LiveDashboardPreview, { templateId: "google-ecommerce", name: "Minha loja" }));
    expect(html).toContain("Minha loja");
    expect(html).toContain("Amostra");
    expect(renderToString(createElement(LiveDashboardPreview, { templateId: "nada" }))).toBe("");
  });
});
