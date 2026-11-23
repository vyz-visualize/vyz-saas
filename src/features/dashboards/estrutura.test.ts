// @vitest-environment happy-dom

// Cada visual com a estrutura dele: o Pulso com a lateral "Atenção agora", a tabela de status e a
// aba "Ações de hoje"; o Lavanda como relatório em capítulos (e o mês fechado contra o mês antes);
// o Noturno com o mestre-detalhe e a aba Produtos (só com catálogo); o Areia com o trilho do funil;
// o Fachada com a seção do lançamento.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { closedMonth } from "@/features/analytics/closed-month";
import { totals } from "@/features/metrics/compute";
import type { Dataset } from "@/features/metrics/source";
import { anyDashboardTemplate } from "@/features/templates/live";
import type { PageId } from "@/features/templates/types";
import { DashboardBody } from "./DashboardBody";
import { datasetFor, DEFAULT_SETTINGS } from "./data";
import { skinTabs } from "./skins/blocks";
import { LavandaSkin } from "./skins/Lavanda";
import { makeContext } from "./widgets/Widgets";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const body = (templateId: string, opts: { page?: PageId; ds?: Dataset } = {}) => {
  const spec = specOf(templateId);
  return mount(createElement(DashboardBody, { spec, dataset: opts.ds, initialPage: opts.page ?? spec.pages[0] } as never));
};

describe("Pulso: painel de operação", () => {
  it("a primeira aba tem a lateral Atenção agora e a tabela de status; Ações de hoje é aba do visual", async () => {
    const host = await body("pulso-ecommerce");
    expect(host.querySelector("[data-atencao-agora]")).not.toBeNull();
    expect(host.querySelector("[data-status-campanhas]")).not.toBeNull();
    expect(host.textContent).toContain("Ações de hoje");
    const acoes = await body("pulso-ecommerce", { page: "acoes-hoje" });
    expect(acoes.querySelector("[data-acoes-hoje]")).not.toBeNull();
    // na aba Ações de hoje, a lateral não repete o que a aba já mostra
    expect(acoes.querySelector("[data-atencao-agora]")).toBeNull();
  }, 60_000);

  it("a aba do visual entra logo depois da primeira, sem ser gravada no dashboard", () => {
    expect(skinTabs("pulso", ["visao-geral", "meta-ads"])).toEqual(["visao-geral", "acoes-hoje", "meta-ads"]);
    expect(skinTabs("lavanda", ["visao-geral", "meta-ads"])).toEqual(["visao-geral", "meta-ads"]);
  });
});

describe("Lavanda: relatório", () => {
  it("a primeira aba é o relatório em capítulos, com o índice", async () => {
    const host = await body("lavanda-ecommerce");
    expect(host.querySelector("[data-relatorio]")).not.toBeNull();
    expect(host.querySelectorAll("[data-capitulo]").length).toBe(4);
    expect(host.textContent).toContain("Relatório do período");
  }, 60_000);

  it("no mês fechado, o comparativo é contra o mês antes dele", async () => {
    const ds = datasetFor(specOf("lavanda-ecommerce"), 53);
    const ctx = { ...makeContext(ds), today: "2026-11-23" };
    const before = totals(ds.previous.slice(0, 30));
    const host = await mount(
      createElement(LavandaSkin, { ctx, name: "Teste", client: "Cliente", pages: ["visao-geral"], active: "visao-geral", periodLabel: "Personalizado", month: { info: closedMonth("2026-11-23"), active: true, before } } as never),
    );
    const row = host.querySelector('[data-comparativo="revenue"]');
    expect(Number(row?.getAttribute("data-anterior"))).toBe(before.revenue);
    expect(host.textContent).toContain("contra setembro");
    // a cascata por campanha não vale para o mês (o anterior por campanha é do período corrido)
    expect(host.querySelector("[data-cascata-de]")).toBeNull();
  }, 60_000);
});

describe("Noturno: análise", () => {
  it("mestre-detalhe na primeira aba; Produtos só com o catálogo", async () => {
    const host = await body("noturno-ecommerce");
    expect(host.querySelector("[data-analise-filtros]")).not.toBeNull();
    expect(host.querySelector("[data-mestre-detalhe]")).not.toBeNull();
    expect(skinTabs("noturno", ["visao-geral", "meta-ads"], { products: [] })).toEqual(["visao-geral", "meta-ads"]);
    expect(skinTabs("noturno", ["visao-geral", "meta-ads"], { products: [{}] })).toEqual(["visao-geral", "produtos", "meta-ads"]);
    const prod = await body("noturno-ecommerce", { page: "produtos" });
    expect(prod.querySelector("[data-produtos]")).not.toBeNull();
  }, 60_000);
});

describe("Areia: pipeline do lead", () => {
  it("o trilho do funil começa no anúncio e no lead; o detalhe do lead traz o anel", async () => {
    const host = await body("areia-leads");
    const stages = [...host.querySelectorAll("[data-etapa]")].map((e) => e.getAttribute("data-etapa"));
    expect(stages.slice(0, 2)).toEqual(["anuncio", "lead"]);
    expect(stages.length).toBeGreaterThanOrEqual(3);
    expect(host.querySelector("[data-anel-total]")).not.toBeNull();
  }, 60_000);
});

describe("Fachada: página do empreendimento", () => {
  it("com a planilha, a seção do lançamento mostra cada origem com a conversão em venda", async () => {
    const base = datasetFor(specOf("fachada-imob"), 30);
    const ds: Dataset = { ...base, launch: { from: "2026-10-24", to: "2026-11-22", origins: [{ name: "Meta Ads", leads: 120, sales: 6 }, { name: "Indicação", leads: 30, sales: 3 }], proposals: 25, sales: 9, value: 450_000_00 } };
    const host = await body("fachada-imob", { ds });
    const section = host.querySelector("[data-lancamento]");
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain("Indicação");
    expect(section?.textContent).toContain("10,0%");
  }, 60_000);
});
