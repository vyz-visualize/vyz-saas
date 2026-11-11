import { describe, expect, it } from "vitest";
import type { PageLayout } from "@/features/templates/types";
import { compact, COLS, constrain, defaultGrid, firstFree, KPIS_ID, limitsOf, metricCardId, normalizeGrid, overlaps, parseMetricCardId, place, sameGrid } from "./model";

const page: PageLayout = {
  kpis: [{ metric: "spend" }, { metric: "revenue" }, { metric: "roas" }, { metric: "cpa" }, { metric: "ctr" }],
  widgets: [
    { type: "line", metric: "revenue", span: 4 },
    { type: "funnel", span: 2 },
    { type: "bars", source: "campaigns", metric: "roas", span: 2 },
  ],
};
const noOverlap = (items: ReturnType<typeof defaultGrid>) => items.every((a) => items.every((b) => !overlaps(a, b)));

describe("disposição", () => {
  it("padrão do template: KPIs em cima, widgets na largura do template, sem sobrepor", () => {
    const g = defaultGrid(page);
    expect(g[0]).toEqual({ id: KPIS_ID, x: 0, y: 0, w: COLS, h: 8 });
    expect(g.map((i) => i.w)).toEqual([12, 12, 6, 6]);
    expect(g[2].y).toBe(g[3].y);
    expect(noOverlap(g)).toBe(true);
  });

  it("mover empurra quem está no caminho e reencaixa", () => {
    const g = defaultGrid(page);
    const moved = compact(place(g, { ...g[2], y: 0 }));
    expect(noOverlap(moved)).toBe(true);
    expect(moved.find((i) => i.id === "w1")!.y).toBe(0);
    expect(moved.find((i) => i.id === KPIS_ID)!.y).toBeGreaterThan(0);
  });

  it("valida o que vem do banco: id desconhecido, repetido e tamanho fora do limite", () => {
    const allowed = (id: string) => ["kpis", "w0", "w1", "m:meta:ctr"].includes(id);
    const out = normalizeGrid(
      [
        { id: "w0", x: 0, y: 0, w: 1, h: 99 },
        { id: "w0", x: 0, y: 0, w: 6, h: 8 },
        { id: "hack", x: 0, y: 0, w: 6, h: 8 },
        { id: "m:meta:ctr", x: 11, y: 0, w: 3, h: 4 },
        { id: "w1", x: "a", y: 0, w: 6, h: 8 },
      ],
      allowed,
    );
    expect(out.map((i) => i.id)).toEqual(["w0", "m:meta:ctr"]);
    expect(out[0]).toMatchObject({ w: 3, h: 20 });
    expect(out[1].x).toBe(COLS - 3);
    expect(noOverlap(out)).toBe(true);
  });

  it("lugar livre e ids de métrica", () => {
    expect(firstFree([{ id: "a", x: 0, y: 0, w: 6, h: 4 }], 3, 4)).toEqual({ x: 6, y: 0 });
    expect(parseMetricCardId(metricCardId("meta", "ctr"))).toEqual({ platform: "meta", metric: "ctr" });
    expect(parseMetricCardId("m:meta:../x")).toBeNull();
    expect(sameGrid(defaultGrid(page), defaultGrid(page))).toBe(true);
  });
});

describe("constrain: o que a grade barra", () => {
  const widget = { id: "w0", x: 6, y: 0, w: 6, h: 8 };
  const lim = limitsOf("w0");

  it("mover dentro da grade passa sem aviso", () => {
    expect(constrain("move", { ...widget, x: 3 }, lim)).toEqual({ item: { ...widget, x: 3 }, blocked: null });
  });

  it("mover além da borda para na borda e avisa", () => {
    expect(constrain("move", { ...widget, x: 9 }, lim)).toEqual({ item: { ...widget, x: 6 }, blocked: "edge" });
    expect(constrain("move", { ...widget, x: -2 }, lim)).toEqual({ item: { ...widget, x: 0 }, blocked: "edge" });
    expect(constrain("move", { ...widget, y: -1 }, lim).blocked).toBe("edge");
  });

  it("alargar além da borda não desloca o bloco: a largura para na borda", () => {
    const r = constrain("resize", { ...widget, w: 9 }, lim);
    expect(r.item.x).toBe(6);
    expect(r.item.w).toBe(COLS - 6);
    expect(r.blocked).toBe("edge");
  });

  it("menor que o mínimo e maior que o máximo avisam", () => {
    expect(constrain("resize", { ...widget, w: 2 }, lim)).toEqual({ item: { ...widget, w: lim.minW }, blocked: "min" });
    expect(constrain("resize", { ...widget, h: 3 }, lim).blocked).toBe("min");
    expect(constrain("resize", { ...widget, x: 0, h: 99 }, lim)).toEqual({ item: { ...widget, x: 0, h: lim.maxH }, blocked: "max" });
    const card = { id: metricCardId("meta", "spend"), x: 0, y: 0, w: 3, h: 4 };
    expect(constrain("resize", { ...card, w: 6 }, limitsOf(card.id)).item.w).toBe(4);
    expect(constrain("resize", { ...card, w: 6 }, limitsOf(card.id)).blocked).toBe("max");
  });

  it("dentro dos limites redimensiona sem aviso", () => {
    expect(constrain("resize", { ...widget, x: 0, w: 8, h: 10 }, lim)).toEqual({ item: { ...widget, x: 0, w: 8, h: 10 }, blocked: null });
  });
});
