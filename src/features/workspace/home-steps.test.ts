import { describe, expect, it } from "vitest";
import { homeCta, homeSteps, nextStep, planBadge } from "./home-steps";

const opts = { connectHref: (p: string) => `/conectar/${p}`, shareHref: "/painel/dashboards/d1" };
const ids = (s: ReturnType<typeof homeSteps>) => s.filter((x) => x.done).map((x) => x.id);

describe("Primeiros passos da Início", () => {
  it("dashboard de exemplo (sem conta) não conta como feito", () => {
    // o caso relatado: dashboard criado com Meta e Google "Não conectado"
    const steps = homeSteps({ connected: [], realDashboards: 0, activeShareLinks: 0 });
    expect(ids(steps)).toEqual([]);
    expect(nextStep(steps)?.id).toBe("connect");
  });

  it("a ordem é respeitada: um passo só fica feito com o anterior feito", () => {
    // link ativo sem dashboard real não marca o compartilhar
    expect(ids(homeSteps({ connected: [], realDashboards: 3, activeShareLinks: 2 }))).toEqual([]);
    expect(ids(homeSteps({ connected: ["meta"], realDashboards: 0, activeShareLinks: 2 }))).toEqual(["connect"]);
    expect(ids(homeSteps({ connected: ["meta"], realDashboards: 1, activeShareLinks: 0 }))).toEqual(["connect", "dashboard"]);
    const all = homeSteps({ connected: ["google"], realDashboards: 1, activeShareLinks: 1 });
    expect(ids(all)).toEqual(["connect", "dashboard", "share"]);
    expect(nextStep(all)).toBeNull();
  });

  it('o botão principal é o próximo passo; "Novo dashboard" só com as contas conectadas', () => {
    const none = homeSteps({ connected: [], realDashboards: 0, activeShareLinks: 0 });
    expect(homeCta(none, [], opts)).toMatchObject({ kind: "connect", label: "Conectar Meta Ads", href: "/conectar/meta" });
    const meta = homeSteps({ connected: ["meta"], realDashboards: 0, activeShareLinks: 0 });
    expect(homeCta(meta, ["meta"], opts)).toMatchObject({ kind: "dashboard", label: "Novo dashboard" });
    const dash = homeSteps({ connected: ["meta"], realDashboards: 1, activeShareLinks: 0 });
    expect(homeCta(dash, ["meta"], opts)).toMatchObject({ kind: "share", href: "/painel/dashboards/d1" });
    const all = homeSteps({ connected: ["meta"], realDashboards: 1, activeShareLinks: 1 });
    expect(homeCta(all, ["meta"], opts).kind).toBe("dashboard");
  });

  it("selo do plano deixa claro que é limite", () => {
    expect(planBadge("Avançado", 1, 2)).toBe("Avançado · 1 de 2 projetos");
    expect(planBadge("Básico", 0, 1)).toBe("Básico · 0 de 1 projeto");
  });
});
