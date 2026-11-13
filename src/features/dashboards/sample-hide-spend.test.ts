import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dashboardTemplate } from "@/features/templates/dashboards";
import type { PageId } from "@/features/templates/types";
import { DashboardBody, type DashboardSpec } from "./DashboardBody";
import { sampleCreatives } from "@/features/analytics/creatives/sample";
import type { CreativesData } from "@/features/analytics/types";
import { currentTotals, platformPart } from "@/features/metrics/compute";
import { periodDays } from "@/features/workspace/types";
import { brl } from "@/lib/format";
import { datasetFor, DEFAULT_SETTINGS } from "./data";

const spec = (templateId: string, page: PageId, metricPrefs?: DashboardSpec["metricPrefs"]): DashboardSpec => ({ templateId, name: "Visão", client: "Loja Verde", pages: [page], settings: DEFAULT_SETTINGS, metricPrefs });
const render = (s: DashboardSpec, extra: { hideSpend?: boolean; customizeId?: string; creatives?: CreativesData; initialPage?: PageId } = {}) => renderToString(createElement(DashboardBody, { spec: s, ...extra }));

describe("dashboard de exemplo", () => {
  const costPages: PageId[] = ["visao-geral", "campanhas", "por-plataforma", "metas", "publico", "criativos"];

  it.each(costPages)("investimento oculto: %s não mostra custo nem ROAS", (page) => {
    const t = dashboardTemplate("vyz-ecommerce")!;
    expect(t).toBeTruthy();
    const html = render(spec(t.id, page), { hideSpend: true });
    for (const term of ["ROAS", "CPM", "CPC", "Custo por"]) expect([page, term, html.includes(term)]).toEqual([page, term, false]);
  });

  it("escolhas salvas valem no link", () => {
    const prefs = { sample: { kpis: { hidden: ["roas"], shown: ["impressions"] }, columns: { hidden: [], shown: [] } } };
    const html = render(spec("vyz-ecommerce", "visao-geral", prefs));
    expect(html).toContain("Impressões");
    expect(html).not.toContain(">ROAS<");
  });

  it("coluna oculta some da tabela", () => {
    const prefs = { sample: { columns: { hidden: ["ctr"], shown: [] } } };
    const header = /<th scope="col"[^>]*>CTR</;
    expect(render(spec("vyz-ecommerce", "campanhas"))).toMatch(header);
    expect(render(spec("vyz-ecommerce", "campanhas", prefs))).not.toMatch(header);
  });

  const save = async () => ({ ok: true as const });
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
  // o dashboard Teste, aberto na aba Criativos: 4 cards do modelo (CTR, custo por resultado, frequência e CPM)
  const teste: DashboardSpec = { ...spec("vyz-ecommerce", "visao-geral"), pages: ["visao-geral", "publico", "criativos", "campanhas", "metas"] };
  const criativos = { initialPage: "criativos" as PageId };

  it("o dashboard Teste desenha os 4 cards de Criativos, sem Investimento", () => {
    const html = render(teste, criativos);
    expect(count(html, /data-vyz-metric=/g)).toBe(4);
    expect(html).not.toContain('data-vyz-metric="spend"');
  });

  it("aba Criativos com Meta e Google: os cards mostram a parte da Meta, a mesma dos anúncios", () => {
    const misto: DashboardSpec = { ...spec("vyz-ecommerce", "criativos"), pages: ["criativos"] };
    const ds = datasetFor(misto, periodDays(misto.settings));
    const cur = currentTotals(ds);
    const parte = platformPart(ds, "meta", "current");
    expect(parte.spend).toBeLessThan(cur.spend);
    const creatives = sampleCreatives(dashboardTemplate("vyz-ecommerce")!, { name: misto.name, client: misto.client, settings: misto.settings }, ["criativos"], { tier: "avancado" }, { period: misto.settings.period, customDays: misto.settings.customDays });
    const comPagina = render(misto, { creatives, initialPage: "criativos" });
    const semPagina = render(misto, { initialPage: "criativos" });
    // o CPM do card é o da Meta; nos modelos novos a aba Criativos é da Meta (PAGE_PLATFORM), com ou sem os anúncios
    expect(comPagina).toContain(brl(parte.cpm));
    expect(semPagina).toContain(brl(parte.cpm));
    expect(comPagina).not.toContain(brl(cur.cpm));
  });

  it("escolha salva vale no que a tela desenha, em qualquer aba", () => {
    const html = render({ ...teste, metricPrefs: { sample: { kpis: { hidden: ["cpm"], shown: ["spend"] } } } }, criativos);
    expect(count(html, /data-vyz-metric=/g)).toBe(4);
    expect(html).toContain('data-vyz-metric="spend"');
    expect(html).not.toContain('data-vyz-metric="cpm"');
  });

  it("atalhos nos cards só para quem pode editar", () => {
    const edit = renderToString(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save, ...criativos }));
    expect(count(edit, /aria-label="Ocultar /g)).toBe(4);
    for (const html of [render(teste, criativos), render(teste, { hideSpend: true, ...criativos })]) expect(html).not.toContain("Ocultar ");
    expect(edit).not.toContain("Adicionar métrica");
  });

  it("quem edita e quem só visualiza têm a mesma grade de cards (12 colunas, fileiras sem buraco)", () => {
    const grid = (html: string) => /<div class="(grid grid-cols-2[^"]*)"/.exec(html)?.[1];
    const edit = renderToString(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save, ...criativos }));
    expect(grid(edit)).toBe(grid(render(teste, criativos)));
    expect(grid(edit)).toContain("grid-cols-12");
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
    const s = spec("vyz-ecommerce", "visao-geral");
    expect(render(s)).not.toContain("Personalizar");
    expect(render(s, { customizeId: "d1" })).toContain("Personalizar");
  });
});
