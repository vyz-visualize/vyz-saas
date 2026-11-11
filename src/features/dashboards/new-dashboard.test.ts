import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/dashboards/actions", () => ({ recordTemplateSearch: vi.fn(async () => ({ ok: true })), createDashboard: vi.fn(), updateDashboard: vi.fn() }));

import { NewDashboardAssistant } from "./NewDashboardAssistant";
import { TemplateGallery } from "./TemplateGallery";

const noop = () => {};

describe("galeria de modelos", () => {
  const html = renderToString(createElement(TemplateGallery, { tier: "avancado", enabledAccounts: { meta: 1 }, canCreate: true, onUse: noop, onAskAssistant: noop }));

  it("vem organizada em grupos", () => {
    expect(html).toContain("Com os dados das suas contas");
    expect(html).toContain("Visuais especiais");
    for (const c of ["E-commerce", "Leads", "Imobiliário", "Negócio local", "Agência", "Mídia", "Executivo"]) expect(html).toContain(`Padrão VYZ · ${c}`);
  });

  it("os três visuais especiais não se repetem nos grupos do padrão", () => {
    for (const name of ["Lavanda · Receita e campanhas", "Pulso · Leads e metas", "Monocromo · Gestão de campanhas"]) expect(html.split(`leading-snug font-semibold">${name}<`).length - 1, name).toBe(1);
  });

  it("tem busca, filtro de plataforma, filtro do plano e o atalho do assistente", () => {
    expect(html).toContain("Buscar por nome, negócio ou plataforma");
    expect(html).toContain("Todas as plataformas");
    expect(html).toContain("Só os do meu plano");
    expect(html).toContain("Pedir ao assistente");
  });

  it("abre direto na prévia quando o assistente manda", () => {
    const opened = renderToString(createElement(TemplateGallery, { tier: "avancado", enabledAccounts: {}, canCreate: true, onUse: noop, initialOpenId: "relatorio-executivo" }));
    expect(opened).toContain("Usar este template");
  });
});

describe("popup do assistente", () => {
  const props = { open: true, onBrowse: noop, tier: "avancado" as const, enabledAccounts: {}, onUse: noop, onPreview: noop };

  it("pergunta o que a pessoa quer e oferece procurar sozinha", () => {
    const html = renderToString(createElement(NewDashboardAssistant, { ...props, voice: true }));
    expect(html).toContain("Que dashboard você quer montar?");
    expect(html).toContain("Clique aqui para ver todos os modelos");
    expect(html).toContain("Falar em vez de digitar");
    expect(html).toContain("Loja virtual com Meta e Google");
  });

  it("sem voz no plano, o microfone avisa onde está disponível", () => {
    const html = renderToString(createElement(NewDashboardAssistant, { ...props, voice: false }));
    expect(html).toContain("Falar em vez de digitar (Disponível no Avançado)");
  });

  it("fechado não desenha nada", () => {
    expect(renderToString(createElement(NewDashboardAssistant, { ...props, open: false, voice: true }))).not.toContain("Que dashboard");
  });
});
