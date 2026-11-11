// @vitest-environment happy-dom

// O primeiro passo do novo dashboard desenha os 5 visuais (com prévia) sem quebrar.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ModelPicker } from "./ModelPicker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("escolha de visual", () => {
  it("mostra os 5 visuais; no Básico, 2 com Usar e 3 travados", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(ModelPicker, { tier: "base", onUse: () => {} })));
    for (const name of ["Padrão VYZ", "Lavanda", "Pulso", "Noturno", "Areia"]) expect(host.textContent).toContain(name);
    expect([...host.querySelectorAll("button")].filter((b) => b.textContent === "Usar")).toHaveLength(2);
    expect(host.textContent).toContain("Disponível no Avançado");
    await act(async () => root.unmount());
  });
});
