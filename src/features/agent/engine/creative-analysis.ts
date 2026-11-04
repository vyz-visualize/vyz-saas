// "Gerar análise" do comparativo: texto em linguagem simples, montado pelo motor
// local do VYZ só com os números calculados em compare.ts. Nunca inventa: métrica
// sem dado não entra no texto.

import { pct } from "@/lib/format";
import { formatMetric, metricById, objectiveHighlights, objectivesDiffer, objectivesOf, metricValue, type AdStats } from "@/features/analytics/creatives/compare";
import { OBJECTIVE_LABEL } from "@/features/analytics/creatives/objectives";

export type CreativeAnalysis = { perAd: { id: string; name: string; text: string }[]; comparison: string; text: string };

type Options = { hideSpend?: boolean; currency?: string };

function stat(s: AdStats, id: string, currency: string): string | null {
  const metric = metricById(id);
  if (!metric) return null;
  const v = metricValue(metric, s.sums, "total");
  return v == null ? null : formatMetric(metric, v, currency);
}

function adText(s: AdStats, { hideSpend, currency = "BRL" }: Options): string {
  const parts: string[] = [`${s.activeDays === 1 ? "Veiculou em 1 dia" : `Veiculou em ${s.activeDays} dias`} no período`];
  const add = (label: string, id: string, spend = false) => {
    if (spend && hideSpend) return;
    const v = stat(s, id, currency);
    if (v) parts.push(`${label} ${v}`);
  };
  add("com investimento de", "spend", true);
  add("impressões:", "impressions");
  add("CTR do link de", "linkCtr");
  switch (s.objective) {
    case "leads":
      add("leads:", "leads");
      add("custo por lead de", "cpl", true);
      break;
    case "engagement":
      add("engajamentos:", "engagement");
      add("custo por engajamento de", "costPerEngagement", true);
      break;
    default:
      add("compras:", "conversions");
      add("custo por compra de", "cpa", true);
      add("ROAS de", "roas", true);
  }
  add("hook rate de", "hookRate");
  let text = `${parts.join(", ")}.`;
  if (s.fatigue) {
    text += ` Mostra sinal de cansaço: da primeira para a segunda metade dos dias de veiculação, a frequência subiu ${pct(s.fatigue.frequencyChange, 0)} e o CTR caiu ${pct(Math.abs(s.fatigue.ctrChange), 0)}.`;
  }
  return text;
}

function comparisonText(stats: readonly AdStats[], opts: Options): string {
  const { currency = "BRL" } = opts;
  const highlights = objectiveHighlights(stats, "total", opts);
  if (objectivesDiffer(stats)) {
    const names = objectivesOf(stats)
      .map((o) => OBJECTIVE_LABEL[o])
      .join(" × ");
    const facts = highlights.flatMap((h) => {
      if (h.winner == null) return [];
      return [`em ${h.label}, ${h.metric.label.toLowerCase()} de ${h.text} (${stats[h.winner].ad.name})`];
    });
    return `Os objetivos são diferentes (${names}), então estes números servem de contexto, não para eleger um vencedor.${facts.length ? ` Como referência: ${facts.join("; ")}.` : ""}`;
  }
  const h = highlights[0];
  if (!h) return "Não há dados suficientes para comparar estes anúncios.";
  if (h.winner == null) return `Com o mesmo objetivo (${h.label}), os anúncios empataram em ${h.metric.label.toLowerCase()}, ou faltam dados para indicar o melhor.`;
  const best = stats[h.winner];
  const bestValue = metricValue(h.metric, best.sums, "total");
  const others = stats.flatMap((s, i) => {
    if (i === h.winner) return [];
    const v = metricValue(h.metric, s.sums, "total");
    if (v == null) return [];
    const diff = bestValue ? Math.abs(v - bestValue) / Math.abs(bestValue) : null;
    return [`${s.ad.name} (${formatMetric(h.metric, v, currency)}${diff == null ? "" : `, diferença de ${pct(diff, 0)}`})`];
  });
  return `Com o mesmo objetivo (${h.label}), o melhor ${h.metric.label.toLowerCase()} foi de ${best.ad.name}: ${h.text}${others.length ? `, contra ${others.join(" e ")}` : ""}.`;
}

export function creativeAnalysis(stats: readonly AdStats[], opts: Options = {}): CreativeAnalysis {
  const perAd = stats.map((s) => ({ id: s.ad.id, name: s.ad.name, text: adText(s, opts) }));
  const comparison = comparisonText(stats, opts);
  const text = [...perAd.map((a) => `${a.name}\n${a.text}`), `Comparação\n${comparison}`].join("\n\n");
  return { perAd, comparison, text };
}
