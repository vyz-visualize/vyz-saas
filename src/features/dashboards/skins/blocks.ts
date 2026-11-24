// Blocos de cada visual próprio (skin) e a disposição padrão deles na grade de 12
// colunas. A moldura do desenho (fundo, menu, topo) fica fixa; estes blocos são o que
// a pessoa move e redimensiona no Personalizar. Puro: painel e servidor usam igual.

import type { PageId, SkinId } from "@/features/templates/types";
import type { PageGrid } from "../layout/model";

/** `card`: bloco que é só um número (ou uma barra de filtros). No encaixe da tela, a fileira dele tem altura fixa e não cresce. */
export type SkinBlock = { id: string; label: string; x: number; y: number; w: number; h: number; card?: boolean };

const b = (id: string, label: string, x: number, y: number, w: number, h: number): SkinBlock => ({ id, label, x, y, w, h });
const c = (id: string, label: string, x: number, y: number, w: number, h: number): SkinBlock => ({ id, label, x, y, w, h, card: true });

export const SKIN_BLOCKS: Record<SkinId, SkinBlock[]> = {
  lavanda: [
    b("s-resumo", "Resumo do período", 0, 0, 12, 5),
    b("s-cpa", "Custo por venda", 0, 5, 3, 9),
    b("s-receita", "Receita por semana", 3, 5, 3, 9),
    b("s-roas", "ROAS médio", 6, 5, 3, 9),
    b("s-plataformas", "Investimento por plataforma", 9, 5, 3, 9),
    b("s-destaques", "Destaques do período", 0, 14, 12, 6),
    b("s-comparativo", "Este período e o anterior", 0, 20, 6, 11),
    b("s-cascata", "O que explica a variação", 6, 20, 6, 11),
    c("s-filtros", "Filtros", 0, 31, 12, 2),
    b("s-campanhas", "Campanhas no período", 0, 33, 12, 16),
  ],
  pulso: [
    b("s-visao", "Visão geral", 0, 0, 8, 14),
    b("s-melhor", "Melhor campanha", 8, 0, 4, 4),
    b("s-custo", "Custo por lead", 8, 4, 4, 10),
    b("s-ritmo", "Ritmo da verba no mês", 0, 14, 7, 10),
    b("s-ontem", "Ontem contra a semana", 7, 14, 5, 10),
    // o que pede ação saiu para a aba "Ações de hoje" e a lateral "Atenção agora"
    b("s-tabela", "Campanhas agora", 0, 24, 8, 16),
    b("s-ranking", "Ranking de campanhas", 8, 24, 4, 16),
  ],
  monocromo: [
    b("s-gantt", "Linha do tempo", 0, 0, 6, 12),
    b("s-tendencia", "Campanhas em andamento", 6, 0, 3, 12),
    b("s-criativo", "Melhor criativo", 9, 0, 3, 12),
    b("s-relatorios", "Relatórios", 0, 12, 3, 10),
    b("s-canais", "Canais", 3, 12, 9, 10),
  ],
  noturno: [
    c("s-receita", "Receita", 0, 0, 3, 6),
    c("s-invest", "Investimento", 3, 0, 3, 6),
    c("s-roas", "ROAS", 6, 0, 3, 6),
    c("s-cpa", "Custo por venda", 9, 0, 3, 6),
    // análise: a lista e o detalhe do escolhido (os produtos têm aba própria; o funil, a dele)
    b("s-analise", "Campanhas e o detalhe", 0, 6, 12, 18),
    b("s-calor", "Dia da semana e hora", 0, 24, 7, 11),
    b("s-fecha", "Onde o mês fecha", 7, 24, 5, 11),
  ],
  areia: [
    c("s-leads", "Leads", 0, 0, 3, 6),
    c("s-cpl", "Custo por lead", 3, 0, 3, 6),
    c("s-qualificados", "Leads qualificados", 6, 0, 3, 6),
    c("s-vendas", "Vendas no CRM", 9, 0, 3, 6),
    b("s-diario", "Leads por dia", 0, 6, 7, 12),
    b("s-crm", "Funil do CRM", 7, 6, 5, 12),
    b("s-origem", "De onde vêm os leads", 0, 18, 4, 11),
    b("s-verba", "Verba do mês", 4, 18, 3, 11),
    b("s-campanhas", "Custo por lead por campanha", 7, 18, 5, 11),
    b("s-calor", "Leads por dia da semana e hora", 0, 29, 12, 10),
  ],
  // a capa ocupa a largura toda (a imagem do empreendimento fica atrás, à direita); embaixo, os quatro medidores.
  // Os de dinheiro ficam intercalados: no link que esconde o investimento eles saem e os outros dois dividem a fileira ao meio.
  fachada: [
    b("s-capa", "Capa", 0, 0, 12, 13),
    b("s-resultado", "Resultado do período", 0, 13, 3, 10),
    b("s-verba", "Verba do mês", 3, 13, 3, 10),
    b("s-ritmo", "Ritmo por dia", 6, 13, 3, 10),
    b("s-custo", "Custo por resultado", 9, 13, 3, 10),
    // abaixo da primeira tela, em seções: o lançamento (planilha) e de onde vêm / quando chamam
    b("s-lancamento", "Lançamento", 0, 23, 12, 11),
    b("s-estados", "De onde vêm os resultados", 0, 34, 6, 11),
    b("s-horas", "Horário de pico", 6, 34, 6, 11),
  ],
  "criativos-ao-vivo": [
    c("s-stat0", "Investimento hoje", 0, 0, 3, 4),
    c("s-stat1", "Conversões hoje", 3, 0, 3, 4),
    c("s-stat2", "CTR hoje", 6, 0, 3, 4),
    c("s-stat3", "Custo hoje", 9, 0, 3, 4),
    b("s-ranking", "Ranking de criativos", 0, 4, 7, 22),
    b("s-duelo", "Duelo de criativos", 7, 4, 5, 14),
    b("s-fadiga", "Fadiga de criativo", 7, 18, 5, 8),
  ],
  previsao: [
    c("s-stat0", "Previstas no mês", 0, 0, 3, 4),
    c("s-stat1", "Custo previsto", 3, 0, 3, 4),
    c("s-stat2", "Chance de bater a meta", 6, 0, 3, 4),
    c("s-stat3", "Investimento previsto", 9, 0, 3, 4),
    b("s-projecao", "Projeção até o fim do mês", 0, 4, 12, 13),
    b("s-simulador", "Simulador de verba", 0, 17, 6, 8),
    b("s-anomalias", "Dias fora do padrão", 6, 17, 6, 8),
  ],
  mmm: [
    c("s-stat0", "Vinda da mídia", 0, 0, 3, 4),
    c("s-stat1", "Melhor ROI", 3, 0, 3, 4),
    c("s-stat2", "Ganho com a mesma verba", 6, 0, 3, 4),
    c("s-stat3", "Canais no modelo", 9, 0, 3, 4),
    b("s-decomposicao", "Decomposição por dia", 0, 4, 12, 11),
    b("s-curvas", "Curvas de resposta", 0, 15, 6, 13),
    b("s-tabela", "Contribuição e redistribuição", 6, 15, 6, 13),
  ],
};

export const skinGrid = (skin: SkinId): PageGrid => SKIN_BLOCKS[skin].map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
export const isSkinBlock = (skin: SkinId, id: string) => SKIN_BLOCKS[skin].some((s) => s.id === id);
/** O bloco é um card (altura fixa no encaixe da tela)? */
export const isSkinCard = (skin: SkinId, id: string) => !!SKIN_BLOCKS[skin].find((s) => s.id === id)?.card;

/** Visuais com moldura própria (topo, menu e fundo): tomam a tela do dashboard inteira, em todas as abas. */
export const FRAMED_SKINS: SkinId[] = ["lavanda", "pulso", "monocromo", "noturno", "areia", "fachada"];
export const isFramedSkin = (skin: SkinId | undefined): boolean => !!skin && FRAMED_SKINS.includes(skin);

/** Visuais com capa (imagem do empreendimento, endereço e planilha do lançamento na primeira aba). */
export const COVER_SKINS: SkinId[] = ["fachada"];
export const hasCoverSkin = (skin: SkinId | undefined): boolean => !!skin && COVER_SKINS.includes(skin);

/**
 * Abas que o próprio visual desenha (não ficam gravadas no dashboard: todo dashboard do visual
 * tem, inclusive os que já existiam). Entram logo depois da primeira aba.
 *   - Pulso: "Ações de hoje" (o que pede ação, com o detalhe);
 *   - Noturno: "Produtos" (só quando o catálogo vem: ranking com subiu/desceu e o detalhe).
 */
const SKIN_PAGES: Partial<Record<SkinId, readonly { page: PageId; when?: (d: { products: readonly unknown[] }) => boolean }[]>> = {
  pulso: [{ page: "acoes-hoje" }],
  noturno: [{ page: "produtos", when: (d) => d.products.length > 0 }],
};

export const isSkinPage = (skin: SkinId | undefined, page: PageId): boolean => !!skin && !!SKIN_PAGES[skin]?.some((o) => o.page === page);

/** As abas do dashboard com as do visual (depois da primeira). Sem os dados, todas as que o visual pode ter. */
export function skinTabs(skin: SkinId | undefined, pages: readonly PageId[], data?: { products: readonly unknown[] }): PageId[] {
  const own = ((skin && SKIN_PAGES[skin]) || []).filter((o) => !pages.includes(o.page) && (!data || !o.when || o.when(data))).map((o) => o.page);
  if (!own.length || !pages.length) return [...pages];
  return [pages[0], ...own, ...pages.slice(1)];
}
