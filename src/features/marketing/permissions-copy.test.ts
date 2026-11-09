import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNDO_WINDOW_COPY_DAYS } from "./permissions-copy";

// O VYZ pode aplicar mudanças nas campanhas (botão Aplicar e automático): o site não pode
// prometer só leitura. E o prazo de desfazer do texto é o mesmo do módulo de otimizações.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAGES = ["src/features/marketing/sections/ComoFunciona.tsx", "src/features/marketing/sections/Perguntas.tsx", "src/app/(legal)/termos/page.tsx", "src/app/(legal)/privacidade/page.tsx"];
const CONNECT = ["src/features/onboarding/ConnectStep.tsx", "src/features/integrations/providers.ts"];

describe("textos sobre permissão de acesso", () => {
  it("nenhuma página promete só leitura", () => {
    for (const p of PAGES) expect(read(p), p).not.toMatch(/só lê|só leitura|só com permissão de leitura|apenas para ler|não altera campanhas|não mexe/i);
  });

  it("a tela de conexão do painel também não promete só leitura", () => {
    for (const p of CONNECT) {
      expect(read(p), p).not.toMatch(/só lê|não mexe nas campanhas/i);
      expect(read(p), p).toContain("só altera campanhas quando você clica em Aplicar ou liga o automático");
    }
  });

  it("as páginas legais falam em leitura e alterações autorizadas", () => {
    for (const p of PAGES.slice(2)) expect(read(p).replace(/\s+/g, " "), p).toContain("leitura e as alterações autorizadas por");
  });

  it("o prazo de desfazer do texto é o do módulo de otimizações", () => {
    expect(read("src/server/optimize/service.ts")).toContain(`UNDO_DAYS = ${UNDO_WINDOW_COPY_DAYS}`);
    expect(read("src/features/marketing/sections/Perguntas.tsx")).toContain(`em até ${UNDO_WINDOW_COPY_DAYS} dias`);
  });
});
