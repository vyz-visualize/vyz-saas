import { describe, expect, it } from "vitest";
import type { PageLayout } from "@/features/templates/types";
import { alignGrid, compact, COLS, constrain, defaultGrid, firstFree, fixedGrid, hideBlock, KPI_ROWS, KPIS_ID, limitsOf, metricCardId, normalizeGrid, overlaps, parseMetricCardId, place, sameGrid, screenBreaks, widthLabel } from "./model";

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
  it("padrão do template: KPIs numa faixa só em cima, widgets na largura do template, sem sobrepor", () => {
    const g = defaultGrid(page);
    expect(g[0]).toEqual({ id: KPIS_ID, x: 0, y: 0, w: COLS, h: KPI_ROWS });
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

describe("alignGrid: alinhar a grade", () => {
  const ids = (g: { id: string }[]) => g.map((i) => i.id);
  const at = (g: ReturnType<typeof alignGrid>, id: string) => g.find((i) => i.id === id)!;

  it("fileira torta fica com a mesma altura e fecha as 12 colunas", () => {
    const g = alignGrid([
      { id: KPIS_ID, x: 0, y: 0, w: 12, h: 4 },
      { id: "w0", x: 0, y: 4, w: 5, h: 8 },
      { id: "w1", x: 6, y: 5, w: 3, h: 6 },
      { id: "w2", x: 9, y: 4, w: 3, h: 10 },
    ]);
    expect(at(g, "w0")).toMatchObject({ x: 0, y: 4, h: 10 });
    expect(at(g, "w1")).toMatchObject({ y: 4, h: 10 });
    expect(at(g, "w2")).toMatchObject({ y: 4, h: 10 });
    expect(at(g, "w0").w + at(g, "w1").w + at(g, "w2").w).toBe(COLS);
    expect(at(g, "w1").x).toBe(at(g, "w0").w);
    expect(noOverlap(g)).toBe(true);
  });

  it("não troca a ordem dos blocos nem perde nenhum", () => {
    const messy = [
      { id: "w2", x: 8, y: 13, w: 4, h: 7 },
      { id: KPIS_ID, x: 0, y: 0, w: 12, h: 4 },
      { id: "w0", x: 0, y: 5, w: 6, h: 8 },
      { id: "w1", x: 0, y: 14, w: 7, h: 9 },
    ];
    const g = alignGrid(messy);
    expect(ids(g)).toEqual(ids(messy));
    // sem buraco vertical: w2 sobe para o lado de w0 e os dois dividem a fileira por igual
    expect(at(g, "w0")).toMatchObject({ x: 0, y: 4, w: 6, h: 8 });
    expect(at(g, "w2")).toMatchObject({ x: 6, y: 4, w: 6, h: 8 });
    expect(at(g, "w1")).toMatchObject({ x: 0, y: 12, w: 12 });
    expect(noOverlap(g)).toBe(true);
  });

  it("a sobra de colunas mantém iguais os blocos iguais", () => {
    const row = (ws: number[]) => alignGrid(ws.map((w, i) => ({ id: `w${i}`, x: ws.slice(0, i).reduce((a, b) => a + b, 0), y: 0, w, h: 8 }))).map((i) => i.w);
    expect(row([5, 3, 3])).toEqual([6, 3, 3]);
    expect(row([6, 3])).toEqual([6, 6]);
    expect(row([3, 3, 3])).toEqual([4, 4, 4]);
    expect(row([4, 4, 4])).toEqual([4, 4, 4]);
  });

  it("respeita os limites: card de plataforma não passa de 4 colunas nem de 6 linhas", () => {
    const a = metricCardId("meta", "spend");
    const b = metricCardId("google", "spend");
    const g = alignGrid([
      { id: a, x: 0, y: 0, w: 3, h: 4 },
      { id: b, x: 3, y: 0, w: 3, h: 4 },
      { id: "w0", x: 6, y: 0, w: 4, h: 10 },
    ]);
    expect(at(g, a)).toMatchObject({ w: 4, h: 6 });
    expect(at(g, b)).toMatchObject({ w: 4, h: 6 });
    expect(at(g, "w0")).toMatchObject({ x: 8, w: 4, h: 10 });
    expect(noOverlap(g)).toBe(true);
  });

  it("pilha ao lado de um bloco alto: a ordem fica e o último da pilha desce até o pé", () => {
    const g = alignGrid([
      { id: "w0", x: 0, y: 0, w: 6, h: 20 },
      { id: "w1", x: 6, y: 0, w: 6, h: 8 },
      { id: "w2", x: 6, y: 8, w: 6, h: 9 },
    ]);
    expect(at(g, "w0")).toMatchObject({ x: 0, y: 0, w: 6, h: 20 });
    expect(at(g, "w1")).toMatchObject({ x: 6, y: 0, h: 8 });
    expect(at(g, "w2")).toMatchObject({ x: 6, y: 8, h: 12 });
  });

  it("alinhar de novo não muda nada, e o modelo padrão já nasce alinhado", () => {
    const once = alignGrid([
      { id: "w0", x: 1, y: 2, w: 4, h: 7 },
      { id: "w1", x: 7, y: 3, w: 3, h: 9 },
    ]);
    expect(sameGrid(alignGrid(once), once)).toBe(true);
    const base = defaultGrid(page);
    expect(sameGrid(alignGrid(base, page.kpis.length), base)).toBe(true);
    // fileira do modelo: funil e barras com a mesma altura
    expect(at(base, "w1").h).toBe(at(base, "w2").h);
  });
});

describe("ocultar e telas (o Personalizar)", () => {
  // KPIs em cima; linha (12) embaixo; funil (6) e barras (6) lado a lado
  const base = defaultGrid(page);
  const at = (g: ReturnType<typeof defaultGrid>, id: string) => g.find((i) => i.id === id);

  it("ocultar: o vizinho da mesma fileira ocupa o espaço, sem buraco", () => {
    const g = hideBlock(base, "w1");
    expect(at(g, "w1")).toBeUndefined();
    expect(at(g, "w2")).toMatchObject({ x: 0, w: 12 });
    expect(noOverlap(g)).toBe(true);
  });

  it("ocultar o bloco sozinho na fileira: os de baixo sobem", () => {
    const g = hideBlock(base, "w0");
    expect(at(g, "w1")!.y).toBe(KPI_ROWS);
    expect(at(g, "w2")!.y).toBe(KPI_ROWS);
  });

  it("o vizinho só cresce até o limite dele: um card de plataforma não vira faixa", () => {
    const card = metricCardId("meta", "ctr");
    const g = hideBlock([{ id: card, x: 0, y: 0, w: 3, h: 4 }, { id: "w0", x: 3, y: 0, w: 9, h: 4 }], "w0");
    expect(at(g, card)!.w).toBe(3);
  });

  it("fora do Avançado: o modelo sem os ocultos, e o oculto volta ao lugar dele", () => {
    const hidden = fixedGrid(base, base.filter((i) => i.id !== "w1"));
    expect(sameGrid(hidden, hideBlock(base, "w1"))).toBe(true);
    // mesmo que o rascunho tenha posições inventadas, vale o modelo
    const back = fixedGrid(base, [...hidden, { id: "w1", x: 7, y: 40, w: 3, h: 6 }]);
    expect(sameGrid(back, base)).toBe(true);
  });

  it("fora do Avançado: cards de plataforma e blocos pedidos entram no primeiro espaço livre; nada se move", () => {
    const card = metricCardId("meta", "ctr");
    const moved = base.map((i) => (i.id === "w0" ? { ...i, w: 6 } : i));
    const g = fixedGrid(base, [...moved, { id: card, x: 0, y: 99, w: 3, h: 4 }]);
    expect(at(g, "w0")!.w).toBe(12);
    expect(at(g, card)).toBeTruthy();
    expect(noOverlap(g)).toBe(true);
  });

  it("largura em palavras", () => {
    expect([12, 9, 8, 6, 4, 3, 2, 5].map(widthLabel)).toEqual(["Inteira", "3/4", "2/3", "Metade", "1/3", "1/4", "1/6", "5/12"]);
  });

  it("telas: tudo cabe numa tela alta; numa baixa, a aba vira telas e diz onde cada uma começa", () => {
    const tall = defaultGrid({ ...page, widgets: [...page.widgets, { type: "table", source: "campaigns", span: 4 }] });
    const isCard = (id: string) => id === KPIS_ID;
    expect(screenBreaks(tall, 2000, isCard)).toEqual({ screens: 1, breaks: [] });
    const low = screenBreaks(tall, 700, isCard)!;
    expect(low.screens).toBeGreaterThan(1);
    // a faixa de cards repete em todas as telas: nunca é o começo de uma
    expect(low.breaks.every((y) => y > 0)).toBe(true);
    expect(low.breaks).toHaveLength(low.screens - 1);
  });
});

