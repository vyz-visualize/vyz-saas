// "Gerar análise" do comparativo: explica os números como para o cliente, só com o
// que compare.ts calculou. Regras do texto:
//   * cada métrica vem traduzida no que ela significa, sem jargão em inglês;
//   * números grandes abreviados (331,8 mil; R$ 6,7 mil);
//   * métrica sem dado não entra, e nada recomenda ação que os números não sustentam;
//   * alcance é média por dia: somar dias não dá pessoas únicas.

import { bestOf, metricById, metricValue, objectiveHighlights, objectivesDiffer, objectivesOf, shortName, type AdStats, type CompareMetric } from "@/features/analytics/creatives/compare";
import { OBJECTIVE_LABEL, type ObjectiveKey } from "@/features/analytics/creatives/objectives";
import { formatValue, money } from "@/features/analytics/format";
import { decimal, int, joinPt, pct } from "@/lib/format";

export type CreativeAnalysis = { perAd: { id: string; name: string; text: string }[]; comparison: string; text: string };

type Options = { hideSpend?: boolean; currency?: string };

// ---- números no texto -------------------------------------------------------------------------

/** 3,0 → "3": a casa decimal só aparece quando diz alguma coisa. */
const short = (v: number) => decimal(v, 1).replace(/,0$/, "");

/** 331826 → "331,8 mil"; 156000 → "156 mil"; 1300000 → "1,3 milhão"; abaixo de mil, inteiro. */
export function compactCount(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    const v = n / 1_000_000;
    return `${short(v)} ${Math.abs(v) < 2 ? "milhão" : "milhões"}`;
  }
  if (Math.abs(n) >= 1000) return `${short(n / 1000)} mil`;
  return int(n);
}

/** 6700 → "R$ 6,7 mil"; abaixo de mil, com centavos. */
export function compactMoney(v: number, currency = "BRL"): string {
  if (Math.abs(v) < 1000) return money(v, currency);
  const unit = money(0, currency).replace(/[\d.,\s]+$/u, "").trim();
  return `${unit} ${compactCount(v)}`;
}

export const plainPct = (v: number) => formatValue(v, "pct");

const value = (s: AdStats, id: string): number | null => {
  const metric = metricById(id);
  return metric ? metricValue(metric, s.sums, "total") : null;
};

/** "de cada 100 vezes, cerca de 2": escolhe a base em que o número fica inteiro e não zero. */
export function perExposure(rate: number): { base: number; count: number } | null {
  const per100 = Math.round(rate * 100);
  if (per100 >= 1) return { base: 100, count: per100 };
  const per1000 = Math.round(rate * 1000);
  return per1000 >= 1 ? { base: 1000, count: per1000 } : null;
}

// ---- cada anúncio -------------------------------------------------------------------------------

function deliverySentence(s: AdStats, { hideSpend, currency = "BRL" }: Options): string {
  const spend = hideSpend ? null : value(s, "spend");
  const shown = value(s, "impressions") ?? 0;
  const days = s.activeDays === 1 ? "1 dia de veiculação" : `${s.activeDays} dias de veiculação`;
  const start = spend != null ? `Com ${compactMoney(spend, currency)} de investimento, foi exibido` : "Foi exibido";
  let text = `${start} ${compactCount(shown)} vezes em ${days}`;
  const reach = value(s, "reach");
  const frequency = value(s, "frequency");
  if (reach != null) {
    text += ` e alcançou em média ${compactCount(reach)} pessoas por dia`;
    if (frequency != null) text += `, que viram o anúncio cerca de ${decimal(frequency, 1)} ${frequency >= 1.95 ? "vezes" : "vez"} por dia cada uma`;
  }
  return `${text}.`;
}

function clickSentence(s: AdStats): string | null {
  const ctr = value(s, "linkCtr");
  if (ctr == null) return null;
  const per = perExposure(ctr);
  if (!per) return `A taxa de cliques no link (CTR) foi de ${plainPct(ctr)}, ou seja, quase ninguém clicou.`;
  const clicks = per.count === 1 ? "cerca de 1 virou clique no link" : `cerca de ${int(per.count)} viraram clique no link`;
  return `A taxa de cliques no link (CTR) foi de ${plainPct(ctr)}: de cada ${int(per.base)} vezes que apareceu, ${clicks}.`;
}

function resultSentences(s: AdStats, { hideSpend, currency = "BRL" }: Options): string[] {
  const out: string[] = [];
  const cost = (id: string) => {
    const v = hideSpend ? null : value(s, id);
    return v == null ? null : money(v, currency);
  };
  const volume = (id: string, zero: string, build: (n: string, c: string | null) => string) => {
    const n = value(s, id);
    if (n == null) return;
    out.push(n > 0 ? build(compactCount(n), null) : zero);
  };
  switch (s.objective) {
    case "leads": {
      const c = cost("cpl");
      volume("leads", "Não gerou leads no período.", (n) => `Gerou ${n} ${n === "1" ? "lead" : "leads"}${c ? `, e cada lead custou em média ${c}` : ""}.`);
      break;
    }
    case "engagement": {
      const c = cost("costPerEngagement");
      volume("engagement", "Não recebeu interações no período.", (n) => `Recebeu ${n} interações com o post, como curtidas, comentários e compartilhamentos${c ? `, e cada interação custou em média ${c}` : ""}.`);
      break;
    }
    case "traffic": {
      const c = cost("cpcLink");
      volume("linkClicks", "Não levou cliques no link no período.", (n) => `Levou ${n} cliques no link${c ? `, e cada clique custou em média ${c}` : ""}.`);
      break;
    }
    case "awareness": {
      const c = cost("cpm");
      if (c) out.push(`Cada mil exibições custaram em média ${c}.`);
      break;
    }
    default: {
      const c = cost("cpa");
      volume("conversions", "Não registrou compras no período.", (n) => `Gerou ${n} ${n === "1" ? "compra" : "compras"}${c ? `, e cada compra custou em média ${c}` : ""}.`);
      const roas = hideSpend ? null : value(s, "roas");
      if (roas != null && roas > 0) out.push(`O retorno (ROAS) foi de ${decimal(roas, 2)}: cada ${money(1, currency).replace(",00", "")} investido voltou ${money(roas, currency)} em vendas.`);
    }
  }
  return out;
}

function adText(s: AdStats, opts: Options): string {
  const parts = [deliverySentence(s, opts), clickSentence(s), ...resultSentences(s, opts)];
  const hold = value(s, "hookRate");
  if (hold != null) {
    const shown = pct(hold, 0);
    parts.push(`A taxa de retenção nos primeiros 3 segundos foi de ${shown}: em ${shown} das exibições, a pessoa assistiu pelo menos 3 segundos do vídeo.`);
  }
  if (s.fatigue) {
    parts.push(`Mostra sinal de cansaço: da primeira para a segunda metade dos dias de veiculação, as pessoas passaram a ver o anúncio ${pct(s.fatigue.frequencyChange, 0)} mais vezes e a clicar ${pct(Math.abs(s.fatigue.ctrChange), 0)} menos.`);
  }
  return parts.filter(Boolean).join(" ");
}

// ---- comparação -----------------------------------------------------------------------------------

const quote = (s: AdStats) => `“${shortName(s.ad.name)}”`;

/** Quem foi melhor numa métrica, com os outros para contraste. null: sem vencedor único. */
function dimension(stats: readonly AdStats[], id: string, render: (winner: string, value: string, others: string) => string, format: (v: number) => string): { sentence: string; winner: AdStats } | null {
  const metric = metricById(id);
  if (!metric) return null;
  const values = stats.map((s) => metricValue(metric, s.sums, "total"));
  const { winners } = bestOf(values, metric.better);
  if (winners.length !== 1) return null;
  const i = winners[0];
  const others = stats.flatMap((s, x) => (x === i || values[x] == null ? [] : [`${format(values[x]!)} de ${quote(s)}`]));
  return { sentence: render(quote(stats[i]), format(values[i]!), joinPt(others)), winner: stats[i] };
}

const COST_DIMENSION: Partial<Record<ObjectiveKey, { id: string; phrase: string; closing: string }>> = {
  leads: { id: "cpl", phrase: "gerou leads mais baratos", closing: "mais leads por real investido" },
  engagement: { id: "costPerEngagement", phrase: "teve as interações mais baratas", closing: "mais interações por real investido" },
  traffic: { id: "cpcLink", phrase: "teve os cliques mais baratos", closing: "mais cliques por real investido" },
  awareness: { id: "cpm", phrase: "teve as exibições mais baratas", closing: "mais exibições por real investido" },
};

function sameObjective(stats: readonly AdStats[], { hideSpend, currency = "BRL" }: Options): string {
  const objective = stats[0].objective;
  const isSale = !COST_DIMENSION[objective];
  const sentences: string[] = [];
  const add = (d: { sentence: string } | null) => {
    if (d) sentences.push(d.sentence);
  };
  add(dimension(stats, "reach", (w, v, o) => `${w} alcançou mais pessoas: ${v} por dia, contra ${o}.`, compactCount));
  const ctr = dimension(stats, "linkCtr", (w, v, o) => `${w} teve mais cliques proporcionalmente: ${v} das exibições, contra ${o}.`, plainPct);
  add(ctr);

  let closing: string | null = null;
  if (!hideSpend) {
    const cost = COST_DIMENSION[objective];
    const best = cost
      ? dimension(stats, cost.id, (w, v, o) => `${w} ${cost.phrase}: ${v} cada, contra ${o}.`, (v) => money(v, currency))
      : dimension(stats, "cpa", (w, v, o) => `${w} vendeu mais barato: ${v} por compra, contra ${o}.`, (v) => money(v, currency));
    add(best);
    const roas = isSale ? dimension(stats, "roas", (w, v, o) => `${w} teve o melhor retorno: ROAS de ${v}, contra ${o}.`, (v) => decimal(v, 2)) : null;
    add(roas);
    if (roas) closing = `Na leitura geral, ${quote(roas.winner)} entregou mais vendas por real investido.`;
    else if (best && cost) closing = `Na leitura geral, ${quote(best.winner)} entregou ${cost.closing}.`;
    else if (best) closing = `Na leitura geral, ${quote(best.winner)} vendeu pelo menor custo.`;
  } else {
    const volume = isSale ? dimension(stats, "conversions", (w, v, o) => `${w} gerou mais compras: ${v}, contra ${o}.`, compactCount) : null;
    add(volume);
    if (volume) closing = `Na leitura geral, ${quote(volume.winner)} gerou mais compras no período.`;
    else if (ctr) closing = `Na leitura geral, ${quote(ctr.winner)} teve a maior proporção de cliques no link.`;
  }

  const tired = stats.filter((s) => s.fatigue);
  if (tired.length) sentences.push(`${joinPt(tired.map(quote))} ${tired.length === 1 ? "mostra" : "mostram"} sinal de cansaço, e isso pesa na leitura destes números.`);
  sentences.push(closing ?? "Na leitura geral, nenhum anúncio se destacou claramente nestes números.");
  return `Com o mesmo objetivo (${OBJECTIVE_LABEL[objective]}), dá para comparar direto. ${sentences.join(" ")}`;
}

function differentObjectives(stats: readonly AdStats[], opts: Options): string {
  const { currency = "BRL" } = opts;
  const names = objectivesOf(stats)
    .map((o) => OBJECTIVE_LABEL[o])
    .join(" × ");
  const show = (metric: CompareMetric, v: number) => (metric.format === "money" ? money(v, currency) : metric.format === "pct" ? plainPct(v) : compactCount(v));
  const facts = objectiveHighlights(stats, "total", opts).flatMap((h) => {
    if (h.winner == null) return [];
    const winner = stats[h.winner];
    const v = metricValue(h.metric, winner.sums, "total");
    return v == null ? [] : [`em ${h.label}, ${h.metric.label.toLowerCase()} de ${show(h.metric, v)} (${quote(winner)})`];
  });
  const tired = stats.filter((s) => s.fatigue);
  return [
    facts.length ? `Olhando só a métrica principal de cada objetivo: ${facts.join("; ")}.` : null,
    tired.length ? `${joinPt(tired.map(quote))} ${tired.length === 1 ? "mostra" : "mostram"} sinal de cansaço.` : null,
    `Como os objetivos são diferentes (${names}), estes números servem de contexto, não para eleger um vencedor.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function creativeAnalysis(stats: readonly AdStats[], opts: Options = {}): CreativeAnalysis {
  const perAd = stats.map((s) => ({ id: s.ad.id, name: s.ad.name, text: adText(s, opts) }));
  const comparison = !stats.length ? "Não há dados suficientes para comparar estes anúncios." : objectivesDiffer(stats) ? differentObjectives(stats, opts) : sameObjective(stats, opts);
  const text = [...perAd.map((a) => `${a.name}\n${a.text}`), `Comparação\n${comparison}`].join("\n\n");
  return { perAd, comparison, text };
}
