import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));
vi.mock("@/server/history/log", () => ({ logActivity: vi.fn() }));
vi.mock("@/server/analytics/queries", () => ({ dashboardTag: (id: string) => id }));

const ID = "11111111-1111-4111-8111-111111111111";
const updates: unknown[] = [];
const current = { templateId: "vyz-ecommerce", pages: ["visao-geral"], metricPrefs: { google: { kpis: { hidden: ["cpc"], shown: [] } } } as object };

vi.mock("@/server/auth/workspace", () => ({ authorize: vi.fn(async () => ({ workspace: { id: "ws" }, user: { id: "user" } })) }));
vi.mock("./queries", () => ({ getDashboard: vi.fn(async () => current) }));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    from: () => ({
      update: (v: unknown) => {
        updates.push(v);
        return { eq: async () => ({ data: null, error: null }) };
      },
    }),
  })),
}));

const load = () => import("./actions");

describe("salvar métricas", () => {
  beforeEach(() => {
    updates.length = 0;
  });

  // os modelos novos guardam as escolhas em "sample"; o que já estava em outra chave fica
  it("grava só a diferença e mantém as outras chaves", async () => {
    const { saveDashboardMetricPrefs } = await load();
    const r = await saveDashboardMetricPrefs(ID, "sample", { kpis: { hidden: ["cpm", "inventada"], shown: ["frequency"] } });
    expect(r.ok).toBe(true);
    expect(updates).toEqual([{ metric_prefs: { google: { kpis: { hidden: ["cpc"], shown: [] } }, sample: { kpis: { hidden: ["cpm"], shown: ["frequency"] } } } }]);
  });

  it("restaurar tira a chave", async () => {
    const { saveDashboardMetricPrefs } = await load();
    await saveDashboardMetricPrefs(ID, "sample", {});
    expect(updates[0]).toEqual({ metric_prefs: { google: { kpis: { hidden: ["cpc"], shown: [] } } } });
  });

  it("no exemplo, salvar numa aba não perde o que vale em outra", async () => {
    const before = { templateId: current.templateId, pages: current.pages };
    Object.assign(current, { templateId: "vyz-ecommerce", pages: ["visao-geral", "criativos", "campanhas"] });
    const { saveDashboardMetricPrefs } = await load();
    // frequency é card de Criativos; spend é card da Visão geral e foi adicionado a Criativos
    await saveDashboardMetricPrefs(ID, "sample", { kpis: { hidden: ["frequency"], shown: ["spend"] } });
    Object.assign(current, before);
    expect(updates[0]).toMatchObject({ metric_prefs: { sample: { kpis: { hidden: ["frequency"], shown: ["spend"] } } } });
  });

  it("recusa chave que não é a do dashboard", async () => {
    const { saveDashboardMetricPrefs } = await load();
    expect((await saveDashboardMetricPrefs(ID, "google", {})).ok).toBe(false);
    expect((await saveDashboardMetricPrefs(ID, "meta", {})).ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("recusa quem não pode editar, sem gravar", async () => {
    const { authorize } = await import("@/server/auth/workspace");
    const { appError } = await import("@/server/supabase/errors");
    vi.mocked(authorize).mockRejectedValueOnce(appError("forbidden"));
    const { saveDashboardMetricPrefs } = await load();
    expect((await saveDashboardMetricPrefs(ID, "meta", {})).ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
