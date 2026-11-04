import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dashboardTemplate } from "@/features/templates/dashboards";
import type { PageId } from "@/features/templates/types";
import { DashboardBody, type DashboardSpec } from "./DashboardBody";
import { DEFAULT_SETTINGS } from "./data";

const spec = (templateId: string, page: PageId, metricPrefs?: DashboardSpec["metricPrefs"]): DashboardSpec => ({ templateId, name: "Visão", client: "Loja Verde", pages: [page], settings: DEFAULT_SETTINGS, metricPrefs });
const render = (s: DashboardSpec, extra: { hideSpend?: boolean; customizeId?: string } = {}) => renderToString(createElement(DashboardBody, { spec: s, ...extra }));

describe("dashboard de exemplo", () => {
  const costPages: PageId[] = ["visao-geral", "campanhas", "por-plataforma", "metas", "publico", "criativos"];

  it.each(costPages)("investimento oculto: %s não mostra custo nem ROAS", (page) => {
    const t = dashboardTemplate("ecommerce-completo")!;
    expect(t).toBeTruthy();
    const html = render(spec(t.id, page), { hideSpend: true });
    for (const term of ["ROAS", "CPM", "CPC", "Custo por"]) expect([page, term, html.includes(term)]).toEqual([page, term, false]);
  });

  it("escolhas salvas valem no link", () => {
    const prefs = { sample: { kpis: { hidden: ["roas"], shown: ["impressions"] }, columns: { hidden: [], shown: [] } } };
    const html = render(spec("ecommerce-visao-geral", "visao-geral", prefs));
    expect(html).toContain("Impressões");
    expect(html).not.toContain(">ROAS<");
  });

  it("coluna oculta some da tabela", () => {
    const prefs = { sample: { columns: { hidden: ["ctr"], shown: [] } } };
    const header = /<th scope="col"[^>]*>CTR</;
    expect(render(spec("ecommerce-completo", "campanhas"))).toMatch(header);
    expect(render(spec("ecommerce-completo", "campanhas", prefs))).not.toMatch(header);
  });

  it("o botão Personalizar só aparece para quem pode editar", () => {
    const s = spec("ecommerce-visao-geral", "visao-geral");
    expect(render(s)).not.toContain("Personalizar");
    expect(render(s, { customizeId: "d1" })).toContain("Personalizar");
  });
});
