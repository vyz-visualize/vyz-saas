// Peças comuns dos visuais próprios (skins): números da amostra já prontos para
// desenhar e gráficos SVG simples, sem eixo, no estilo das referências.

import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { delta, series } from "@/features/metrics/compute";
import {
  formatValue,
  isSalesProfile,
  metric,
  type MetricId,
  type Profile,
} from "@/features/metrics/definitions";
import type { DayRow } from "@/features/metrics/source";
import type { PageId } from "@/features/templates/types";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import type { WidgetContext } from "../widgets/Widgets";
import type { SkinGridControl } from "./SkinGrid";

export type SkinProps = {
  ctx: WidgetContext;
  name: string;
  client: string;
  pages: PageId[];
  active: PageId;
  /** Troca de aba (sem isso, a navegação do visual fica só de enfeite: miniatura, PDF). */
  onPage?: (p: PageId) => void;
  periodLabel: string;
  /** Disposição dos blocos (salva e, no Personalizar do Avançado, editável). Sem isso, a padrão. */
  grid?: SkinGridControl;
  /** Controles do dashboard (período, comparar, personalizar, ações): o visual encaixa no topo dele. Sem isso (galeria, PDF), só o desenho. */
  controls?: React.ReactNode;
  /** Filtros ativos e a nota do período, logo abaixo dos controles. */
  note?: React.ReactNode;
  /** Conteúdo das outras abas (blocos padrão): o visual mantém a moldura e aplica o tema dele em volta. */
  children?: React.ReactNode;
  /** Tela do dashboard no painel: o visual vai de ponta a ponta (sem a moldura de fora, sem cantos) e ocupa a altura da tela. Sem isso (galeria, miniatura, PDF, link público), fica como cartão. */
  screen?: boolean;
  /** Barra da tela (voltar para a lista): o visual encaixa no topo dele, com a paleta dele. */
  bar?: React.ReactNode;
};

export const HIDDEN = "•••";

/** Valor formatado de uma métrica do período (respeita o investimento oculto). */
export function value(ctx: WidgetContext, id: MetricId, cur = ctx.cur): string {
  if (
    ctx.hideSpend &&
    (id === "spend" ||
      id === "cpa" ||
      id === "cpl" ||
      id === "cpc" ||
      id === "cpm" ||
      id === "roas" ||
      id === "cplq" ||
      id === "cpv")
  )
    return HIDDEN;
  return formatValue(cur[id], metric(id, ctx.profile).format);
}

export const label = (ctx: WidgetContext, id: MetricId) =>
  metric(id, ctx.profile).label;

export function money(
  ctx: WidgetContext,
  cents: number,
  compact = false,
): string {
  if (ctx.hideSpend) return HIDDEN;
  return compact ? brlCompact(cents) : brl(cents);
}

/** Variação contra o período anterior e se ela é boa. */
export function change(
  ctx: WidgetContext,
  id: MetricId,
): { text: string; up: boolean; good: boolean | null } {
  const d = delta(ctx.cur[id], ctx.prev[id]);
  const better = metric(id, ctx.profile).better;
  const good =
    better === "neutral" || !Number.isFinite(d) || d === 0
      ? null
      : d > 0 === (better === "up");
  return {
    text: Number.isFinite(d) ? pct(Math.abs(d)) : "—",
    up: d >= 0,
    good,
  };
}

/**
 * O que o visual mostra vem do objetivo do modelo, nunca dos números (com dados reais, toda
 * conversão também conta como lead). Vendas: vendas, custo por venda, receita e ROAS. Outros
 * objetivos: o resultado deles com o rótulo do objetivo ("Leads" e "Custo por lead",
 * "Agendamentos"...); no imobiliário, todos os leads (os qualificados vêm à parte).
 */
export function goalOf(profile: Profile, leads: number): { sales: boolean; conv: "conversions" | "leads"; cost: "cpa" | "cpl"; value: "revenue" | "conversions"; efficiency: "roas" | "convRate" } {
  const sales = isSalesProfile(profile);
  const allLeads = profile === "imob" && leads > 0;
  return { sales, conv: allLeads ? "leads" : "conversions", cost: allLeads ? "cpl" : "cpa", value: sales ? "revenue" : "conversions", efficiency: sales ? "roas" : "convRate" };
}

/** Dias do mais antigo para o mais recente. */
export const chrono = (rows: DayRow[]) =>
  [...rows].sort((a, b) => b.ago - a.ago);

export const daily = (ctx: WidgetContext, id: MetricId) =>
  series(chrono(ctx.ds.current), id);

/** Soma em n blocos seguidos (semanas, quinzenas). */
export function buckets(values: number[], n: number): number[] {
  const size = Math.max(1, Math.ceil(values.length / n));
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size)
    out.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
  return out;
}

export const platformName = (id: PlatformId) => PLATFORMS[id].name;
export const platformShort = (id: PlatformId) => PLATFORMS[id].short;

/** "Campanha Black Friday" → "CB". */
export function initials(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Data do ponto "ago" dias atrás, no formato curto (06/11). */
export function dayLabel(ago: number, today?: string): string {
  // sem o dia de hoje (miniatura, render no servidor), rótulo relativo: nada de relógio no render
  if (!today) return ago === 0 ? "hoje" : `−${ago}d`;
  const base = new Date(`${today}T12:00:00`);
  base.setDate(base.getDate() - ago);
  return `${String(base.getDate()).padStart(2, "0")}/${String(base.getMonth() + 1).padStart(2, "0")}`;
}

export { brl, decimal, int, pct };

// ---- gráficos -------------------------------------------------------------------------

/** Caminho suave (Catmull-Rom → Bézier) pelos pontos. */
export function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Pontos de uma série num retângulo w×h (com folga em cima e embaixo). */
export function fit(
  values: number[],
  w: number,
  h: number,
  pad = 0.12,
): [number, number][] {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, max);
  const span = max - min || 1;
  return values.map((v, i) => [
    values.length === 1 ? w / 2 : (i / (values.length - 1)) * w,
    h - (pad * h + ((v - min) / span) * h * (1 - 2 * pad)),
  ]);
}

// ---- peças das análises (seguem o tema do painel) -------------------------------------

/** Cores das séries que funcionam no claro e no escuro. */
export const SERIES = [
  "var(--accent)",
  "#6c8ebf",
  "#d08c60",
  "#9b7bc8",
  "#5fa8a0",
  "#c9a227",
];

/** No lugar de um bloco vazio: diz o que falta para ele aparecer (nenhum bloco fica em branco). */
export function Invite({ children }: { children: React.ReactNode }) {
  return (
    <p className="grid flex-1 place-items-center px-3 text-center text-[12.5px] leading-snug text-fg-2 [text-wrap:balance]" data-block-invite>
      {children}
    </p>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = "",
  fill = false,
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** O miolo (gráfico) ocupa a altura que o bloco tiver na grade e encolhe com ele no encaixe da tela. */
  fill?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-[14px] border border-line bg-card p-4 ${fill ? "fit-fill flex flex-col" : ""} ${className}`}
    >
      {(title || aside) && (
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {title && (
            <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
          )}
          {aside}
        </header>
      )}
      {fill ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </section>
  );
}

export function Stat({
  title,
  v,
  sub,
  tone,
}: {
  title: string;
  v: string;
  sub?: string;
  tone?: "good" | "bad" | null;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-line bg-card p-4">
      <p className="text-[11.5px] text-fg-2">{title}</p>
      <p className="mt-1 text-[24px] leading-tight font-bold tracking-tight tnum">
        {v}
      </p>
      {sub && (
        <p
          className={`mt-1 text-[11.5px] ${tone === "good" ? "text-accent" : tone === "bad" ? "text-error-fg" : "text-fg-2"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/** Pseudoaleatório estável (0–1) a partir de números. */
export function noise(...n: number[]): number {
  let h = 2166136261;
  for (const x of n) h = Math.imul(h ^ Math.round(x * 1000), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Função de distribuição da normal padrão. */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
