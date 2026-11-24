// @vitest-environment happy-dom

// Revisão dos templates (fix/templates-revisao): um teste para cada bug de número.
//   1. Noturno, aba da Meta: o cabeçalho do gráfico e os cards usam a mesma conta do período anterior.
//   2. "Onde o mês fecha" (Noturno) e a Previsão de KPIs: a mesma projeção.
//   3. Objetivo que não é venda: o resultado é o do objetivo (lead, conversa), nunca a compra.
//   9. "Ontem contra a semana": contagem inteira.
//  10. Areia: o anúncio conta os cliques no link (os do funil).
//  12. Comparativo de criativos: criativo sem venda não fica em 1º no custo nem mostra custo.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { NO_FILTERS } from "@/features/analytics/filters";
import { sampleRows } from "@/features/analytics/preview";
import { filterDataset } from "@/features/metrics/filter-dataset";
import { resultNotice } from "@/features/metrics/result-notice";
import type { Dataset } from "@/features/metrics/source";
import { datasetFromWarehouse, resultField, resultOf } from "@/features/metrics/warehouse-dataset";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { anyDashboardTemplate } from "@/features/templates/live";
import type { PageId } from "@/features/templates/types";
import { DashboardBody } from "./DashboardBody";
import { datasetFor, DEFAULT_SETTINGS } from "./data";
import { SkinView } from "./skins";
import { linkClicksOf, stagesOf } from "./skins/AreiaParts";
import { rankCreatives } from "./skins/CriativosAoVivo";
import { monthClose, monthLeft } from "./skins/insights";
import { makeContext } from "./widgets/Widgets";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const today = localDate(new Date(), DEFAULT_TIME_ZONE);
const specOf = (templateId: string) => {
  const t = anyDashboardTemplate(templateId)!;
  return { templateId, name: "Teste", client: "Cliente", pages: t.pages, settings: { ...DEFAULT_SETTINGS, budget: 5_000_000, goal: 4000 } };
};
async function mount(node: ReturnType<typeof createElement>): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () => createRoot(host).render(node));
  return host;
}
const body = (templateId: string, ds: Dataset, page?: PageId) => {
  const spec = specOf(templateId);
  return mount(createElement(DashboardBody, { spec, dataset: ds, initialPage: page ?? spec.pages[0] } as never));
};

describe("1. a mesma variação no cabeçalho do gráfico e nos cards (Noturno, aba da Meta)", () => {
  it("o 'Todas em Meta Ads' usa o total e o anterior da plataforma, os mesmos dos cards", async () => {
    const ds = datasetFor(specOf("noturno-ecommerce"), 30);
    expect(ds.adPlatforms).toEqual(expect.arrayContaining(["meta", "google"]));
    const host = await body("noturno-ecommerce", ds, "meta-ads");
    const detail = host.querySelector('[data-detalhe="todas"]');
    expect(detail, "detalhe").not.toBeNull();
    const cards = makeContext(filterDataset(ds, { ...NO_FILTERS, platforms: ["meta"] }, { today }).ds);
    expect(Number(detail!.getAttribute("data-total"))).toBe(cards.cur.conversions);
    expect(Number(detail!.getAttribute("data-anterior"))).toBe(cards.prev.conversions);
  }, 60_000);
});

describe("2. uma projeção só do mês", () => {
  it("Noturno ('Onde o mês fecha') e Previsão de KPIs dão o mesmo fechamento com os mesmos dados", async () => {
    const ds = datasetFor(specOf("noturno-ecommerce"), 30);
    const noturno = await body("noturno-ecommerce", ds);
    const ctx = { ...makeContext(ds), today };
    const previsao = await mount(createElement(SkinView, { skin: "previsao", ctx, name: "T", client: "C", pages: ["previsao"], active: "previsao", periodLabel: "Últimos 30 dias" } as never));
    const a = noturno.querySelector("[data-fecha]");
    const b = previsao.querySelector('[data-fecha][data-fecha-alvo="revenue"]');
    expect(a && b, "os dois blocos").toBeTruthy();
    expect(Number(a!.getAttribute("data-fecha"))).toBeCloseTo(Number(b!.getAttribute("data-fecha")), 6);
  }, 60_000);

  it("o que falta do mês conta o último dia (dados reais terminam ontem; a amostra, hoje)", () => {
    const rows = (lastAgo: number) => Array.from({ length: 30 }, (_, i) => ({ ago: lastAgo + i, revenue: 100 }) as Dataset["current"][number]);
    expect(monthLeft(rows(1), { day: 23, daysInMonth: 30 })).toBe(8); // hoje (23) ao dia 30
    expect(monthLeft(rows(0), { day: 23, daysInMonth: 30 })).toBe(7); // 24 ao 30
    const mc = monthClose(rows(1), (d) => d.revenue, { day: 23, daysInMonth: 30 })!;
    expect(mc.done.at(-1)).toBe(2200); // dias 1 a 22 pela data, sem o dia do mês anterior
    expect(mc.future).toHaveLength(8);
  });
});

describe("3. o resultado do objetivo, nunca a compra com outro nome", () => {
  const meta = sampleRows("meta", { period: "30d", today });
  const real = (profile: "local" | "leads" | "ecommerce", rows = meta) => datasetFromWarehouse([rows], { profile, today, current: rows.current, previous: rows.previous });
  const strip = (field: "messages" | "leads") => ({
    ...meta,
    accountDaily: meta.accountDaily.map((r) => ({ ...r, [field]: null })),
    campaignDaily: meta.campaignDaily.map((r) => ({ ...r, [field]: null })),
    adDaily: meta.adDaily.map((r) => ({ ...r, [field]: null })),
  });

  it("cada objetivo lê o campo dele (só na Meta)", () => {
    expect(resultField("local")).toBe("messages");
    expect(resultField("leads")).toBe("leads");
    expect(resultField("imob")).toBe("leads");
    expect(resultField("ecommerce")).toBe("conversions");
    const row = { conversions: 549, leads: 12, messages: null };
    expect(resultOf(row, "meta", "messages")).toBe(0);
    expect(resultOf(row, "meta", "leads")).toBe(12);
    expect(resultOf(row, "google", "messages")).toBe(549);
  });

  it("negócio local sem conversas: 0 conversas e o aviso com as compras (nunca 549 'conversas')", () => {
    const ds = real("local", strip("messages"));
    const purchases = Math.round(meta.accountDaily.filter((r) => r.date >= meta.current.from && r.date <= meta.current.to).reduce((a, r) => a + r.conversions, 0));
    expect(purchases).toBeGreaterThan(0);
    expect(ds.current.reduce((a, d) => a + d.conversions, 0)).toBe(0);
    expect(ds.campaigns.reduce((a, c) => a + c.conversions, 0)).toBe(0);
    expect(ds.result).toMatchObject({ field: "messages", informed: false, purchases });
    expect(resultNotice(ds)).toContain("compras");
  });

  it("com as conversas informadas, o resultado é a soma delas", () => {
    const rows = { ...meta, accountDaily: meta.accountDaily.map((r) => ({ ...r, messages: 3 })) };
    const ds = real("local", rows);
    expect(ds.current.reduce((a, d) => a + d.conversions, 0)).toBe(3 * ds.current.length);
    expect(resultNotice(ds)).toBeNull();
  });

  it("leads: o card de leads é o lead da Meta; a venda continua venda", () => {
    const rows = { ...meta, accountDaily: meta.accountDaily.map((r) => ({ ...r, leads: 2, conversions: 40 })) };
    const leads = real("leads", rows);
    expect(leads.current.reduce((a, d) => a + d.leads, 0)).toBe(2 * leads.current.length);
    expect(leads.current.reduce((a, d) => a + d.conversions, 0)).toBe(2 * leads.current.length);
    const sales = real("ecommerce", rows);
    expect(sales.current.reduce((a, d) => a + d.conversions, 0)).toBe(40 * sales.current.length);
    expect(sales.result).toBeUndefined();
  });
});

describe("9. contagem inteira em 'Ontem contra a semana'", () => {
  it("o resultado de ontem não tem casa decimal (só a média pode ter)", async () => {
    const host = await body("pulso-ecommerce", datasetFor(specOf("pulso-ecommerce"), 30));
    const card = host.querySelector("[data-ontem]");
    expect(card).not.toBeNull();
    const values = [...card!.querySelectorAll("li strong")].map((s) => s.textContent ?? "");
    expect(values.length).toBe(2);
    expect(values[1]).toMatch(/^\d{1,3}(\.\d{3})*$/);
  }, 60_000);
});

describe("10. Areia: cliques no link, os mesmos do funil", () => {
  it("o anúncio do trilho usa os cliques no link do funil; sem eles, todos os cliques com esse nome", () => {
    const ds = datasetFor(specOf("areia-leads"), 30);
    const withLink = { ...ds, funnel: [{ label: "Cliques no link", pct: 100, count: 22066 }, { label: "Leads", pct: 4, count: 900 }] };
    const ctx = makeContext(withLink);
    expect(linkClicksOf(ctx)).toBe(22066);
    expect(stagesOf(ctx)[0]).toMatchObject({ id: "anuncio", count: 22066, note: "cliques no link" });
    const none = makeContext({ ...ds, funnel: [] });
    expect(stagesOf(none)[0]).toMatchObject({ count: none.cur.clicks, note: "cliques (todos)" });
  });
});

describe("12. ranking por custo: sem venda não ganha nem mostra custo", () => {
  it("o criativo sem resultado vai para o fim, com custo vazio", () => {
    const c = (id: string, spend: number, conversions: number) => ({ id, spend, conversions, clicks: 10, impressions: 1000 });
    const r = rankCreatives([c("zero", 50, 0), c("caro", 500, 5), c("barato", 100, 10)], "cpa");
    expect(r.map((x) => x.id)).toEqual(["barato", "caro", "zero"]);
    expect(r.at(-1)!.cpa).toBeNull();
  });
});
