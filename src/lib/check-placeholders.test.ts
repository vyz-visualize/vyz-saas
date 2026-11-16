// O verificador do postbuild (scripts/build/check-placeholders.ts): marcadores de texto pendente
// como "[ANOS]" não podem chegar ao build de produção.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { findPlaceholders, isStrict, MARKERS } from "../../scripts/build/check-placeholders";

const dir = mkdtempSync(join(tmpdir(), "vyz-placeholders-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("marcadores de texto pendente no build", () => {
  it("o [ANOS] da dobra Diferenciais está na lista", () => {
    expect(MARKERS).toContain("[ANOS]");
  });

  it("acha o marcador no HTML e no JS do build, em qualquer pasta", () => {
    mkdirSync(join(dir, "app", "pagina"), { recursive: true });
    writeFileSync(join(dir, "app", "index.html"), "<p>Gestores de tráfego</p><p>[ANOS] de mídia paga</p>");
    writeFileSync(join(dir, "app", "pagina", "chunk.js"), 'const x = "[ANOS] de mídia paga";');
    writeFileSync(join(dir, "app", "pagina", "limpo.js"), 'const x = "12 anos de mídia paga";');
    writeFileSync(join(dir, "app", "imagem.png"), "[ANOS]");
    const hits = findPlaceholders(dir).map((h) => h.file.slice(dir.length + 1)).sort();
    expect(hits).toEqual(["app/index.html", "app/pagina/chunk.js"]);
  });

  it("sem marcador, ou sem a pasta, não acha nada", () => {
    expect(findPlaceholders(join(dir, "nao-existe"))).toEqual([]);
  });

  it("falha só no deploy de produção (ou com STRICT_PLACEHOLDERS=1)", () => {
    expect(isStrict({ VERCEL_ENV: "production" })).toBe(true);
    expect(isStrict({ STRICT_PLACEHOLDERS: "1" })).toBe(true);
    expect(isStrict({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isStrict({})).toBe(false);
  });
});
