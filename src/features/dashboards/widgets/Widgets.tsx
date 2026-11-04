// Widgets do dashboard. Os mesmos componentes servem o gerador da LP, o passo 2
// de "Como funciona", as miniaturas, o painel e o link público: só muda o Dataset.

import type { CSSProperties, ReactNode } from "react";
import { BarList } from "@/components/charts/BarList";
import { Funnel } from "@/components/charts/Funnel";
import { LineChart } from "@/components/charts/LineChart";
import { Scatter } from "@/components/charts/Scatter";
import { Odometer, zeroed } from "@/components/ui/Odometer";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { byPlatform, currentTotals, delta, maturedAverage, previousTotals, series, type Totals } from "@/features/metrics/compute";
import { formatValue, isGood, metric, type MetricDef, type MetricId, type Profile } from "@/features/metrics/definitions";
import type { Dataset } from "@/features/metrics/source";
import type { KpiSpec, WidgetSpec } from "@/features/templates/types";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import { formatValue as formatLive } from "@/features/analytics/format";
import type { SampleExtraMetric } from "@/features/analytics/types";
import { filterAria, filterTone, NotFilteredBadge, useDashFilters, type FilterApi } from "@/features/analytics/filter-context";
import { activeDims, notFilteredText, rangeLabel, type DashFilters, type FilterDim } from "@/features/analytics/filters";
import { sampleRowDate } from "@/features/metrics/filter-dataset";
import { HideMetricButton } from "../MetricActions";
import { RemoveColumnButton, RemoveMetricButton, useMetricEditor } from "../metric-edit-context";
import { isSampleSpendDerived } from "../metric-prefs";

export type WidgetContext = {
  ds: Dataset;
  profile: Profile;
  cur: Totals;
  prev: Totals;
  /** Esconde valores de investimento (links compartilhados). */
  hideSpend?: boolean;
  /** Números zerados antes de rolar (montagem). */
  zero?: boolean;
  /** Marca a linha da meta para a intro da LP. */
  markGoal?: boolean;
  /** Texto no nome de cada card (" · Meta" na aba Criativos dos modelos com outras plataformas). */
  labelSuffix?: string;
  /** Comparação com o período anterior (variações nos KPIs). */
  compare?: boolean;
  /** Linha tracejada do período anterior nos gráficos de linha. */
  showPrevious?: boolean;
  /** Colunas visíveis das tabelas ("Personalizar"). Sem valor, todas. */
  visibleColumns?: ReadonlySet<string>;
  /** Com filtro: os números sem filtro, para o que o filtro não alcança. */
  base?: WidgetContext;
  /** Com filtro: o gráfico por dia mostra o período inteiro e destaca o trecho. */
  chart?: Pick<Dataset, "current" | "previous">;
  /** Com filtro: cartões e barras por plataforma, sem o próprio filtro. */
  platformsDs?: Dataset;
  /** Dia de hoje (YYYY-MM-DD): dá a data de cada ponto do gráfico. */
  today?: string;
};

export function makeContext(ds: Dataset, opts: Partial<WidgetContext> = {}): WidgetContext {
  return { ds, profile: ds.spec.profile, cur: currentTotals(ds), prev: previousTotals(ds), compare: true, ...opts };
}

const HIDDEN = "•••";
const short = (id: PlatformId) => PLATFORMS[id].short;

export function Card({ title, children, delay = 440, className = "", aside, note }: { title?: string; children: ReactNode; delay?: number; className?: string; aside?: ReactNode; /** Selo "não filtrado por". */ note?: string | null }) {
  return (
    <section className={`m-in min-w-0 rounded-[10px] border border-line bg-card p-3 ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {(title || aside) && (
        <header className="mb-2 flex items-baseline justify-between gap-2">
          {title && <h3 className="text-[11.5px] leading-snug font-semibold text-fg">{title}</h3>}
          {aside}
        </header>
      )}
      {note && (
        <p className="mb-2">
          <NotFilteredBadge text={note} />
        </p>
      )}
      {children}
    </section>
  );
}

function Delta({ cur, prev, id, profile, suffix = "" }: { cur: number; prev: number; id: MetricId; profile: Profile; suffix?: string }) {
  const d = delta(cur, prev);
  const good = isGood(d, metric(id, profile).better);
  const color = good === null ? "text-fg-2" : good ? "text-accent" : "text-error-fg";
  return (
    <span className={`font-semibold ${color}`}>
      {d >= 0 ? "▲" : "▼"} {pct(Math.abs(d))}
      {suffix}
    </span>
  );
}

// ---- KPI ------------------------------------------------------------------

export function Kpi({ spec, ctx, delay, size = "md", onHide, onRemove }: { spec: KpiSpec; ctx: WidgetContext; delay: number; size?: "md" | "lg"; /** Atalho de ocultar (só para quem pode editar). */ onHide?: () => void; /** Modo personalizar: o ✕. */ onRemove?: () => void }) {
  const lg = size === "lg";
  const { cur, prev, ds, profile } = ctx;
  const def = metric(spec.metric, profile);
  const label = `${def.label}${ctx.labelSuffix ?? ""}`;
  const hidden = ctx.hideSpend && spec.metric === "spend";
  const raw = formatValue(cur[spec.metric], def.format);
  const value = hidden ? HIDDEN : ctx.zero ? zeroed(raw) : raw;
  const strong = spec.highlight;
  const filters = useDashFilters();
  const filtered = !!ctx.base;

  let sub: ReactNode = null;
  switch (spec.sub) {
    case "delta":
      sub = ctx.compare ? <Delta cur={cur[spec.metric]} prev={prev[spec.metric]} id={spec.metric} profile={profile} suffix={filters?.compared ? ` vs ${rangeLabel(filters.compared)}` : " vs anterior"} /> : "no período";
      break;
    case "split": {
      const parts = byPlatform(ds).map((p) => `${short(p.id)} ${int(p.conv)}`);
      sub = parts.length ? parts.join(" · ") : "Confirmadas no GA4";
      break;
    }
    case "breakEven":
      sub = `Equilíbrio ${decimal(ds.breakEven)}`;
      break;
    case "ofLeads":
      sub = `de ${int(cur.leads || cur.conversions)} leads`;
      break;
    case "budget":
      // a verba do mês é da conta inteira: não dá para comparar com um recorte
      sub = filtered ? "no recorte" : hidden ? "da verba do mês" : `${pct(ds.budget.spent / ds.budget.monthly, 0)} da verba do mês`;
      break;
    case "goal":
      sub = `meta ${brl(ds.goal, { decimals: false })}`;
      break;
  }

  return (
    <div
      data-vyz-metric={spec.metric}
      data-edit-metric={spec.metric}
      className={`group/kpi m-in relative min-w-0 rounded-[10px] border ${lg ? "p-3.5" : "p-2.5"} ${strong ? "border-transparent bg-accent text-on-accent" : "border-line bg-card"}`}
      style={{ "--d": `${delay}ms` } as CSSProperties}
      title={def.help}
    >
      <p className={`min-h-[2.3em] leading-[1.15] font-medium tracking-[0.08em] uppercase ${lg ? "text-[11px]" : "text-[9.5px]"} ${strong ? "" : "text-fg-2"}`}>{label}</p>
      <p className={`mt-1 leading-none font-bold tracking-[-0.02em] ${lg ? "text-[22px] @[760px]:text-[26px]" : value.length > 10 ? "text-[15px] @[900px]:text-[18px]" : "text-[17px] @[900px]:text-[21px]"}`}>
        <Odometer value={value} />
      </p>
      <p className={`mt-1.5 leading-tight ${lg ? "text-[12px]" : "text-[10px]"} ${strong ? "[&_span]:text-inherit" : "text-fg-2"}`}>{sub}</p>
      {onHide && <HideMetricButton label={label} onClick={onHide} />}
      {onRemove && <RemoveMetricButton label={label} onClick={onRemove} />}
    </div>
  );
}

/** Card de métrica nova nas amostras: o valor vem do servidor, na escala do modelo. */
export function ExtraKpi({ m, ctx, delay, onHide, onRemove }: { m: SampleExtraMetric; ctx: WidgetContext; delay: number; onHide?: () => void; onRemove?: () => void }) {
  const d = m.value != null && m.previous ? delta(m.value, m.previous) : null;
  const good = d == null || m.better === "neutral" ? null : m.better === "up" ? d >= 0 : d <= 0;
  const color = good === null ? "text-fg-2" : good ? "text-accent" : "text-error-fg";
  return (
    <div className="group/kpi m-in relative min-w-0 rounded-[10px] border border-line bg-card p-2.5" style={{ "--d": `${delay}ms` } as CSSProperties} data-vyz-metric={m.id} data-edit-metric={m.id}>
      <p className="min-h-[2.3em] text-[9.5px] leading-[1.15] font-medium tracking-[0.08em] text-fg-2 uppercase">{m.label}</p>
      <p className="mt-1 text-[18px] leading-none font-bold tracking-[-0.02em] tnum">{formatLive(m.value, m.format)}</p>
      <p className="mt-1.5 text-[10px] leading-tight text-fg-2">
        {ctx.compare && d != null ? (
          <span className={`font-semibold ${color}`}>
            {d >= 0 ? "▲" : "▼"} {pct(Math.abs(d))} vs anterior
          </span>
        ) : (
          "no período"
        )}
      </p>
      {onHide && <HideMetricButton label={m.label} onClick={onHide} />}
      {onRemove && <RemoveMetricButton label={m.label} onClick={onRemove} />}
    </div>
  );
}

// ---- widgets ----------------------------------------------------------------

/** Widgets do modelo sem campanha, anúncio nem dia: ficam no total, com o selo. */
const NO_DIMENSIONS: ReadonlySet<WidgetSpec["type"]> = new Set(["funnel", "scatter", "split", "goals", "audience", "compare", "crm", "alerts"]);

const isFixed = (spec: WidgetSpec) => NO_DIMENSIONS.has(spec.type) || (spec.type === "table" && spec.source !== "campaigns") || (spec.type === "bars" && spec.source !== "campaigns" && spec.source !== "platforms");

/** O que o widget não consegue respeitar, entre os filtros ativos. */
function widgetUnfiltered(spec: WidgetSpec, f: DashFilters): (FilterDim | "days")[] {
  const on = activeDims(f);
  if (isFixed(spec)) return on;
  if (spec.type === "table" || spec.type === "bars" || spec.type === "platforms") return on.filter((d) => d === "ads");
  if (spec.type === "creatives") return on.filter((d) => d === "campaigns" || d === "days");
  return [];
}

export function Widget({ spec, ctx: shown, delay }: { spec: WidgetSpec; ctx: WidgetContext; delay: number }) {
  const filters = useDashFilters();
  const ctx = isFixed(spec) && shown.base ? shown.base : shown;
  const note = filters ? notFilteredText(widgetUnfiltered(spec, filters.filters)) : null;
  const { ds, cur } = ctx;
  const title = spec.title;

  // investimento oculto: gráfico de custo ou ROAS permitiria recalcular o valor
  if (ctx.hideSpend) {
    if (spec.type === "line" && isSampleSpendDerived(spec.metric)) return null;
    if (spec.type === "bars" && spec.metric !== "conversions") return null;
  }

  switch (spec.type) {
    case "line": {
      const d = lineData(spec, ctx);
      return (
        <Card title={title} delay={delay} note={note}>
          <LineChart {...d} {...lineSelection(ctx, filters)} previous={ctx.showPrevious && prevRows(ctx).length === d.values.length ? series(prevRows(ctx), spec.metric) : undefined} markGoal={ctx.markGoal} />
        </Card>
      );
    }
    case "funnel":
      return (
        <Card title={title} delay={delay} note={note}>
          <Funnel steps={ds.funnel} title={title ?? "Funil"} />
        </Card>
      );
    case "scatter":
      return (
        <Card title={title} delay={delay} note={note} aside={<span className="text-[11px] text-fg-2">1 ponto = 1 empreendimento</span>}>
          <Scatter points={ds.projects} />
        </Card>
      );
    case "bars":
      return (
        <Card title={spec.reference === "goal" && title ? `${title} ${brl(ds.goal, { decimals: false })}` : title} delay={delay} note={note}>
          <BarsWidget spec={spec} ctx={ctx} />
        </Card>
      );
    case "split": {
      const plats = byPlatform(ds);
      const total = plats.reduce((a, p) => a + p.conv, 0);
      const max = Math.max(total, cur.conversions) || 1;
      return (
        <Card title={title} delay={delay} note={note}>
          <div className="space-y-2 text-[10.5px]" role="img" aria-label={`Plataformas atribuem ${int(total)}; confirmadas ${int(cur.conversions)}.`}>
            <div aria-hidden>
              <p className="mb-1 flex justify-between text-fg-2">
                <span>Soma do que as plataformas atribuem</span>
                <span className="font-semibold tnum text-fg">{int(total)}</span>
              </p>
              <div className="flex h-3 overflow-hidden rounded-[3px]" style={{ width: `${(total / max) * 100}%` }}>
                {plats.map((p, i) => (
                  <span key={p.id} className="h-full" style={{ width: `${(p.conv / (total || 1)) * 100}%`, background: ["var(--seq-b)", "var(--seq-c)", "var(--seq-d)", "var(--muted)"][i % 4] }} />
                ))}
              </div>
              <p className="mt-1 text-fg-2">{plats.map((p) => `${short(p.id)} ${int(p.conv)}`).join(" · ")}</p>
            </div>
            <div aria-hidden>
              <p className="mb-1 flex justify-between text-fg-2">
                <span>Confirmadas (sem dupla contagem)</span>
                <span className="font-semibold tnum text-accent">{int(cur.conversions)}</span>
              </p>
              <div className="h-3 rounded-[3px] bg-accent" style={{ width: `${(cur.conversions / max) * 100}%` }} />
            </div>
          </div>
        </Card>
      );
    }
    case "platforms":
      return (
        <Card title={title} delay={delay} note={note}>
          <PlatformCards ctx={ctx} />
        </Card>
      );
    case "table":
      return (
        <Card title={title} delay={delay} note={note}>
          <TableWidget source={spec.source} ctx={ctx} />
        </Card>
      );
    case "creatives":
      return (
        <Card title={title} delay={delay} note={note}>
          <Creatives ctx={ctx} />
        </Card>
      );
    case "goals":
      return (
        <Card title={title} delay={delay} note={note}>
          <Goals ctx={ctx} />
        </Card>
      );
    case "audience":
      return (
        <Card title={title} delay={delay} note={note}>
          <Audience ctx={ctx} />
        </Card>
      );
    case "compare":
      return (
        <Card title={title} delay={delay} note={note}>
          <Compare ctx={ctx} />
        </Card>
      );
    case "crm":
      return (
        <Card title={title} delay={delay} note={note}>
          <ul className="space-y-2" aria-label="Etapas do CRM">
            {ds.crm.map((s, i) => (
              <li key={s.stage} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 text-[11px]">
                <span className="text-fg">{s.stage}</span>
                <span className="h-3 rounded-[3px]" style={{ width: `${Math.max(3, (s.count / ds.crm[0].count) * 100)}%`, background: ["var(--seq-a)", "var(--seq-b)", "var(--seq-c)", "var(--seq-d)", "var(--accent)"][i] }} />
                <span className="text-right tnum">
                  <span className="font-semibold">{int(s.count)}</span>
                  <span className="ml-2 text-fg-2">{ctx.hideSpend ? "" : brlCompact(s.value)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      );
    case "alerts":
      return (
        <Card title={title} delay={delay} note={note}>
          <ul className="space-y-2">
            {ds.alerts.map((a) => (
              <li key={a.title} className="flex gap-2.5 rounded-[8px] border border-line bg-bg p-2.5">
                <span className={`mt-1 size-2 shrink-0 rounded-full ${a.level === "erro" ? "bg-error" : a.level === "atencao" ? "bg-warning" : "bg-info"}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-semibold text-fg">{a.title}</span>
                  <span className="block text-[10.5px] text-fg-2">{a.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      );
    case "audio":
      return (
        <Card title={title} delay={delay} note={note}>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-10 items-center gap-[3px] text-accent" aria-hidden>
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="w-[3px] rounded-full bg-current" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
              ))}
            </div>
            <p className="text-[13px] font-semibold text-fg">Em breve</p>
            <p className="max-w-sm text-[11.5px] text-fg-2">Pergunte em voz alta e ouça a leitura dos números do período.</p>
          </div>
        </Card>
      );
  }
}

type BarsSpec = Extract<WidgetSpec, { type: "bars" }>;

/** Dados das barras (mesmo cálculo no painel e no "Como funciona" da LP). */
export function barData(spec: BarsSpec, ctx: WidgetContext) {
  const { ds, profile, cur } = ctx;
  let items: { label: string; value: number; display: string }[] = [];
  const fmt = (v: number) =>
    spec.metric === "roas" ? decimal(v) : spec.metric === "conversions" ? int(v) : spec.metric === "spend" ? (ctx.hideSpend ? "" : brlCompact(v)) : brl(v);
  if (spec.source === "campaigns") {
    items = ds.campaigns.map((c) => {
      const v = spec.metric === "roas" ? c.revenue / c.spend : spec.metric === "cpa" ? c.spend / c.conversions : spec.metric === "conversions" ? c.conversions : c.spend;
      return { id: c.id, label: c.name, value: v, display: fmt(v) };
    });
  } else if (spec.source === "platforms") {
    items = byPlatform(ctx.platformsDs ?? ds).map((p) => {
      const v = spec.metric === "cpa" ? p.cpa : spec.metric === "conversions" ? p.conv : p.spend;
      return { id: p.id, label: PLATFORMS[p.id].name, value: v, display: fmt(v) };
    });
  } else {
    items = ds.clients.map((c) => {
      const v = spec.metric === "spend" ? c.spend : spec.metric === "cpa" ? c.spend / c.conversions : c.conversions;
      return { label: c.name, value: v, display: fmt(v) };
    });
  }
  const reference =
    spec.reference === "breakEven"
      ? { value: ds.breakEven, label: `equilíbrio ${decimal(ds.breakEven)}` }
      : spec.reference === "goal"
        ? { value: ds.goal, label: `alvo ${brl(ds.goal, { decimals: false })}` }
        : undefined;
  const better: "up" | "down" = spec.metric === "cpa" ? "down" : "up";
  const def = metric(spec.metric === "roas" ? "roas" : spec.metric === "cpa" ? "cpa" : spec.metric === "spend" ? "spend" : "conversions", profile);
  const summary = `${def.label} por item: ${items.map((i) => `${i.label} ${i.display}`).join(", ")}.${reference ? ` Referência: ${reference.label}.` : ""} Total do período: ${formatValue(cur[def.id], def.format)}.`;
  return { items, reference, better, summary };
}

const lineRows = (ctx: WidgetContext) => ctx.chart?.current ?? ctx.ds.current;
const prevRows = (ctx: WidgetContext) => ctx.chart?.previous ?? ctx.ds.previous;

/** Arrastar no gráfico filtra o trecho; o trecho filtrado aparece em destaque. */
function lineSelection(ctx: WidgetContext, filters: FilterApi | null) {
  const { today } = ctx;
  if (!filters || !today) return {};
  const dates = lineRows(ctx).map((r) => sampleRowDate(today, r.ago));
  const days = filters.filters.days;
  const from = days ? dates.indexOf(days.from) : -1;
  const to = days ? dates.indexOf(days.to) : -1;
  return {
    selection: from >= 0 && to >= 0 ? { from, to } : null,
    onSelectRange: filters.interactive ? (a: number, b: number) => filters.selectDays({ from: dates[a], to: dates[b] }) : undefined,
  };
}

function BarsWidget({ spec, ctx }: { spec: BarsSpec; ctx: WidgetContext }) {
  const filters = useDashFilters();
  const data = barData(spec, ctx);
  const dim: FilterDim | null = spec.source === "campaigns" ? "campaigns" : spec.source === "platforms" && ctx.ds.spec.sources.length > 1 ? "platforms" : null;
  if (!filters?.interactive || !dim) return <BarList {...data} />;
  return (
    <BarList
      {...data}
      action={{
        label: (it) => filterAria(dim, it.label),
        tone: (it) => filterTone(filters, dim, it.id ?? ""),
        onClick: (it, e) => filters.toggle(dim, it.id ?? "", it.label, e),
      }}
    />
  );
}

/** Dados da linha diária + média móvel (mesmo cálculo no painel e na LP). */
/** Rótulos do eixo Y: curtos, sem centavos. */
function axisFormat(format: MetricDef["format"]): (v: number) => string {
  switch (format) {
    case "brl":
      return (v) => brl(v, { decimals: false });
    case "brlCompact":
      return brlCompact;
    case "int":
      return (v) => int(Math.round(v));
    case "pct":
      return (v) => pct(v, v !== 0 && Math.abs(v) < 0.1 ? 1 : 0);
    case "decimal":
      return (v) => decimal(v, 1);
  }
}

export function lineData(spec: Extract<WidgetSpec, { type: "line" }>, ctx: WidgetContext) {
  const { ds, profile } = ctx;
  const rows = ctx.chart?.current ?? ds.current;
  const values = series(rows, spec.metric);
  const avg = maturedAverage(rows, spec.metric);
  const def = metric(spec.metric, profile);
  const goal = spec.goal ? ds.goal : undefined;
  const last = avg.filter(Number.isFinite).at(-1) ?? 0;
  const summary = `${def.label} diário dos últimos ${values.length} dias, com média móvel de 7 dias em ${formatValue(last, def.format)}${goal ? `, alvo de ${brl(goal)}` : ""}. Os últimos 3 dias estão em maturação.`;
  return { values, avg, goal, goalLabel: goal ? brl(goal, { decimals: false }) : undefined, maturingDays: 3, summary, ago: rows.map((r) => r.ago), formatY: axisFormat(def.format) };
}

function PlatformCards({ ctx }: { ctx: WidgetContext }) {
  const { ds, cur } = ctx;
  const plats = byPlatform(ctx.platformsDs ?? ds);
  const hasGa4 = ds.spec.sources.includes("ga4");
  const filters = useDashFilters();
  const clickable = !!filters?.interactive && plats.length > 1;
  return (
    <div className="grid gap-2 @[460px]:grid-cols-2 @[900px]:grid-cols-3">
      {plats.map((p) => (
        <div
          key={p.id}
          data-filter-tone={filterTone(filters, "platforms", p.id) ?? undefined}
          onClick={clickable ? (e) => !(e.target as Element).closest("button") && filters.toggle("platforms", p.id, PLATFORMS[p.id].name, e) : undefined}
          className={`rounded-[8px] border bg-bg p-2.5 text-[10.5px] ${clickable ? "cursor-pointer" : ""} ${filterTone(filters, "platforms", p.id) === "selected" ? "border-accent ring-1 ring-accent" : "border-line"} ${filterTone(filters, "platforms", p.id) === "dimmed" ? "opacity-45" : ""}`}
        >
          <p className="mb-1.5 text-[11px] font-semibold">
            {clickable ? (
              <button type="button" data-filter-item={p.id} aria-pressed={filterTone(filters, "platforms", p.id) === "selected"} aria-label={filterAria("platforms", PLATFORMS[p.id].name)} onClick={(e) => filters.toggle("platforms", p.id, PLATFORMS[p.id].name, e)} className="cursor-pointer rounded-[4px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {PLATFORMS[p.id].name}
              </button>
            ) : (
              PLATFORMS[p.id].name
            )}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tnum">
            <dt className="text-fg-2">Investimento</dt>
            <dd className="text-right font-semibold">{ctx.hideSpend ? HIDDEN : brlCompact(p.spend)}</dd>
            <dt className="text-fg-2">CTR</dt>
            <dd className="text-right font-semibold">{pct(p.ctr, 2)}</dd>
            <dt className="text-fg-2">Atribuídas</dt>
            <dd className="text-right font-semibold">{int(p.conv)}</dd>
            {!ctx.hideSpend && (
              <>
                <dt className="text-fg-2">Custo atribuído</dt>
                <dd className="text-right font-semibold">{brl(p.cpa)}</dd>
              </>
            )}
          </dl>
        </div>
      ))}
      {hasGa4 && (
        <div className="rounded-[8px] border border-line bg-bg p-2.5 text-[10.5px]">
          <p className="mb-1.5 text-[11px] font-semibold">GA4 · fonte de verdade</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tnum">
            <dt className="text-fg-2">Sessões</dt>
            <dd className="text-right font-semibold">{int(cur.sessions)}</dd>
            <dt className="text-fg-2">Conversões</dt>
            <dd className="text-right font-semibold text-accent">{int(cur.conversions)}</dd>
            <dt className="text-fg-2">Taxa de conversão</dt>
            <dd className="text-right font-semibold">{pct(cur.convRate, 2)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function TableWidget({ source, ctx }: { source: "campaigns" | "products" | "clients"; ctx: WidgetContext }) {
  const { ds, profile } = ctx;
  const editor = useMetricEditor();
  const filters = useDashFilters();
  const show = (id: string) => (!ctx.hideSpend || !isSampleSpendDerived(id as MetricId)) && (!ctx.visibleColumns || ctx.visibleColumns.has(id));
  const money = profile === "ecommerce" || profile === "marketplace" || profile === "executivo" || profile === "infoproduto" || profile === "site";
  // os rótulos variam por nicho: o cabeçalho volta para a métrica por aqui, para o ✕ do modo personalizar
  const columnOf: Record<string, string> = { Investimento: "spend", CTR: "ctr", ROAS: "roas", Receita: "revenue", Conversões: "conversions", CPA: "cpa", [metric("conversions", profile).label]: "conversions", [metric("cpa", profile).label]: "cpa" };
  let head: string[] = [];
  let rows: ReactNode[][] = [];
  if (source === "campaigns") {
    head = ["Campanha", "Plataforma", show("spend") ? "Investimento" : "", show("ctr") ? "CTR" : "", show("conversions") ? metric("conversions", profile).label : "", show("cpa") ? metric("cpa", profile).label : "", money && show("roas") ? "ROAS" : ""].filter(Boolean);
    rows = ds.campaigns.map((c) =>
      [
        c.name,
        PLATFORMS[c.platform]?.short ?? "—",
        show("spend") ? brlCompact(c.spend) : null,
        show("ctr") ? pct(c.clicks / Math.max(1, c.impressions), 2) : null,
        show("conversions") ? int(c.conversions) : null,
        show("cpa") ? brl(c.spend / c.conversions) : null,
        money && show("roas") ? decimal(c.revenue / c.spend) : null,
      ].filter((v) => v !== null),
    );
  } else if (source === "products") {
    head = ["Produto", "Vendidos", show("revenue") ? "Receita" : "", show("roas") ? "ROAS" : ""].filter(Boolean);
    rows = ds.products.map((p) => [p.name, int(p.sold), show("revenue") ? brlCompact(p.revenue) : null, show("roas") ? decimal(p.revenue / p.spend) : null].filter((v) => v !== null));
  } else {
    head = ["Cliente", show("spend") ? "Investimento" : "", show("conversions") ? "Conversões" : "", show("cpa") ? "CPA" : "", ctx.hideSpend ? "" : "Meta", ctx.hideSpend ? "" : "Status"].filter(Boolean);
    rows = ds.clients.map((c) => {
      const cpa = c.spend / c.conversions;
      const ratio = cpa / c.goal;
      const status = ratio <= 1 ? ["Na meta", "text-accent"] : ratio <= 1.15 ? ["Atenção", "text-warning"] : ["Fora da meta", "text-error-fg"];
      return [
        c.name,
        show("spend") ? brlCompact(c.spend) : null,
        show("conversions") ? int(c.conversions) : null,
        show("cpa") ? brl(cpa) : null,
        ctx.hideSpend ? null : brl(c.goal, { decimals: false }),
        ctx.hideSpend ? null : (
          <span key="s" className={`font-semibold ${status[1]}`}>
            {status[0]}
          </span>
        ),
      ].filter((v) => v !== null);
    });
  }
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] text-left text-[10.5px] tnum">
        <thead>
          <tr className="border-b border-line text-fg-2">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-1.5 font-medium ${i ? "text-right" : ""}`}>
                {h}
                {editor?.section === "columns" && editor.canRemoveColumn && columnOf[h] && <RemoveColumnButton label={h} onClick={() => editor.removeColumn(columnOf[h])} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const campaign = source === "campaigns" ? ds.campaigns[i] : undefined;
            const tone = campaign ? filterTone(filters, "campaigns", campaign.id) : null;
            const clickable = campaign && filters?.interactive ? campaign : null;
            return (
              <tr
                key={i}
                data-filter-tone={tone ?? undefined}
                onClick={clickable ? (e) => !(e.target as Element).closest("button") && filters!.toggle("campaigns", clickable.id, clickable.name, e) : undefined}
                className={`border-b border-line/60 last:border-0 ${clickable ? "cursor-pointer" : ""} ${tone === "selected" ? "bg-accent-soft/70" : tone === "dimmed" ? "opacity-45" : ""}`}
              >
                {r.map((cell, j) => (
                  <td key={j} className={`py-1.5 ${j ? "text-right" : "pr-2 font-medium text-fg"}`}>
                    {clickable && j === 0 ? (
                      <button type="button" data-filter-item={clickable.id} aria-pressed={tone === "selected"} aria-label={filterAria("campaigns", clickable.name)} onClick={(e) => filters!.toggle("campaigns", clickable.id, clickable.name, e)} className="cursor-pointer rounded-[4px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {cell}
                      </button>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TONES = ["#8A9A5B", "#6E9BC6", "#D9A441", "#C8B9A0", "#A3A69C"];

function Creatives({ ctx }: { ctx: WidgetContext }) {
  const { ds, profile } = ctx;
  const filters = useDashFilters();
  return (
    <ul className="grid grid-cols-2 gap-2 @[600px]:grid-cols-4">
      {ds.creatives.map((c) => {
        const ctr = c.clicks / Math.max(1, c.impressions);
        const cpa = c.conversions ? c.spend / c.conversions : NaN;
        return (
          <li
            key={c.id}
            data-filter-tone={filterTone(filters, "ads", c.id) ?? undefined}
            onClick={filters?.interactive ? (e) => !(e.target as Element).closest("button") && filters.toggle("ads", c.id, c.name, e) : undefined}
            className={`overflow-hidden rounded-[8px] border bg-bg ${filters?.interactive ? "cursor-pointer" : ""} ${filterTone(filters, "ads", c.id) === "selected" ? "border-accent ring-1 ring-accent" : "border-line"} ${filterTone(filters, "ads", c.id) === "dimmed" ? "opacity-45" : ""}`}
          >
            {/* miniatura geométrica (amostra) */}
            <div className="relative aspect-[4/3]" style={{ background: TONES[c.tone] }} aria-hidden>
              <span className="absolute inset-x-[18%] top-[22%] h-[18%] rounded-[3px] bg-black/15" />
              <span className="absolute inset-x-[18%] top-[48%] h-[8%] rounded-[3px] bg-white/35" />
              <span className="absolute bottom-2 left-2 rounded-chip bg-black/35 px-1.5 text-[9px] text-white">{c.format}</span>
            </div>
            <div className="p-2 text-[10px]">
              <p className="truncate font-semibold text-fg">
                {filters?.interactive ? (
                  <button type="button" data-filter-item={c.id} aria-pressed={filterTone(filters, "ads", c.id) === "selected"} aria-label={filterAria("ads", c.name)} onClick={(e) => filters.toggle("ads", c.id, c.name, e)} className="max-w-full cursor-pointer truncate rounded-[3px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {c.name}
                  </button>
                ) : (
                  c.name
                )}
              </p>
              <dl className="mt-1 grid grid-cols-3 gap-1 tnum">
                <div>
                  <dt className="text-fg-2">CTR</dt>
                  <dd className="font-semibold">{pct(ctr, 2)}</dd>
                </div>
                {!ctx.hideSpend && (
                  <div>
                    <dt className="text-fg-2">{profile === "video" ? "CPV" : "CPA"}</dt>
                    <dd className="font-semibold">{Number.isFinite(cpa) ? brl(cpa, { decimals: cpa < 100 }) : "—"}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-fg-2">Freq.</dt>
                  <dd className={`font-semibold ${c.frequency > 3 ? "text-warning" : ""}`}>{decimal(c.frequency)}</dd>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Goals({ ctx }: { ctx: WidgetContext }) {
  const { ds, cur } = ctx;
  const b = ds.budget;
  const pacing = b.day / b.daysInMonth;
  const used = b.spent / b.monthly;
  const projection = (b.spent / b.day) * b.daysInMonth;
  const targetConv = Math.round(b.monthly / ds.goal);
  const convToDate = Math.round(cur.conversions * (b.day / Math.max(1, ds.current.length)));
  const rows = [
    {
      label: "Verba do mês",
      value: used,
      marker: pacing,
      text: ctx.hideSpend ? `${pct(used, 0)} usado` : `${brlCompact(b.spent)} de ${brlCompact(b.monthly)}`,
      note: ctx.hideSpend ? `Dia ${b.day} de ${b.daysInMonth}` : `Projeção: ${brlCompact(projection)} · dia ${b.day} de ${b.daysInMonth}`,
      warn: used > pacing * 1.08,
    },
    {
      label: "Conversões",
      value: Math.min(1, convToDate / targetConv),
      marker: pacing,
      text: `${int(convToDate)} de ${int(targetConv)}`,
      // meta × conversões daria a verba: fica de fora com o investimento oculto
      note: ctx.hideSpend ? `Dia ${b.day} de ${b.daysInMonth}` : `Alvo de ${brl(ds.goal, { decimals: false })} por conversão`,
      warn: convToDate / targetConv < pacing * 0.9,
    },
    {
      hidden: ctx.hideSpend,
      label: "Custo por conversão",
      value: Math.min(1, ds.goal / Math.max(1, cur.cpa)),
      marker: 1,
      text: `${brl(cur.cpa)} · alvo ${brl(ds.goal, { decimals: false })}`,
      note: cur.cpa <= ds.goal ? "Dentro do alvo" : "Acima do alvo",
      warn: cur.cpa > ds.goal,
    },
  ];
  return (
    <ul className="space-y-3.5">
      {rows.filter((r) => !r.hidden).map((r) => (
        <li key={r.label} className="text-[10.5px]">
          <p className="flex justify-between gap-2">
            <span className="font-semibold text-fg">{r.label}</span>
            <span className="tnum text-fg">{r.text}</span>
          </p>
          <div className="relative mt-1.5 h-2.5 rounded-[3px] bg-line">
            <span className={`absolute inset-y-0 left-0 rounded-[3px] ${r.warn ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.min(100, r.value * 100)}%` }} />
            <span className="absolute -inset-y-1 w-0 border-l border-dashed border-fg-2" style={{ left: `${Math.min(100, r.marker * 100)}%` }} aria-hidden />
          </div>
          <p className="mt-1 text-fg-2">{r.note}</p>
        </li>
      ))}
      <li className="text-[10px] text-fg-2">A linha tracejada mostra onde o mês deveria estar hoje (pacing).</li>
    </ul>
  );
}

function Audience({ ctx }: { ctx: WidgetContext }) {
  const { ds, profile } = ctx;
  const max = Math.max(...ds.audience.map((a) => a.share));
  return (
    <div className="grid gap-4 @[600px]:grid-cols-[2fr_1fr]">
      <ul className="space-y-2" aria-label="Faixas de idade">
        {ds.audience.map((a) => (
          <li key={a.label} className={`grid items-center gap-2 text-[10.5px] tnum ${ctx.hideSpend ? "grid-cols-[3rem_1fr_auto]" : "grid-cols-[3rem_1fr_auto_auto]"}`}>
            <span className="text-fg-2">{a.label}</span>
            <span className="h-2.5 rounded-[3px] bg-accent" style={{ width: `${(a.share / max) * 100}%` }} />
            <span className="font-semibold">{pct(a.share, 0)}</span>
            {!ctx.hideSpend && <span className={`w-16 text-right ${a.cpa > ds.goal * 1.15 ? "text-error-fg" : "text-fg-2"}`}>{brl(a.cpa, { decimals: false })}</span>}
          </li>
        ))}
        <li className="text-[10px] text-fg-2">
          Participação nas {metric("conversions", profile).label.toLowerCase()}
          {ctx.hideSpend ? "." : " e custo por conversão."}
        </li>
      </ul>
      <div>
        <div className="flex h-3 overflow-hidden rounded-[3px]">
          {ds.gender.map((g, i) => (
            <span key={g.label} style={{ width: `${g.share * 100}%`, background: i ? "var(--seq-c)" : "var(--accent)" }} />
          ))}
        </div>
        <ul className="mt-2 space-y-1 text-[10.5px]">
          {ds.gender.map((g) => (
            <li key={g.label} className="flex justify-between">
              <span className="text-fg-2">{g.label}</span>
              <span className="font-semibold tnum">{pct(g.share, 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const COMPARE: Partial<Record<Profile, MetricId[]>> = {
  site: ["sessions", "convRate", "conversions", "revenue", "ticket"],
  leads: ["spend", "leads", "cpl", "qualified", "ctr"],
  imob: ["spend", "qualified", "cplq", "visits", "ctr"],
  video: ["spend", "views", "cpv", "viewRate", "clicks"],
};

function Compare({ ctx }: { ctx: WidgetContext }) {
  const { cur, prev, profile } = ctx;
  const ids = (COMPARE[profile] ?? ["spend", "conversions", "cpa", "revenue", "roas", "ctr"]).filter((id) => !(ctx.hideSpend && isSampleSpendDerived(id)));
  return (
    <table className="w-full text-[10.5px] tnum">
      <thead>
        <tr className="border-b border-line text-fg-2">
          <th scope="col" className="py-1.5 text-left font-medium">
            Métrica
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            Atual
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            Anterior
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            Variação
          </th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => {
          const def = metric(id, profile);
          return (
            <tr key={id} className="border-b border-line/60 last:border-0">
              <td className="py-1.5 font-medium text-fg">{def.label}</td>
              <td className="py-1.5 text-right font-semibold">{formatValue(cur[id], def.format)}</td>
              <td className="py-1.5 text-right text-fg-2">{formatValue(prev[id], def.format)}</td>
              <td className="py-1.5 text-right">
                <Delta cur={cur[id]} prev={prev[id]} id={id} profile={profile} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
