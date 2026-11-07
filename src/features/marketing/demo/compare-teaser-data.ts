// Prévia do comparativo de criativos no site: dados fixos de amostra (fictícios), gerados
// uma vez com o comparativo do produto, com os anúncios da própria VYZ. Ficam fixos para o site não levar a lista de
// métricas, as fórmulas nem a tabela inteira; o teste confere o troféu e as diferenças.

export type TeaserAd = { id: string; name: string; short: string; headline: string; format: string; objective: string; campaign: string; art: "mascote" | "dashboard" };
export type TeaserCell = { text: string; best: boolean; diff: string | null };
export type TeaserRow = { id: "spend" | "ctr" | "cpa" | "roas"; label: string; better: "up" | "down" | null; cells: [TeaserCell, TeaserCell] };

export const TEASER_ADS: [TeaserAd, TeaserAd] = [
  { id: "120274493679687818", name: "VID · Pergunte ao VYZ 15s", short: "Pergunte ao VYZ 15s", headline: "Pergunte ao VYZ", format: "video", objective: "Vendas", campaign: "Prospecção · Gestores de tráfego", art: "mascote" },
  { id: "120269375499423830", name: "CAR · Pare de montar relatório na mão", short: "Pare de montar relatório", headline: "Pare de montar relatório na mão.", format: "carousel", objective: "Vendas", campaign: "Remarketing · Viu a demonstração", art: "dashboard" },
];

export const TEASER_ROWS: TeaserRow[] = [
  { id: "spend", label: "Investimento", better: null, cells: [{ text: "R$ 9.828", best: false, diff: null }, { text: "R$ 9.630", best: false, diff: null }] },
  { id: "ctr", label: "CTR (todos)", better: "up", cells: [{ text: "2,17%", best: false, diff: "−22% vs melhor" }, { text: "2,78%", best: true, diff: null }] },
  { id: "cpa", label: "Custo por compra", better: "down", cells: [{ text: "R$ 79,91", best: false, diff: "+76% vs melhor" }, { text: "R$ 45,43", best: true, diff: null }] },
  { id: "roas", label: "ROAS", better: "up", cells: [{ text: "3,30", best: false, diff: "−41% vs melhor" }, { text: "5,62", best: true, diff: null }] },
];
