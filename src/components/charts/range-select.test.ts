// @vitest-environment happy-dom

// Selecionar dias no gráfico: arrastar, tocar e teclado.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComboChart } from "./ComboChart";
import { LineChart } from "./LineChart";

vi.mock("./FitChart", () => ({
  FitChart: ({ children }: { children: (size: { width: number; height: number }) => unknown }) => children({ width: 400, height: 200 }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
const points = Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}/10`, bar: 10, line: 20 }));

async function combo(onSelectRange?: (a: number, b: number) => void, selection?: { from: number; to: number }) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(ComboChart, { points, barLabel: "b", lineLabel: "l", formatY: String, tooltip: () => [], summary: "Resumo.", onSelectRange, selection })));
  return host.querySelector("svg")!;
}
const key = (el: Element, k: string, shiftKey = false) => act(async () => void el.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true })));
const pointer = (el: Element, type: string, clientX: number, pointerType = "mouse") => act(async () => void el.dispatchEvent(new PointerEvent(type, { clientX, clientY: 10, button: 0, pointerType, bubbles: true })));

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("gráfico por dia", () => {
  it("teclado: setas e Enter filtram o dia", async () => {
    const pick = vi.fn();
    const svg = await combo(pick);
    expect(svg.getAttribute("aria-label")).toContain("Enter filtra o dia");
    await key(svg, "ArrowRight");
    await key(svg, "ArrowRight");
    await key(svg, "Enter");
    expect(pick).toHaveBeenCalledWith(1, 1);
  });

  it("teclado: Shift e as setas selecionam um trecho", async () => {
    const pick = vi.fn();
    const svg = await combo(pick);
    await key(svg, "ArrowRight");
    await key(svg, "ArrowRight", true);
    await key(svg, "ArrowRight", true);
    expect(svg.querySelector("[data-chart-selection]")).toBeTruthy();
    await key(svg, "Enter");
    expect(pick).toHaveBeenCalledWith(0, 2);
  });

  it("mouse: arrastar seleciona o trecho, em qualquer direção", async () => {
    const pick = vi.fn();
    const svg = await combo(pick);
    await pointer(svg, "pointerdown", 300);
    await pointer(svg, "pointermove", 150);
    expect(svg.querySelector("[data-chart-selection]")).toBeTruthy();
    await pointer(svg, "pointerup", 150);
    expect(pick).toHaveBeenCalledTimes(1);
    const [from, to] = pick.mock.calls[0];
    expect(from).toBeLessThan(to);
  });

  it("mouse: clicar marca um dia", async () => {
    const pick = vi.fn();
    const svg = await combo(pick);
    await pointer(svg, "pointerdown", 200);
    await pointer(svg, "pointerup", 200);
    const [from, to] = pick.mock.calls[0];
    expect(from).toBe(to);
  });

  it("toque: tocar marca o dia; arrastar o dedo é rolar a página, não seleciona", async () => {
    const pick = vi.fn();
    const svg = await combo(pick);
    await pointer(svg, "pointerdown", 200, "touch");
    await pointer(svg, "pointerup", 200, "touch");
    expect(pick).toHaveBeenCalledTimes(1);
    await pointer(svg, "pointerdown", 200, "touch");
    await pointer(svg, "pointermove", 100, "touch");
    await pointer(svg, "pointerup", 100, "touch");
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("o trecho filtrado aparece, e sem filtro o gráfico segue igual ao de sempre", async () => {
    const svg = await combo(undefined, { from: 2, to: 4 });
    expect(svg.querySelector("[data-chart-selection]")).toBeTruthy();
    expect(svg.getAttribute("aria-label")).not.toContain("Enter");
    await pointer(svg, "pointerdown", 200);
    expect(svg.querySelectorAll("[data-chart-selection]")).toHaveLength(1);
  });

  it("gráfico de linha das amostras: mesmo comportamento", async () => {
    const pick = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(LineChart, { values: [1, 2, 3, 4, 5], summary: "Linha.", onSelectRange: pick, maturingDays: 0 })));
    const svg = host.querySelector("svg")!;
    await key(svg, "ArrowRight");
    await key(svg, "ArrowRight", true);
    await key(svg, "Enter");
    expect(pick).toHaveBeenCalledWith(0, 1);
  });
});
