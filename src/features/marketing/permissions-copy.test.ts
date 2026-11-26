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

  it("a privacidade descreve o que o código faz e lista as permissões que ele pede", () => {
    const privacy = read("src/app/(legal)/privacidade/page.tsx").replace(/\s+/g, " ");
    expect(privacy).toContain("autoriza leitura e alterações");
    for (const p of PAGES) expect(read(p), p).not.toMatch(/somente (de )?leitura/i);
    // todas as permissões da Meta que o código usa (as da tela de conexão e a de leitura das interações do post)
    const providers = read("src/features/integrations/providers.ts");
    const organic = read("src/server/sync/live/organic.ts");
    const docs = read("docs/PLATAFORMAS.md");
    for (const scope of ["ads_read", "ads_management", "business_management", "pages_show_list", "read_insights", "pages_read_engagement", "instagram_basic", "instagram_manage_insights"]) {
      expect(providers).toContain(`scope: "${scope}"`);
      expect(privacy).toContain(`<code>${scope}</code>`);
      expect(docs).toContain(`\`${scope}\``);
    }
    expect(organic).toContain("pages_read_user_content");
    expect(privacy).toContain("<code>pages_read_user_content</code>");
    expect(docs).toContain("`pages_read_user_content`");
    expect(read("src/server/integrations/providers/google.ts")).toContain('["openid", "email", "profile", ADWORDS_SCOPE]');
    for (const scope of ["https://www.googleapis.com/auth/adwords", "openid", "email", "profile"]) expect(privacy).toContain(`<code>${scope}</code>`);
    expect(read("src/app/(legal)/exclusao-de-dados/page.tsx")).not.toMatch(/páginas conectadas/);
  });

  it("nenhum marcador da empresa aparece, e a exclusão tem o prazo de 30 dias", () => {
    for (const p of PAGES.slice(2)) expect(read(p), p).not.toMatch(/\{C\.(legalName|cnpj|address)\}/);
    expect(read("src/app/(legal)/exclusao-de-dados/page.tsx")).toContain("até <strong>30 dias</strong>");
  });

  it("o prazo de desfazer do texto é o do módulo de otimizações", () => {
    expect(read("src/server/optimize/service.ts")).toContain(`UNDO_DAYS = ${UNDO_WINDOW_COPY_DAYS}`);
    expect(read("src/features/marketing/sections/Perguntas.tsx")).toContain(`em até ${UNDO_WINDOW_COPY_DAYS} dias`);
  });
});
