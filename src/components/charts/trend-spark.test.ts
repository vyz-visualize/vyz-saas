// A mini tendência da bandeja é só a linha; os cards do dashboard continuam com a área.

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrendSpark } from "./TrendSpark";

vi.mock("./FitChart", () => ({
  FitChart: ({ children }: { children: (size: { width: number; height: number }) => unknown }) => children({ width: 100, height: 40 }),
}));

const html = (line?: boolean) => renderToString(createElement(TrendSpark, { values: [1, 3, 2, 4], line }));

describe("TrendSpark", () => {
  it("só a linha: sem área e sem o ponto do último dia", () => {
    const out = html(true);
    expect(out.match(/<path/g)).toHaveLength(1);
    expect(out).toContain('fill="none"');
    expect(out).not.toContain("<circle");
  });

  it("padrão: continua com a área e o ponto", () => {
    const out = html();
    expect(out.match(/<path/g)).toHaveLength(2);
    expect(out).toContain("<circle");
  });
});
