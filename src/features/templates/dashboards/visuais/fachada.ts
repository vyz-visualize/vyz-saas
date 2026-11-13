import type { PageId, PageLayout, WidgetSpec } from "../../types";
import type { Visual } from "../composed";

type Widget = WidgetSpec["type"];
const pick = <T extends Widget>(layout: PageLayout, type: T) => layout.widgets.find((w): w is Extract<WidgetSpec, { type: T }> => w.type === type);

/**
 * As abas padrão no Fachada, pensadas para a tela 16:9: os blocos fecham as 12 colunas
 * (sem buraco à direita) e cada fileira tem a altura que o gráfico pede. São os mesmos
 * blocos do sistema (Personalizar, filtros e dados reais continuam valendo); muda só a
 * arrumação. Aba que não está aqui fica com a disposição padrão.
 */
function layout(page: PageId, base: PageLayout, standard: (page: PageId) => PageLayout): PageLayout | null {
  // Meta Ads e Google Ads: o custo por resultado inteiro e o funil ao lado; a tabela embaixo, de ponta a ponta.
  // O ranking por campanha (ROAS ou custo) sai: a tabela já traz a mesma conta com o nome completo.
  if (page === "meta-ads" || page === "google-ads") {
    const line = pick(base, "line");
    const table = pick(base, "table");
    if (!line || !table) return null;
    return {
      kpis: base.kpis,
      widgets: [
        { ...line, span: 3, rows: 11 },
        { type: "funnel", span: 1, rows: 11, title: "Funil" },
        { ...table, span: 4, rows: 7 },
      ],
    };
  }
  // as abas de um bloco só (Público, Termos) ganham os números e a tendência da plataforma delas: nada de cartão vazio
  const line = pick(standard(page === "termos" ? "google-ads" : "meta-ads"), "line");
  if (!line) return null;
  if (page === "publico") {
    return {
      kpis: [{ metric: "ctr", sub: "delta" }, { metric: "cpm", sub: "delta" }, { metric: "frequency", sub: "delta" }, { metric: "cpa", sub: "goal", highlight: true }],
      widgets: [
        { type: "audience", span: 4, rows: 9, title: "Quem converte" },
        { ...line, span: 4, rows: 10 },
      ],
    };
  }
  if (page === "termos") {
    const table = pick(base, "table");
    if (!table) return null;
    return { kpis: base.kpis, widgets: [{ ...line, span: 4, rows: 10 }, { ...table, span: 4, rows: 8 }] };
  }
  return null;
}

/**
 * Fachada: Cinza de concreto com coral, capa com a imagem do empreendimento e medidores.
 * Pensado para lançamento imobiliário e geração de leads; nos outros objetivos, os números
 * da capa acompanham o objetivo (vendas, agendamentos...).
 */
export default {
  id: "fachada",
  name: "Fachada",
  skin: "fachada",
  tier: "avancado",
  description: "Cinza de concreto com coral: capa com a imagem do empreendimento e medidores.",
  layout,
} satisfies Visual;
