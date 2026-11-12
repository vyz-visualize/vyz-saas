import { describe, expect, it } from "vitest";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { allowedPages, copyName, defaultPages, pageOptions, periodFromQuery, periodQuery, settingsToDb, toDashboard, type DashboardRow } from "./model";
import { createDashboardSchema } from "./schema";

const row: DashboardRow = {
  id: "0f2b1c1e-5a0e-4a8e-9a55-2d6f3b1f0c01",
  template_id: "vyz-ecommerce",
  name: "Loja Verde · Meta",
  client_name: "Loja Verde",
  goal_cents: 6000,
  margin: "0.4000",
  monthly_budget_cents: null,
  period: "7d",
  custom_days: 21,
  attribution: "7c",
  brand_color: null,
  hide_vyz_brand: false,
  created_at: "2026-10-30T10:00:00Z",
  updated_at: "2026-10-30T11:00:00Z",
};

const t = dashboardTemplate("vyz-ecommerce")!;

describe("toDashboard", () => {
  it("mapeia colunas, ordena páginas e contas", () => {
    const d = toDashboard(
      row,
      [
        { page_type_id: "funil", position: 1 },
        { page_type_id: "visao-geral", position: 0 },
        { page_type_id: "pagina-que-sumiu", position: 2 },
      ],
      [
        { id: "b", name: "Marca Dois", platform_id: "meta", is_enabled: false },
        { id: "a", name: "Loja Exemplo", platform_id: "meta", is_enabled: true },
      ],
    );
    expect(d.pages).toEqual(["visao-geral", "funil"]);
    expect(d.sources.map((s) => s.id)).toEqual(["a", "b"]);
    expect(d.accounts).toEqual({ meta: "a" });
    expect(d.settings).toEqual({ goal: 6000, margin: 0.4, budget: 0, period: "7d", customDays: 21, attribution: "7c", currency: "BRL" });
    expect(d.margin).toBe(0.4);
    // não há mais modelos "live": todo dashboard lê as contas ligadas ou a amostra
    expect(d.live).toBe(false);
    expect(d.brand).toBeUndefined();
  });

  it("valores fora do esperado caem no padrão", () => {
    const d = toDashboard({ ...row, margin: null, period: "1y", attribution: "x", custom_days: 400, brand_color: "#112233" }, [], []);
    expect(d.settings.period).toBe("30d");
    expect(d.settings.attribution).toBe("7c1v");
    expect(d.settings.customDays).toBe(60);
    expect(d.margin).toBeNull();
    expect(d.brand).toEqual({ color: "#112233", hideVyz: false });
  });
});

describe("settingsToDb", () => {
  it("zero vira automático (null) e a margem fica em 4 casas", () => {
    expect(settingsToDb({ goal: 0, budget: 500000, period: "custom", customDays: 2, attribution: "1c" }, 0.33333)).toEqual({
      goal_cents: null,
      margin: 0.3333,
      monthly_budget_cents: 500000,
      period: "custom",
      custom_days: 3,
      attribution: "1c",
    });
    expect(settingsToDb({ goal: 10, budget: 0, period: "30d", customDays: 14, attribution: "7c1v" }, null).margin).toBeNull();
  });
});

describe("páginas pelo plano", () => {
  it("as páginas do modelo primeiro; acima do plano fica trancada", () => {
    const opts = pageOptions(t, "pro");
    expect(opts.map((o) => o.id).slice(0, t.pages.length)).toEqual(t.pages);
    expect(opts.find((o) => o.id === "previsao")?.locked).toBe(true);
    expect(opts.find((o) => o.id === "termos")?.locked).toBe(false);
    expect(defaultPages(t, "base")).not.toContain("termos");
    expect(defaultPages(t, "pro")).toContain("termos");
    expect(defaultPages(t, "pro")).not.toContain("previsao");
    expect(defaultPages(t, "avancado")).toEqual(t.pages);
  });

  it("allowedPages filtra, tira repetidas e mantém a ordem pedida", () => {
    expect(allowedPages(t, "base", ["funil", "publico", "funil", "xyz", "visao-geral"])).toEqual(["funil", "visao-geral"]);
    expect(allowedPages(t, "pro", ["publico", "criativos"])).toEqual(["publico", "criativos"]);
  });
});

describe("período na URL", () => {
  const fallback = { period: "30d" as const, customDays: 14 };
  it("lê periodo e dias, com limites", () => {
    expect(periodFromQuery({ periodo: "7d" }, fallback)).toEqual({ period: "7d", customDays: 14 });
    expect(periodFromQuery({ periodo: "custom", dias: "90" }, fallback)).toEqual({ period: "custom", customDays: 60 });
    expect(periodFromQuery({ periodo: "custom", dias: "abc" }, fallback)).toEqual({ period: "custom", customDays: 14 });
    expect(periodFromQuery({ periodo: ["mes", "7d"] }, fallback)).toEqual({ period: "mes", customDays: 14 });
    expect(periodFromQuery({ periodo: "1y" }, fallback)).toEqual(fallback);
  });
  it("ida e volta", () => {
    expect(periodQuery({ period: "custom", customDays: 21 })).toBe("periodo=custom&dias=21");
    expect(periodQuery({ period: "mes", customDays: 21 })).toBe("periodo=mes");
  });
});

describe("copyName", () => {
  it("acrescenta (cópia) sem repetir e sem passar de 80", () => {
    expect(copyName("Loja Verde")).toBe("Loja Verde (cópia)");
    expect(copyName("Loja Verde (cópia)")).toBe("Loja Verde (cópia)");
    const long = copyName("x".repeat(80));
    expect(long.length).toBe(80);
    expect(long.endsWith(" (cópia)")).toBe(true);
  });
});

describe("createDashboardSchema", () => {
  const base = { templateId: "vyz-ecommerce", name: " Loja ", client: "", goal: 0, budget: 0, margin: null, period: "30d", customDays: 14, attribution: "7c1v", pages: ["visao-geral"], accountIds: [], brandColor: null, hideVyz: false };
  it("aceita o mínimo e apara o nome", () => {
    const r = createDashboardSchema.safeParse(base);
    expect(r.success && r.data.name).toBe("Loja");
  });
  it("recusa nome vazio, sem páginas, margem fora de 0–1 e conta que não é uuid", () => {
    expect(createDashboardSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(createDashboardSchema.safeParse({ ...base, pages: [] }).success).toBe(false);
    expect(createDashboardSchema.safeParse({ ...base, margin: 0 }).success).toBe(false);
    expect(createDashboardSchema.safeParse({ ...base, margin: 1.2 }).success).toBe(false);
    expect(createDashboardSchema.safeParse({ ...base, accountIds: ["act_1"] }).success).toBe(false);
    expect(createDashboardSchema.safeParse({ ...base, brandColor: "red" }).success).toBe(false);
  });
});
