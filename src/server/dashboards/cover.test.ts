import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { coverPath } from "./cover";

const WS = "7b1c2d3e-0000-4000-8000-000000000001";

describe("arquivo da capa", () => {
  it("só vale o arquivo da pasta deste workspace, com o nome que o servidor gera", () => {
    expect(coverPath(WS, { path: `${WS}/capa-0123456789abcdef.png` })).toBe(`${WS}/capa-0123456789abcdef.png`);
    for (const path of [`7b1c2d3e-0000-4000-8000-000000000002/capa-0123456789abcdef.png`, `${WS}/../x/capa-0123456789abcdef.png`, `${WS}/logo-0123456789abcdef.png`, `${WS}/capa-0123456789abcdef.svg`, ""]) expect(coverPath(WS, { path })).toBeNull();
    for (const raw of [null, {}, { path: 3 }, "x"]) expect(coverPath(WS, raw)).toBeNull();
  });
});
