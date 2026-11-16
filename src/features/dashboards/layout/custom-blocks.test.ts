import { describe, expect, it } from "vitest";
import { customAllowed, customId, customSpec, customTitle } from "./custom-blocks";
import { allowedIds } from "./allowed";
import { insertBlocks, normalizeGrid, sameGrid, withAddedBlocks } from "./model";

describe("blocos pedidos (c:)", () => {
  it("o id descreve o bloco e volta ao mesmo id", () => {
    for (const id of ["c:rank:products:revenue:desc", "c:rank:campaigns:roas:desc:google", "c:trend:revenue", "c:breakdown:region:meta", "c:terms:waste", "c:videos:youtube", "c:table:products", "c:funnel"]) {
      const spec = customSpec(id);
      expect(spec, id).not.toBeNull();
      expect(customId(spec!)).toBe(id);
    }
  });

  it("id inválido não vira bloco", () => {
    for (const id of ["c:rank:products:ctr:desc", "c:rank:products:revenue:up", "c:rank:products:revenue:desc:google", "c:trend:nada", "c:funnel:x", "c:hack:1", "w0"]) expect(customSpec(id), id).toBeNull();
  });

  it("precisa da conta certa e esconde o que revela o investimento", () => {
    expect(customAllowed("c:terms:waste", ["meta"])).toBe(false);
    expect(customAllowed("c:terms:waste", ["google"])).toBe(true);
    expect(customAllowed("c:rank:placements:conversions:desc", ["google"])).toBe(false);
    expect(customAllowed("c:rank:products:roas:desc", ["meta"], true)).toBe(false);
    expect(customAllowed("c:rank:products:sold:desc", ["meta"], true)).toBe(true);
  });

  it("título com o que a pessoa vende", () => {
    expect(customTitle(customSpec("c:rank:products:revenue:desc")!, "ecommerce", "Cosméticos")).toBe("Cosméticos que mais faturam");
    expect(customTitle(customSpec("c:rank:campaigns:cpa:asc:google")!, "leads")).toBe("Campanhas do Google com menor custo por lead");
  });

  it("a gravação guarda o nome do bloco pedido e limita a quantidade", () => {
    const accept = allowedIds({ kpis: [{ metric: "spend" }], widgets: [] }, ["meta", "google"]);
    const raw = [
      { id: "kpis", x: 0, y: 0, w: 12, h: 4 },
      { id: "c:rank:products:revenue:desc", x: 0, y: 4, w: 6, h: 11, title: "  Cosméticos\nque mais faturam  " },
      { id: "c:rank:products:revenue:desc", x: 6, y: 4, w: 6, h: 11 },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `c:trend:${["revenue", "roas", "conversions", "cpa", "spend", "ctr", "clicks", "cpc", "cpm", "impressions"][i]}`, x: 0, y: 20 + i * 12, w: 12, h: 12 })),
    ];
    const grid = normalizeGrid(raw, accept, 1);
    expect(grid.find((i) => i.id === "c:rank:products:revenue:desc")?.title).toBe("Cosméticos que mais faturam");
    expect(grid.filter((i) => i.id.startsWith("c:")).length).toBe(8);
    // o nome conta para saber se mudou
    expect(sameGrid(grid, grid.map((i) => ({ ...i, title: i.title ? "Outro" : undefined })))).toBe(false);
  });

  it("entram logo abaixo dos cards, lado a lado, e o resto desce", () => {
    const grid = [
      { id: "kpis", x: 0, y: 0, w: 12, h: 4 },
      { id: "w0", x: 0, y: 4, w: 12, h: 10 },
    ];
    const next = insertBlocks(grid, [
      { id: "c:rank:products:revenue:desc", x: 0, y: 0, w: 6, h: 11 },
      { id: "c:rank:products:roas:desc", x: 0, y: 0, w: 6, h: 11 },
    ]);
    expect(next.find((i) => i.id === "c:rank:products:revenue:desc")).toMatchObject({ x: 0, y: 4 });
    expect(next.find((i) => i.id === "c:rank:products:roas:desc")).toMatchObject({ x: 6, y: 4 });
    expect(next.find((i) => i.id === "w0")).toMatchObject({ y: 15 });
    // fora do Avançado: no primeiro espaço livre
    expect(withAddedBlocks(grid, [{ id: "c:funnel", x: 0, y: 0, w: 6, h: 9 }]).find((i) => i.id === "c:funnel")).toMatchObject({ y: 14 });
  });
});
