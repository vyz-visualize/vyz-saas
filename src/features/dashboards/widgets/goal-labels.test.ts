// "Alvo" no sentido de objetivo, para não confundir com a plataforma Meta.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { datasetFor, DEFAULT_SETTINGS } from "../data";
import { PAGES } from "@/features/templates/pages";

describe('"alvo" nos textos do dashboard', () => {
  it("alerta do modelo", () => {
    const ds = datasetFor({ templateId: "vyz-leads", name: "T", client: "C", settings: DEFAULT_SETTINGS }, 30);
    expect(ds.alerts[0].title).toContain("acima do alvo");
    expect(ds.alerts[0].title).not.toContain("meta");
  });

  it("título da tabela de clientes", () => {
    const widgets = Object.values(PAGES).flatMap((p) => p.build({ profile: "agencia", sources: ["meta"] }).widgets);
    expect(widgets.map((w) => w.title)).toContain("Clientes e alvo de CPA");
  });

  it("nenhum texto dos widgets usa meta como objetivo", () => {
    const code = readFileSync(new URL("./Widgets.tsx", import.meta.url), "utf8");
    for (const old of ["Na meta", "Fora da meta", "Dentro da meta", "Acima da meta", '"Meta"', "`meta ", "· meta"]) expect(code).not.toContain(old);
    for (const novo of ["Dentro do alvo", "Fora do alvo", "`alvo "]) expect(code).toContain(novo);
  });
});
