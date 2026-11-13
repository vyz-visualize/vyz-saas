// Blocos de cada visual próprio (skin) e a disposição padrão deles na grade de 12
// colunas. A moldura do desenho (fundo, menu, topo) fica fixa; estes blocos são o que
// a pessoa move e redimensiona no Personalizar. Puro: painel e servidor usam igual.

import type { SkinId } from "@/features/templates/types";
import type { PageGrid } from "../layout/model";

/** `card`: bloco que é só um número (ou uma barra de filtros). No encaixe da tela, a fileira dele tem altura fixa e não cresce. */
export type SkinBlock = { id: string; label: string; x: number; y: number; w: number; h: number; card?: boolean };

const b = (id: string, label: string, x: number, y: number, w: number, h: number): SkinBlock => ({ id, label, x, y, w, h });
const c = (id: string, label: string, x: number, y: number, w: number, h: number): SkinBlock => ({ id, label, x, y, w, h, card: true });

export const SKIN_BLOCKS: Record<SkinId, SkinBlock[]> = {
  lavanda: [
    b("s-cpa", "Custo por venda", 0, 0, 3, 9),
    b("s-receita", "Receita por semana", 3, 0, 3, 9),
    b("s-roas", "ROAS médio", 6, 0, 3, 9),
    b("s-plataformas", "Investimento por plataforma", 9, 0, 3, 9),
    c("s-filtros", "Filtros", 0, 9, 12, 2),
    b("s-campanhas", "Campanhas no período", 0, 11, 12, 16),
  ],
  pulso: [
    b("s-visao", "Visão geral", 0, 0, 8, 14),
    b("s-melhor", "Melhor campanha", 8, 0, 4, 4),
    b("s-custo", "Custo por lead", 8, 4, 4, 10),
    b("s-prog1", "Campanha 1", 0, 14, 4, 9),
    b("s-prog2", "Campanha 2", 4, 14, 4, 9),
    b("s-prog3", "Campanha 3", 8, 14, 4, 9),
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
    b("s-vendas", "Receita e investimento", 0, 6, 8, 12),
    b("s-canais", "Receita por canal", 8, 6, 4, 12),
    b("s-funil", "Funil de compra", 0, 18, 5, 11),
    b("s-produtos", "Produtos que mais vendem", 5, 18, 4, 11),
    b("s-campanhas", "Campanhas", 9, 18, 3, 11),
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

/**
 * Tira da grade os blocos sem nada para mostrar (com dados reais, nenhum bloco aparece vazio)
 * e passa o espaço ao vizinho da mesma fileira: o da esquerda cresce para a direita; sem ele,
 * o da direita cresce para a esquerda. Sem vizinho na fileira, a grade fecha o buraco por baixo.
 * Não muda o layout salvo: é só o que a tela desenha.
 */
export function withoutBlocks(items: PageGrid, hidden: readonly string[]): PageGrid {
  if (!hidden.length) return items;
  let out = items.map((it) => ({ ...it }));
  for (const id of hidden) {
    const gone = out.find((it) => it.id === id);
    if (!gone) continue;
    out = out.filter((it) => it.id !== id);
    // mesma fileira: cobre toda a altura do bloco que saiu
    const sameRow = (it: (typeof out)[number]) => it.y <= gone.y && it.y + it.h >= gone.y + gone.h;
    const left = out.find((it) => sameRow(it) && it.x + it.w === gone.x);
    const right = out.find((it) => sameRow(it) && it.x === gone.x + gone.w);
    if (left) left.w += gone.w;
    else if (right) {
      right.x = gone.x;
      right.w += gone.w;
    }
  }
  return out;
}

export const skinGrid = (skin: SkinId): PageGrid => SKIN_BLOCKS[skin].map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
export const isSkinBlock = (skin: SkinId, id: string) => SKIN_BLOCKS[skin].some((s) => s.id === id);
/** O bloco é um card (altura fixa no encaixe da tela)? */
export const isSkinCard = (skin: SkinId, id: string) => !!SKIN_BLOCKS[skin].find((s) => s.id === id)?.card;

/** Visuais com moldura própria (topo, menu e fundo): tomam a tela do dashboard inteira, em todas as abas. */
export const FRAMED_SKINS: SkinId[] = ["lavanda", "pulso", "monocromo", "noturno", "areia"];
export const isFramedSkin = (skin: SkinId | undefined): boolean => !!skin && FRAMED_SKINS.includes(skin);
