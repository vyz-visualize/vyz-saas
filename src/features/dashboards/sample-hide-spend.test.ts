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

  const save = async () => ({ ok: true as const });
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
  const teste: DashboardSpec = { ...spec("criativos-meta", "visao-geral"), pages: ["visao-geral", "publico", "criativos", "campanhas", "metas"] };

  it("o dashboard Teste desenha os 4 cards da Visão geral, sem Investimento", () => {
    const html = render(teste);
    expect(count(html, /data-vyz-metric=/g)).toBe(4);
    expect(html).not.toContain('data-vyz-metric="spend"');
  });

  it("escolha salva vale no que a tela desenha, em qualquer aba", () => {
    const html = render({ ...teste, metricPrefs: { sample: { kpis: { hidden: ["cpm"], shown: ["spend"] } } } });
    expect(count(html, /data-vyz-metric=/g)).toBe(4);
    expect(html).toContain('data-vyz-metric="spend"');
    expect(html).not.toContain('data-vyz-metric="cpm"');
  });

  it("atalhos nos cards só para quem pode editar", () => {
    const edit = renderToString(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save }));
    expect(count(edit, /aria-label="Ocultar /g)).toBe(4);
    for (const html of [render(teste), render(teste, { hideSpend: true })]) expect(html).not.toContain("Ocultar ");
    expect(edit).not.toContain("Adicionar métrica");
  });

  it("quem edita e quem só visualiza têm a mesma grade de 4 colunas", () => {
    const grid = (html: string) => /<div class="(grid grid-cols-2[^"]*)"/.exec(html)?.[1];
    const edit = renderToString(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save }));
    expect(grid(edit)).toBe(grid(render(teste)));
    expect(grid(edit)).toContain("grid-cols-4");
    expect(grid(edit)).not.toContain("grid-cols-5");
  });

  it("a ordem do topo: ações, abas, filtros com o botão por último", () => {
    const html = renderToString(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save, actions: createElement("span", null, "AÇÕES") }));
    expect(html).toContain("Personalizar métricas");
    expect(html.indexOf("Comparar com o período anterior")).toBeLessThan(html.indexOf("Personalizar métricas"));
    expect(html.indexOf("AÇÕES")).toBeLessThan(html.indexOf('role="tablist"'));
    expect(html.indexOf('role="tablist"')).toBeLessThan(html.indexOf("Comparar com o período anterior"));
  });

  it("o botão Personalizar só aparece para quem pode editar", () => {
    const s = spec("ecommerce-visao-geral", "visao-geral");
    expect(render(s)).not.toContain("Personalizar");
    expect(render(s, { customizeId: "d1" })).toContain("Personalizar");
  });
});
