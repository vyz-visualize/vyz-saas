// @vitest-environment happy-dom

// O comparativo do painel leva a escolha para a URL; com a escrita desligada, o endereço não muda.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateDashboard } from "../aggregate";
import { cutCreatives } from "./access";
import { CompareView } from "./CompareView";
import { UrlWritesProvider } from "./url-state";
import type { MetaView } from "../types";
import { sampleRows } from "../preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const data = () => {
  const view = aggregateDashboard(sampleRows("meta", { period: "30d" }), { breakEvenRoas: 2.5 }) as MetaView;
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
  it("com a escrita desligada, o endereço não muda", async () => {
    const root = await mount(false);
    expect(window.location.search).toBe("");
    await act(async () => root.unmount());
  });

  it("no painel, a métrica de vídeo aparece como Retenção até o fim, com o ⓘ", async () => {
    const root = await mount(null);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Retenção até o fim");
    expect(text).not.toMatch(/hold rate/i);
    const row = [...document.querySelectorAll("th")].find((th) => th.textContent?.includes("Retenção até o fim"))!;
    expect(row.querySelector("button")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("no painel (sem o provider), continua levando a escolha para a URL", async () => {
    const root = await mount(null);
    expect(window.location.search).toMatch(/^\?anuncios=/);
    await act(async () => root.unmount());
  });
});
