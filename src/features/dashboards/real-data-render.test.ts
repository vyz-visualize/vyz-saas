// @vitest-environment happy-dom

// Dados reais em todos os modelos de Meta e Google: cada página de cada modelo desenha
// com o Dataset das contas (sem alertas, CRM, carteira etc.) sem quebrar.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { sampleRows } from "@/features/analytics/preview";
import { datasetFromWarehouse } from "@/features/metrics/warehouse-dataset";
import { generateAnalyticsData } from "@/features/sync/mock/analytics";
import { ALL_DASHBOARD_TEMPLATES, isLiveTemplate, usesAccounts } from "@/features/templates/live";
import { DashboardBody } from "./DashboardBody";
import { DEFAULT_SETTINGS } from "./data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const today = "2026-11-12";
const rows = { meta: sampleRows("meta", { period: "30d", today }), google: sampleRows("google", { period: "30d", today }) };
const ga4 = generateAnalyticsData({ accountExternalId: "123", endDate: today, days: 70 }).daily.map((d) => ({ ...d }));

describe("modelos comuns com dados reais", () => {
  const templates = ALL_DASHBOARD_TEMPLATES.filter((t) => !isLiveTemplate(t.id) && usesAccounts(t));
  it("há modelos de Meta e Google para cobrir", () => expect(templates.length).toBeGreaterThan(5));

  for (const t of templates) {
    it(`${t.id}: todas as páginas desenham`, async () => {
      const sets = (["meta", "google"] as const).filter((p) => t.sources.includes(p)).map((p) => rows[p]);
      const analytics = t.sources.includes("ga4") ? ga4 : [];
      const dataset = datasetFromWarehouse(sets, { profile: t.profile, today, current: rows.meta.current, previous: rows.meta.previous }, analytics);
      for (const page of t.pages) {
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        await act(async () => root.render(createElement(DashboardBody, { dataset, spec: { templateId: t.id, name: "Real", client: "Cliente", pages: t.pages, settings: DEFAULT_SETTINGS }, initialPage: page })));
        expect(host.textContent?.length).toBeGreaterThan(0);
        expect(host.textContent).not.toContain("Template não encontrado");
        await act(async () => root.unmount());
        host.remove();
      }
    });
  }
});
