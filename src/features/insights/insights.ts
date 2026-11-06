// Análises automáticas de um dashboard live: o que mudou, o que está indo bem
// e o que pede atenção, em frases curtas. Puro (testável): recebe os números
// já agregados (os mesmos da tela) e devolve a lista em ordem de importância.
// Nunca inventa número: cada frase sai de um valor do período.

import type { LiveDashboardData } from "@/features/analytics/types";

export type InsightTone = "good" | "bad" | "info";

export type Insight = {
  id: string;
  dashboardId: string;
  dashboardName: string;
  tone: InsightTone;
  /** Frase curta (título do cartão e da notificação). */
  title: string;
  /** Detalhe com os números. */
  body: string;
  /** KPI a destacar ao abrir o dashboard. */
  metric?: string;
  /** Campanha a filtrar ao abrir o dashboard. */
  campaignId?: string;
  /** Peso para ordenar (maior primeiro). */
  weight: number;
};

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function moneyFmt(currency: string) {
  const f = new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 });
  return (v: number | null) => (v === null ? "—" : f.format(v));
}
const pctFmt = (v: number, digits = 0) => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: digits }).format(v);
const ratio = (v: number) => v.toFixed(2).replace(".", ",");

function valueText(format: string, v: number | null, money: (v: number | null) => string): string {
  if (v === null) return "—";
  if (format === "money") return money(v);
  if (format === "pct") return pctFmt(v, 1);
  if (format === "ratio" || format === "decimal") return ratio(v);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
}

/** As análises de um dashboard, mais importantes primeiro. */
export function dashboardInsights(data: LiveDashboardData, limit = 6): Insight[] {
  if (data.status !== "ok") return [];
  const { view, currency } = data;
  const dashboardId = data.dashboard.id;
  const dashboardName = data.dashboard.name;
  const money = moneyFmt(currency);
  const days = data.current ? Math.round((Date.parse(data.current.to) - Date.parse(data.current.from)) / 86_400_000) + 1 : 0;
  const span = days ? `nos últimos ${days} dias` : "no período";
  const out: Insight[] = [];
  const push = (i: Omit<Insight, "dashboardId" | "dashboardName">) => out.push({ ...i, dashboardId, dashboardName });

  // 1. o que mais mudou entre os KPIs (contra o período anterior de mesmo tamanho)
  const moves = view.kpis
    .filter((k) => k.delta !== null && k.value !== null && k.previous !== null && k.better !== "neutral" && Math.abs(k.delta) >= 0.15)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    .slice(0, 2);
  for (const k of moves) {
    const up = k.delta! > 0;
    const good = (k.better === "up") === up;
    push({
      id: `kpi:${k.id}`,
      tone: good ? "good" : "bad",
      title: `${k.label}: ${up ? "alta" : "queda"} de ${pctFmt(Math.abs(k.delta!))}`,
      body: `Foi de ${valueText(k.format, k.previous, money)} para ${valueText(k.format, k.value, money)} ${span}, contra o período anterior.`,
      metric: k.id,
      weight: (good ? 50 : 70) + Math.min(30, Math.abs(k.delta!) * 30),
    });
  }

  const campaigns = view.campaigns.filter((c) => (c.spend ?? 0) > 0);

  // 2. verba sem retorno
  for (const c of campaigns.filter((c) => c.conversions === 0 && c.spendShare >= 0.1).slice(0, 2)) {
    push({
      id: `zero:${c.id}`,
      tone: "bad",
      title: `${c.name} gastou sem converter`,
      body: `${money(c.spend)} (${pctFmt(c.spendShare)} da verba) ${span}, sem nenhuma conversão. Vale revisar público, criativo ou pausar.`,
      campaignId: c.id,
      weight: 80 + c.spendShare * 20,
    });
  }

  // 3. abaixo do ponto de equilíbrio (com margem configurada)
  if (view.breakEvenRoas) {
    for (const c of campaigns.filter((c) => c.belowBreakEven && c.conversions > 0 && c.spendShare >= 0.1).slice(0, 2)) {
      push({
        id: `be:${c.id}`,
        tone: "bad",
        title: `${c.name} está abaixo do equilíbrio`,
        body: `ROAS ${c.roas !== null ? ratio(c.roas) : "—"} contra o equilíbrio de ${ratio(view.breakEvenRoas)}: cada real investido ali não se paga.`,
        campaignId: c.id,
        weight: 75 + c.spendShare * 20,
      });
    }
  }

  // 4. a campanha mais rentável (com volume para ser relevante)
  const best = campaigns.filter((c) => c.roas !== null && c.conversions >= 3 && c.spendShare >= 0.05).sort((a, b) => b.roas! - a.roas!)[0];
  const avgRoas = view.totals.roas;
  if (best && avgRoas && best.roas! > avgRoas * 1.2) {
    push({
      id: `best:${best.id}`,
      tone: "good",
      title: `${best.name} é a campanha mais rentável`,
      body: `ROAS ${ratio(best.roas!)}, contra ${ratio(avgRoas)} da conta, com ${pctFmt(best.spendShare)} da verba. Há espaço para escalar.`,
      campaignId: best.id,
      weight: 60 + Math.min(20, (best.roas! / avgRoas - 1) * 20),
    });
  }

  if (view.platform === "meta") {
    // 5. criativo cansado: frequência subindo e CTR caindo
    const tired = view.creatives.filter((c) => c.fatigue && c.fatigue.ctrChange <= -0.2 && (c.spend ?? 0) > 0).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0))[0];
    if (tired?.fatigue) {
      push({
        id: `fatigue:${tired.id}`,
        tone: "bad",
        title: `Criativo "${tired.name}" mostra cansaço`,
        body: `O CTR caiu ${pctFmt(Math.abs(tired.fatigue.ctrChange))} enquanto a frequência subiu ${pctFmt(Math.max(0, tired.fatigue.frequencyChange))}. Hora de renovar a peça.`,
        weight: 65,
      });
    }
    // 6. melhor criativo por ROAS
    const top = view.creatives.filter((c) => c.roas !== null && c.conversions >= 3).sort((a, b) => b.roas! - a.roas!)[0];
    if (top && view.creatives.length > 1) {
      push({ id: `creative:${top.id}`, tone: "good", title: `Melhor criativo: "${top.name}"`, body: `ROAS ${ratio(top.roas!)} com ${top.conversions} conversões ${span}.`, weight: 45 });
    }
    // 7. público que mais traz receita
    const cell = [...view.ageGender].filter((c) => c.valueShare > 0).sort((a, b) => b.valueShare - a.valueShare)[0];
    if (cell && cell.valueShare >= 0.2) {
      const who = cell.gender === "female" ? "Mulheres" : cell.gender === "male" ? "Homens" : "Pessoas";
      push({ id: "audience", tone: "info", title: `${who} de ${cell.age} trazem ${pctFmt(cell.valueShare)} da receita`, body: `É o público que mais compra ${span}${cell.roas !== null ? `, com ROAS ${ratio(cell.roas)}` : ""}.`, weight: 35 });
    }
  } else {
    // 5. termos de pesquisa que gastam sem converter
    if (view.wastedSpend && view.wastedShare >= 0.08) {
      const term = view.wastedTerms[0]?.term;
      push({
        id: "wasted",
        tone: "bad",
        title: `${money(view.wastedSpend)} em pesquisas sem conversão`,
        body: `${pctFmt(view.wastedShare)} da verba foi para termos que não venderam${term ? `, como "${term}"` : ""}. Negativar esses termos libera verba.`,
        weight: 78,
      });
    }
    // 6. perdendo impressões por orçamento
    const lost = view.impressionShare.lostBudget;
    if (lost !== null && lost >= 0.15) {
      push({ id: "lost-budget", tone: "info", title: `Você perde ${pctFmt(lost)} das impressões por orçamento`, body: "As campanhas de pesquisa param de aparecer antes do fim do dia. Se o ROAS está bom, há demanda para mais verba.", weight: 55 });
    }
    // 7. melhor horário
    const hot = [...view.heatmap].sort((a, b) => b.conversions - a.conversions)[0];
    if (hot && hot.conversions >= 3) {
      push({ id: "hour", tone: "info", title: `Pico de vendas: ${WEEKDAY[hot.weekday]}, ${hot.hour}h`, body: `É o horário com mais conversões ${span}. Bom momento para reforçar lances.`, weight: 30 });
    }
    // 8. produto campeão
    const product = view.products.filter((p) => p.valueShare > 0).sort((a, b) => b.valueShare - a.valueShare)[0];
    if (product && product.valueShare >= 0.15) {
      push({ id: `product:${product.id}`, tone: "info", title: `${product.title} puxa ${pctFmt(product.valueShare)} da receita`, body: `${money(product.value)} em vendas ${span}${product.roas !== null ? `, ROAS ${ratio(product.roas)}` : ""}.`, weight: 33 });
    }
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
