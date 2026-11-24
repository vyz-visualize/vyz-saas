import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mmmReadiness, type MonthSpend } from "@/features/mmm/readiness";
import { MmmConstruction } from "./MmmConstruction";

const today = "2026-11-25";
function months(projectId: string, platform: string, n: number): MonthSpend[] {
  return Array.from({ length: n }, (_, i) => {
    const t = 2026 * 12 + 10 - i;
    return { projectId, platform, month: `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`, spend: 3000 * (1 + (i % 3) * 0.2), days: 30, sumSq: 15 * (50 * 50 + 150 * 150) };
  });
}
const render = (projects: ReturnType<typeof mmmReadiness>, connectHref?: string) =>
  renderToStaticMarkup(createElement(MmmConstruction, { data: { projects, fullHistory: true, today }, connectHref }));

describe("tela do MMM em construção", () => {
  it("cliente com 1 canal: ✗ nos canais, sem contribuição/ROI/redistribuição, botões de ligar fonte", () => {
    const html = render(mmmReadiness([{ id: "a", name: "Cliente A" }], months("a", "meta", 3), [], today), "/painel/contas");
    expect(html).toContain("Cliente A");
    expect(html).toContain("Com um canal só");
    expect(html).toContain("faltam 3");
    expect(html).toContain("cumpre em fev/27");
    expect(html).toContain("Ligar o GA4");
    expect(html).toContain("Ligar um CRM");
    expect(html).toContain("circular");
    // a verba varia: só a variação cumpre
    expect(html.match(/data-criterio-ok="nao"/g)?.length).toBe(3);
    for (const banned of ["ROI", "Contribuição", "Redistribuição", "Ganho com a mesma verba", "curva de resposta"]) expect(html).not.toContain(banned);
  });

  it("contas em dois workspaces: um bloco por cliente; no link público, sem botões", () => {
    const projects = mmmReadiness([{ id: "x", name: "Cliente X" }, { id: "y", name: "Cliente Y" }], [...months("x", "meta", 8), ...months("x", "google", 8), ...months("y", "google", 8)], [], today);
    const html = render(projects);
    expect(html.match(/data-mmm-cliente=/g)?.length).toBe(2);
    expect(html).toContain("contas de 2 clientes");
    expect(html).not.toContain("Ligar o GA4");
  });
});
