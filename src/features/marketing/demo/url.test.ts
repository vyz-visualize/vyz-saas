// @vitest-environment happy-dom

// No site, nada escreve na URL. No painel, o comparativo continua escrevendo (o link leva a escolha).

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateDashboard } from "@/features/analytics/aggregate";
import { cutCreatives } from "@/features/analytics/creatives/access";
import { CompareView } from "@/features/analytics/creatives/CompareView";
import { UrlWritesProvider } from "@/features/analytics/creatives/url-state";
import type { MetaView } from "@/features/analytics/types";
import { sampleRowsFor } from "./engine";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const data = () => {
  const view = aggregateDashboard(sampleRowsFor("meta"), { breakEvenRoas: 2.5 }) as MetaView;
  return cutCreatives(view, { tier: "avancado", tab: "comparativo", ads: [] }, { hideSpend: false, currency: "BRL" }).creatives!;
};

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(writes: boolean | null) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const view = createElement(CompareView, { data: data() });
  await act(async () => root.render(writes === null ? view : createElement(UrlWritesProvider, { value: writes }, view)));
  return root;
}

describe("comparativo e a URL", () => {
  it("no site (escrita desligada), o endereço não muda", async () => {
    const root = await mount(false);
    expect(window.location.search).toBe("");
    await act(async () => root.unmount());
  });

  it("no painel (sem o provider), continua levando a escolha para a URL", async () => {
    const root = await mount(null);
    expect(window.location.search).toMatch(/^\?anuncios=/);
    await act(async () => root.unmount());
  });
});
