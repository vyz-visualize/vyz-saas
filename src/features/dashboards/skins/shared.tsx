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
import type { ClosedMonth } from "@/features/analytics/closed-month";
import type { Totals } from "@/features/metrics/compute";
import type { CardCreative } from "@/features/analytics/creatives/card-metrics";
import type { CreativesData } from "@/features/analytics/types";
import type { MmmReadinessData } from "@/features/mmm/readiness";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import type { CoverControl, LaunchSheetControl } from "../cover";
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
  /** Capa (visuais com capa, como o Fachada): a imagem e o endereço. Com onChange, a pessoa troca ali mesmo. */
  cover?: CoverControl;
  /** Planilha do lançamento (o funil de vendas que as plataformas não enxergam). */
  sheet?: LaunchSheetControl;
  /** Relatório (Lavanda): o atalho "Mês anterior fechado" e, com ele ativo, os totais do mês antes. */
  month?: MonthReport;
  /** Horas desde a última sincronização (dados reais). Sem isso, não há aviso de atraso. */
  syncHours?: number;
  /** Hora da última sincronização (ISO) e o fuso da conta: "atualizado às HH:MM". Sem isso (amostra), nada. */
  syncedAt?: string;
  timeZone?: string;
  /** Criativos para os cards (com as métricas escolhidas): a galeria do servidor ou os do dashboard; o nível do plano e os dados completos (comparativo). */
  cards?: { source: CardCreative[]; level: "list" | "gallery" | "compare" | null; data?: CreativesData; /** A fileira de cards da aba Criativos (a padrão), acima do jeito do visual. */ kpis?: React.ReactNode };
  /** MMM: com dados reais, o que falta para o modelo de cada cliente (null: não deu para ler); na amostra, o exemplo. */
  mmm?: { real: MmmReadinessData | null; /** No painel: para onde levam os botões de ligar fonte. No link público, sem botões. */ connectHref?: string } | { sample: true };
  /** Os números da aba aberta (nas abas de uma plataforma, só dela): os mesmos dos cards da aba. */
  pageCtx?: WidgetContext;
};

export type MonthReport = {
  info: ClosedMonth;
  /** O período na tela é o mês fechado. */
  active: boolean;
  /** Totais do mês antes dele (a comparação); null quando as linhas não cobrem o mês inteiro. */
  before: Totals | null;
  /** Troca o período para o mês fechado (sem isso: já está nele, não cabe ou não dá para trocar aqui). */
  select?: () => void;
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
