import { describe, expect, it } from "vitest";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { FRAMED_SKINS, isFramedSkin, SKIN_BLOCKS } from "../skins/blocks";
import { canArrangeLayout, normalizeGrid, overlaps, withMetricCards } from "./model";
import { pageRules } from "./page-rules";

describe("disposição nas abas com visual próprio", () => {
  const t = dashboardTemplate("painel-lavanda")!;

  it("a primeira aba aceita os blocos do visual e cards de plataforma das fontes", () => {
    const r = pageRules(t, t.pages[0]);
    expect(r.accept("s-cpa")).toBe(true);
    expect(r.accept("s-visao")).toBe(false); // bloco de outro visual
    expect(r.accept("kpis")).toBe(false);
    expect(r.accept("m:meta:ctr")).toBe(true);
    expect(r.accept("m:tiktok:ctr")).toBe(false); // fora das fontes do template
    expect(r.base().map((i) => i.id)).toEqual(SKIN_BLOCKS.lavanda.map((b) => b.id));
  });

  it("as outras abas seguem os blocos do template", () => {
    const r = pageRules(t, "campanhas");
    expect(r.accept("s-cpa")).toBe(false);
    expect(r.labels).toBeNull();
  });

  it("todo visual tem disposição padrão sem sobreposição", () => {
    for (const [skin, blocks] of Object.entries(SKIN_BLOCKS)) {
      const g = normalizeGrid(blocks, () => true);
      expect(g.length, skin).toBe(blocks.length);
      expect(g.every((a) => g.every((b) => !overlaps(a, b))), skin).toBe(true);
    }
  });

  it("fora do Avançado, cards novos entram no espaço livre sem mexer no resto", () => {
    expect(canArrangeLayout("avancado")).toBe(true);
    expect(canArrangeLayout("pro")).toBe(false);
    const base = pageRules(t, t.pages[0]).base();
    const g = withMetricCards(base, ["m:meta:ctr"]);
    expect(g.slice(0, base.length)).toEqual(base);
    expect(g.every((a) => g.every((b) => !overlaps(a, b)))).toBe(true);
  });
});

describe("visuais com moldura própria", () => {
  it("são os cinco desenhados, e cada um tem blocos declarados", () => {
    expect([...FRAMED_SKINS].sort()).toEqual(["areia", "lavanda", "monocromo", "noturno", "pulso"]);
    for (const skin of FRAMED_SKINS) expect(SKIN_BLOCKS[skin].length).toBeGreaterThan(0);
  });
  it("as análises que seguem o tema do painel e os modelos sem visual não tomam a tela", () => {
    expect(isFramedSkin("previsao")).toBe(false);
    expect(isFramedSkin("mmm")).toBe(false);
    expect(isFramedSkin(undefined)).toBe(false);
    expect(isFramedSkin("noturno")).toBe(true);
  });
});
