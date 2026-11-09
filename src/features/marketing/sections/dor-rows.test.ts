import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOR_PAIRS } from "./DorRows";

describe("dobra Dor → solução", () => {
  it("o texto novo das plataformas, sem falar em dupla contagem", () => {
    expect(DOR_PAIRS[2].sol).toBe("Cada plataforma com a sua venda, lado a lado, sem somar uma na outra.");
    expect(JSON.stringify(DOR_PAIRS)).not.toMatch(/dupla contagem/);
  });

  it("três linhas, cada uma com o seu mini-visual", () => {
    expect(DOR_PAIRS.map((p) => p.visual)).toEqual(["link", "roas", "barras"]);
  });

  it("os loops têm trava para reduzir movimento, e o estado-base é o final", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const base = css.slice(css.indexOf('/* ---- Dobra "Dor'));
    expect(base).toMatch(/\.dor-strike \{[^}]*background-size: 100% 2px/);
    expect(base).toMatch(/\.dor-prob \{[^}]*transform: scale\(0\.97\)/);
    expect(base).toMatch(/\.dor-sol \{[^}]*transform: scale\(1\.02\)/);
    expect(base).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.dor-dash/);
  });
});
