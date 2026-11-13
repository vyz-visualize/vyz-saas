// Funil dos modelos: as etapas, o texto de cada uma e o funil de compra da Meta.
// Puro: o widget, o visual Noturno e o armazém usam.

import type { AccountDayRow } from "@/features/analytics/types";

/**
 * Uma etapa. `pct`: a etapa sobre a primeira (dá o tamanho do desenho). `count`: o número da
 * etapa, quando vem das contas; com ele, cada etapa mostra a passagem sobre a anterior.
 */
export type FunnelStep = { label: string; pct: number; count?: number };

const fmt = (min: number, max: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });
const PCT_SMALL = fmt(2, 2);
const PCT_MID = fmt(0, 2);
const PCT_BIG = fmt(0, 1);
const INT = fmt(0, 0);

/**
 * Porcentagem do funil em pt-BR. Abaixo de 1%, sempre duas casas ("0,03%"); até 10%, até
 * duas ("8,12%"); acima, até uma ("41,3%"). Nunca "0%" quando há alguém na etapa: "<0,01%".
 */
export function funnelPct(v: number, someone = v > 0): string {
  if (!(v > 0) || !Number.isFinite(v)) return someone ? "<0,01%" : "0%";
  if (v < 0.005) return "<0,01%";
  if (v < 1) return `${PCT_SMALL.format(v)}%`;
  if (v < 10) return `${PCT_MID.format(v)}%`;
  return `${PCT_BIG.format(v)}%`;
}

/** Passagem da etapa i sobre a anterior, em %. Sem a anterior (ou zerada), null. */
export function stepRate(steps: readonly FunnelStep[], i: number): number | null {
  if (i <= 0) return null;
  const prev = steps[i - 1];
  const cur = steps[i];
  if (prev.count != null && cur.count != null) return prev.count > 0 ? (cur.count / prev.count) * 100 : null;
  return prev.pct > 0 ? (cur.pct / prev.pct) * 100 : null;
}

export type FunnelRow = { label: string; value: number; display: string; note?: string };

/**
 * O texto de cada etapa. Com os números das contas: a primeira mostra o total e as outras a
 * passagem sobre a anterior ("8,12%"), com "312 de 3.842" embaixo. Sem eles (amostra, GA4):
 * a etapa sobre a primeira e quanto avança da anterior.
 */
export function funnelRows(steps: readonly FunnelStep[], firstNote?: string): FunnelRow[] {
  return steps.map((s, i) => {
    const rate = stepRate(steps, i);
    if (s.count != null) {
      const prev = steps[i - 1];
      return {
        label: s.label,
        value: s.pct,
        // etapa anterior zerada: sem passagem para medir ("0%" quando esta também está zerada)
        display: i === 0 ? INT.format(s.count) : rate == null ? (s.count > 0 ? "—" : "0%") : funnelPct(rate, s.count > 0),
        note: i === 0 ? firstNote : prev?.count != null ? `${INT.format(s.count)} de ${INT.format(prev.count)}` : undefined,
      };
    }
    return { label: s.label, value: s.pct, display: funnelPct(s.pct), note: i === 0 ? firstNote : rate == null ? undefined : `${funnelPct(rate)} avançam` };
  });
}

/** Leitura para quem não vê o desenho. */
export function funnelSummary(title: string, steps: readonly FunnelStep[]): string {
  const rows = funnelRows(steps);
  const counted = steps.some((s) => s.count != null);
  return `${title}: ${rows.map((r, i) => (counted && i > 0 ? `${r.label} ${r.display} da etapa anterior` : `${r.label} ${r.display}`)).join(", ")}.`;
}

const META_STAGES = [
  { key: "linkClicks", label: "Cliques no link" },
  { key: "landingPageViews", label: "Visualizações da página" },
  { key: "addToCart", label: "Carrinho" },
  { key: "initiateCheckout", label: "Checkout" },
  { key: "conversions", label: "Compras" },
] as const;

/**
 * O funil de compra da Meta no período: cliques no link → visualizações da página → carrinho
 * → checkout → compras (as compras são o omni_purchase, como no resto do VYZ). Etapa do meio
 * zerada com etapas seguintes preenchidas não é medida (pixel sem o evento): sai do funil.
 * Sem cliques no link, vazio (fica o funil padrão).
 */
export function metaPurchaseFunnel(rows: readonly AccountDayRow[], range: { from: string; to: string }): FunnelStep[] {
  const totals = META_STAGES.map(({ key, label }) => ({
    label,
    count: rows.reduce((a, r) => (r.date >= range.from && r.date <= range.to ? a + (Number(r[key]) || 0) : a), 0),
  }));
  const top = totals[0].count;
  if (top <= 0) return [];
  const last = totals.length - 1;
  const kept = totals.filter((s, i) => i === 0 || i === last || s.count > 0 || !totals.slice(i + 1).some((n) => n.count > 0));
  return kept.map((s) => ({ label: s.label, count: Math.round(s.count), pct: (s.count / top) * 100 }));
}
