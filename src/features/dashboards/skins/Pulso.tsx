"use client";

// Visual "Pulso": painel de operação, escuro e com destaque vibrante. Barra lateral com as abas,
// a primeira aba densa (visão geral com a onda, custo, ritmo da verba, ontem contra a semana, a
// tabela de status das campanhas e o ranking), a aba "Ações de hoje" e, em todas as abas, a
// lateral "Atenção agora" (recolhível). Nas abas de cada plataforma, o status das campanhas
// dela; em Criativos, os que estão cansando primeiro (PulsoParts.tsx).
// Nada de número inventado: meta de custo e verba do mês só aparecem quando o dashboard tem
// (metrics/targets); sem elas, o bloco mostra outro dado real ou o convite para definir.

import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Camera,
  ChevronDown,
  ChevronRight,
  Filter,
  Flag,
  Gauge,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutList,
  Megaphone,
  PieChart,
  Search,
  Share2,
  Siren,
  Target,
  TrendingUp,
  Type,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DayRow } from "@/features/metrics/source";
import { BUDGET_INVITE, GOAL_INVITE, hasBudget, hasGoal } from "@/features/metrics/targets";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { ChartTheme, dayDates, FlowLines, SkinBar, SkinChrome, SkinPage, Spark, type SkinPalette } from "./bklit-blocks";
import { BulletBar, MoveTag, PacingChart } from "./extras";
import { FullName } from "./FullName";
import { campaignMovers, dayNotes, pacing, yesterdayVsWeek } from "./insights";
import { SkinGrid } from "./SkinGrid";
import { SkinCreatives } from "./CreativeViews";
import { PulsoFunnel } from "./TabViews";
import { ActionsPage, AttentionPanel, C, PlatformStatus, StatusTable, TiredStrip, TONE, useAttentionClosed } from "./PulsoParts";
import { PAGE_PLATFORM } from "@/features/templates/dashboards/composed";
import {
  buckets,
  change,
  chrono,
  dayLabel,
  decimal,
  goalOf,
  initials,
  int,
  label,
  money,
  value,
  type SkinProps,
} from "./shared";


// cores dos gráficos (Bklit UI) sobre o roxo: tooltip escuro, texto branco
const CHART: SkinPalette = { scheme: "dark", bg: "#2e1f78", card: "#5434d4", fg: "#ffffff", fg2: "rgb(255 255 255 / 0.75)", line: "rgb(255 255 255 / 0.25)", accent: "#ff7ab8", accentSoft: "#4a1f45", onAccent: "#ffffff", muted: "rgb(255 255 255 / 0.3)", error: "#ffd0c8", errorSoft: "#5a2a3a", good: "#8ff0b0" };

// controles e outras abas: os componentes padrão no escuro do visual, com o roxo de destaque
const PAGE: SkinPalette = { scheme: "dark", bg: C.frame, card: C.card, fg: C.fg, fg2: C.fg2, line: C.line, accent: "#8b6cff", accentSoft: "#2a2152", onAccent: "#ffffff", muted: "#3b3268", error: "#ff6b8b", errorSoft: "#3a1626", good: C.green };

/** Ícone de cada aba na barra lateral (o nome vai embaixo). */
const PAGE_ICON: Partial<Record<PageId, LucideIcon>> = {
  "visao-geral": Gauge,
  "acoes-hoje": Siren,
  "meta-ads": Megaphone,
  criativos: ImageIcon,
  publico: Users,
  "google-ads": Search,
  termos: Type,
  site: Globe,
  "canais-site": Share2,
  crm: Briefcase,
  instagram: Camera,
  "pagina-facebook": Flag,
  conteudo: LayoutList,
  "criativos-ao-vivo": Layers,
  previsao: TrendingUp,
  mmm: PieChart,
  metas: Target,
  comparativo: ArrowLeftRight,
  funil: Filter,
  campanhas: Megaphone,
};


/** Card escuro dos blocos novos, com título e a linha de apoio. */
function Card({ title, note, children, ...data }: { title: string; note?: React.ReactNode; children: React.ReactNode; "data-ritmo"?: number; "data-ontem"?: boolean }) {
  return (
    <section className="flex min-w-0 flex-col rounded-[22px] border p-4" style={{ background: C.card, borderColor: C.line }} {...data}>
      <header className="flex shrink-0 items-baseline justify-between gap-2">
        <h3 className="text-[14.5px] font-bold">{title}</h3>
        {note && <span className="truncate text-[11px]" style={{ color: C.fg2 }}>{note}</span>}
      </header>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function PulsoSkin({
  ctx,
  name,
  client,
  pages,
  active,
  onPage,
  periodLabel,
  grid,
  controls,
  note,
  children,
  screen,
  bar,
  syncHours,
  pageCtx,
  cards,
}: SkinProps) {
  // "Ações de hoje": a aba do próprio visual (a lateral some, a aba é ela por inteiro)
  const ownPage = active === "acoes-hoje" && !children;
  const closed = useAttentionClosed();
  const only = PAGE_PLATFORM[active];
  const platformTab = only && (active === "meta-ads" || active === "google-ads") ? only : null;
  const days = chrono(ctx.ds.current);
  // vendas, leads, agendamentos...: pelo objetivo do modelo
  const { sales, conv, cost } = goalOf(ctx.profile, ctx.cur.leads);
  const result = (d: DayRow) => d[conv];
  const [mode, setMode] = useState<"dia" | "semana">("semana");
  const points =
    mode === "dia"
      ? days.slice(-10).map(result)
      : buckets(
          days.map(result),
          10,
        );
  const labels =
    mode === "dia"
      ? days.slice(-10).map((d) => dayLabel(d.ago, ctx.today))
      : points.map((_, i) => `S${i + 1}`);
  // período anterior, no mesmo agrupamento (a linha clara atrás)
  const before = chrono(ctx.ds.previous);
  const prevPoints =
    mode === "dia"
      ? before.slice(-10).map(result)
      : buckets(
          before.map(result),
          10,
        );
  const size = Math.max(1, Math.ceil(days.length / 10));
  const pointDays = mode === "dia" ? days.slice(-10) : days.filter((_, i) => i % size === 0);
  const pointDates = dayDates(pointDays.map((d) => d.ago), ctx.today);
  const peak = points.indexOf(Math.max(...points));
  const [hover, setHover] = useState<number | null>(null);
  const mark = hover ?? peak;
  const campaigns = useMemo(
    () => [...ctx.ds.campaigns].sort((a, b) => b.conversions - a.conversions),
    [ctx.ds.campaigns],
  );
  const best = campaigns[0];
  const { budget } = ctx.ds;
  // dias que faltam no mês: só com a verba do mês definida (sem ela, não há prazo de verdade)
  const left = Math.max(0, budget.daysInMonth - budget.day);
  const withBudget = hasBudget(ctx.ds);
  const withGoal = hasGoal(ctx.ds);
  const costSeries = buckets(
    days.map((d) => d.spend),
    8,
  ).map(
    (s, i) =>
      s /
      Math.max(
        1,
        buckets(
          days.map(result),
          8,
        )[i],
      ),
  );
  // custo por resultado do período e meta de custo do dashboard (quando definida)
  const costNow = ctx.cur[cost];
  const costTrend = change(ctx, cost);
  const goalOk = withGoal ? costNow <= ctx.ds.goal : null;
  const convWord = label(ctx, "conversions").toLowerCase();
  const costWord = label(ctx, cost).replace(/^Custo por /i, "por ");

  // blocos de operação do dia: ritmo da verba, ontem, o que pede ação e o ranking
  const pace = useMemo(() => pacing(ctx.ds), [ctx.ds]);
  // (o React Compiler memoriza estes cálculos)
  const movers = campaignMovers(ctx.ds.campaigns, sales ? "revenue" : "conversions");
  const yday = [
    { label: "Investimento", check: yesterdayVsWeek(ctx.ds.current, (d) => d.spend), fmt: (v: number) => money(ctx, v, true), fmtMean: (v: number) => money(ctx, v, true), money: true },
    // contagem é inteira; só a média dos 7 dias pode ter casa decimal
    { label: label(ctx, conv), check: yesterdayVsWeek(ctx.ds.current, (d) => d[conv]), fmt: (v: number) => int(v), fmtMean: (v: number) => decimal(v, v < 10 ? 1 : 0), money: false },
  ];
  const notes = dayNotes(ctx.ds.current, (d) => d[conv], 2);

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div
      className={screen ? "@container flex min-h-dvh flex-col" : "@container rounded-[32px] p-3 @[700px]:p-8"}
      style={{ background: screen ? C.frame : C.bg, color: C.fg }}
      data-visual="pulso"
    >
      <SkinBar palette={PAGE} bar={bar} className="px-4 pt-3 @[700px]:px-5" />
      <div
        className={`grid overflow-hidden ${screen ? "flex-1" : "rounded-[28px] border"} ${ownPage ? "" : closed ? "@[1000px]:grid-cols-[minmax(0,1fr)_64px]" : "@[1000px]:grid-cols-[minmax(0,1fr)_300px]"}`}
        style={{ background: C.frame, borderColor: C.line }}
      >
        <div className={`flex min-w-0 gap-5 p-4 @[700px]:p-5 ${screen ? "pb-[var(--screen-pb,7rem)] @[700px]:pb-[var(--screen-pb,7rem)]" : ""}`}>
          {/* barra lateral: uma aba por página, com ícone e nome; com muitas, a lista rola dentro da barra.
              Na tela do dashboard fica no meio da altura da tela (uma coluna fixa da altura da tela, centralizada) */}
          <div className={screen ? "sticky top-0 hidden h-[calc(100dvh-5rem)] w-[88px] shrink-0 items-center self-start @[700px]:flex" : "contents"}>
          <aside
            className={`hidden w-[88px] shrink-0 flex-col items-center gap-2 rounded-[26px] py-4 text-white @[700px]:flex ${screen ? "max-h-full" : "sticky top-4 max-h-[calc(100dvh-2rem)] self-start"}`}
            style={{ background: C.side }}
          >
            <nav aria-label="Páginas" data-tour="abas" className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto overscroll-contain px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {pages.map((p) => {
                const Icon = PAGE_ICON[p] ?? BarChart3;
                const on = p === active;
                return (
                  <button
                    key={p}
                    type="button"
                    title={PAGES[p].name}
                    onClick={() => onPage?.(p)}
                    aria-current={on ? "page" : undefined}
                    className="flex w-full shrink-0 flex-col items-center gap-1 rounded-[14px] px-1 py-2 text-[9.5px] leading-tight transition-colors"
                    style={on ? { background: C.sideActive, boxShadow: "0 6px 20px rgba(123,92,255,.45)" } : { color: "rgb(255 255 255 / 0.72)" }}
                  >
                    <Icon size={18} aria-hidden />
                    <span className="line-clamp-2 w-full text-center break-words">{PAGES[p].name}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px]" style={{ color: C.fg2 }}>
                  {client}
                </p>
                <h2 className="truncate text-[20px] font-bold">{name}</h2>
              </div>
              {/* sem os controles (galeria, PDF), o período aparece só como etiqueta */}
              {!controls && (
                <span className="hidden h-10 max-w-[200px] items-center gap-2 rounded-[12px] border px-3 text-[12px] @[640px]:flex" style={{ background: C.card, borderColor: C.line, color: C.fg2 }}>
                  <span className="truncate">{periodLabel}</span>
                </span>
              )}
              <span className="grid size-10 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: C.purple }}>
                {initials(client)}
              </span>
            </div>

            {/* no celular a barra lateral some: as abas viram uma faixa que rola de lado */}
            {pages.length > 1 && (
              <nav aria-label="Páginas" className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @[700px]:hidden [&::-webkit-scrollbar]:hidden">
                {pages.map((p) => {
                  const Icon = PAGE_ICON[p] ?? BarChart3;
                  const on = p === active;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onPage?.(p)}
                      aria-current={on ? "page" : undefined}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium whitespace-nowrap"
                      style={on ? { background: C.purple, borderColor: "transparent", color: "#fff" } : { background: C.card, borderColor: C.line, color: C.fg2 }}
                    >
                      <Icon size={14} aria-hidden /> {PAGES[p].name}
                    </button>
                  );
                })}
              </nav>
            )}

            <SkinChrome palette={PAGE} controls={controls} note={note} screen={screen} className="mt-4" />

            {/* no estreito, a lateral "Atenção agora" vem depois do nome e das abas (antes dos blocos) */}
            {!ownPage && (
              <div className="mt-4 rounded-[22px] border p-4 @[1000px]:hidden" style={{ borderColor: C.line, background: "#0d0a18" }}>
                <AttentionPanel ctx={ctx} syncHours={syncHours} pages={pages} onPage={onPage} closed={closed} />
              </div>
            )}

            <div className="mt-5">
              {children ? (
                <>
                  {/* abas de uma plataforma: o status das campanhas dela; Criativos: os que estão cansando primeiro */}
                  {platformTab && campaigns.some((c) => c.platform === platformTab) && <PlatformStatus ctx={ctx} platform={platformTab} />}
                  {/* Funil: onde está o gargalo nos últimos 7 dias contra os 7 antes */}
                  {active === "funil" && <PulsoFunnel ctx={pageCtx ?? ctx} tone={{ card: C.card, line: C.line, fg: C.fg, fg2: C.fg2, bad: C.red, good: C.green }} />}
                  {/* Criativos: a fila de decisão (escalar, manter, pausar), com as métricas escolhidas nos cards */}
                  {active === "criativos" && cards && cards.level !== "list" ? (
                    <SkinPage palette={PAGE}>
                      <SkinCreatives kind="pulso" list={cards.source} data={cards.data} kpis={cards.kpis} />
                    </SkinPage>
                  ) : (
                    <>
                      {active === "criativos" && ctx.ds.creatives.length > 0 && <TiredStrip ctx={ctx} />}
                      <SkinPage palette={PAGE}>{children}</SkinPage>
                    </>
                  )}
                </>
              ) : ownPage ? (
                <ActionsPage ctx={ctx} syncHours={syncHours} pages={pages} onPage={onPage} />
              ) : (
              <SkinGrid
                skin="pulso"
                palette={PAGE}
                ctx={ctx}
                grid={grid}
                // nada em branco: sem campanhas no período (só GA4 ou orgânico), a tabela sai
                hide={campaigns.length ? [] : ["s-tabela"]}
                nodes={{
                  "s-visao": (
                    <section className="relative min-w-0 overflow-hidden rounded-[24px] text-white shadow-[0_18px_50px_rgba(84,52,212,.35)]" style={{ background: C.purple }}>
                      <div className="flex items-center justify-between px-5 pt-5">
                        <h3 className="text-[15px] font-semibold">Visão geral</h3>
                        <button
                          type="button"
                          onClick={() => setMode(mode === "dia" ? "semana" : "dia")}
                          className="flex items-center gap-1.5 rounded-[10px] border border-white/40 px-3 py-1.5 text-[11px]"
                        >
                          {mode === "dia" ? "Diário" : "Semanal"} <ChevronDown size={13} />
                        </button>
                      </div>
                      <ChartTheme palette={CHART} className="mt-2 flex h-[150px] min-h-0 flex-col">
                        <FlowLines
                          className="flex-1"
                          wavy
                          points={points.map((v, i) => ({ atual: v, anterior: prevPoints[i] ?? 0 }))}
                          dates={pointDates}
                          series={[
                            { key: "anterior", label: "Período anterior", color: "rgb(255 255 255 / 0.28)", width: 2 },
                            { key: "atual", label: label(ctx, conv), color: "#ff7ab8", width: 3, area: 0.18 },
                          ]}
                          format={(_, v) => int(v)}
                          pin={{ index: peak, key: "atual", color: "#ff7ab8", ring: "#ffffff", column: true, caption: { value: `Pico: ${int(points[peak] ?? 0)}`, label: label(ctx, conv), bg: "#2e1f78", fg: "#ffffff" } }}
                          onHover={setHover}
                          summary={`${label(ctx, conv)} por ${mode === "dia" ? "dia" : "semana"}: pico de ${int(points[peak] ?? 0)}.`}
                        />
                      </ChartTheme>
                      <div className="flex justify-between px-5 pb-1 text-[10.5px] text-white/70">
                        {labels.map((l, i) => (
                          <span key={i} className={i === mark ? "rounded-full bg-white px-2 font-semibold text-[#5434d4]" : ""}>
                            {l}
                          </span>
                        ))}
                      </div>
                      {notes.length > 0 && (
                        // dias fora do padrão, explicados (a tendência com o dia da semana dá o esperado)
                        <p className="px-5 pt-2 text-[11px] text-white/85" data-notas>
                          Fora do padrão:{" "}
                          {notes.map((n, i) => (
                            <span key={n.ago}>
                              {i > 0 && " · "}
                              <strong className="font-semibold">{dayLabel(n.ago, ctx.today)}</strong> {n.change > 0 ? "+" : "−"}
                              {decimal(Math.abs(n.change) * 100, 0)}% contra o esperado
                            </span>
                          ))}
                        </p>
                      )}
                      <div className="relative mt-3 grid grid-cols-3 items-end text-center">
                        <div className="min-w-0 px-1 pb-5">
                          <p className="text-[10.5px] text-white/70">Investimento</p>
                          <p className="text-[15px] leading-tight font-semibold whitespace-nowrap tnum @[420px]:text-[18px] @[520px]:text-[22px]">{money(ctx, ctx.cur.spend, true)}</p>
                          {/* o número é do período; a verba é do mês até hoje (o mesmo gasto do bloco de ritmo) */}
                          <p className="text-[11px] text-white/70">{periodLabel}</p>
                          {withBudget && !ctx.hideSpend && (
                            <p className="text-[10.5px] text-white/70" data-verba-mes={budget.spent}>
                              {decimal((budget.spent / budget.monthly) * 100, 0)}% da verba no mês até hoje
                            </p>
                          )}
                        </div>
                        <div className="mx-1 min-w-0 rounded-t-[22px] border border-b-0 border-white/20 bg-white/12 px-2 pt-4 pb-5">
                          <p className="text-[10.5px] text-white/70">Total de {label(ctx, conv).toLowerCase()}</p>
                          <p className="text-[17px] leading-tight font-bold whitespace-nowrap tnum @[420px]:text-[20px] @[520px]:text-[24px]">{int(ctx.cur[conv])}</p>
                          <p className="text-[11px] text-white/70">{days.length} dias</p>
                        </div>
                        {sales ? (
                          // objetivo de venda: a receita e o ROAS
                          <div className="min-w-0 px-1 pb-5">
                            <p className="text-[10.5px] text-white/70">{label(ctx, "revenue")}</p>
                            <p className="text-[15px] leading-tight font-semibold whitespace-nowrap tnum @[420px]:text-[18px] @[520px]:text-[22px]">{value(ctx, "revenue")}</p>
                            <p className="text-[11px] text-white/70">
                              {label(ctx, "roas")} {value(ctx, "roas")}
                            </p>
                          </div>
                        ) : withGoal ? (
                          // meta de custo do dashboard: o custo do período contra ela
                          <div className="min-w-0 px-1 pb-5">
                            <p className="text-[10.5px] text-white/70">Alvo de custo</p>
                            <p className="text-[15px] leading-tight font-semibold whitespace-nowrap tnum @[420px]:text-[18px] @[520px]:text-[22px]">{money(ctx, ctx.ds.goal)}</p>
                            <p className="text-[11px] text-white/70">{goalOk ? "dentro do alvo" : "acima do alvo"}</p>
                          </div>
                        ) : (
                          // sem meta: a taxa de conversão (dado real) e o convite para definir a meta
                          <div className="min-w-0 px-1 pb-5">
                            <p className="text-[10.5px] text-white/70">{label(ctx, "convRate")}</p>
                            <p className="text-[15px] leading-tight font-semibold whitespace-nowrap tnum @[420px]:text-[18px] @[520px]:text-[22px]">{value(ctx, "convRate")}</p>
                            <p className="text-[11px] text-white/70">{GOAL_INVITE} de custo</p>
                          </div>
                        )}
                      </div>
                    </section>
                  ),
                  "s-melhor": (
                    <section className="flex min-w-0 items-center gap-4 rounded-[22px] p-4 text-white" style={{ background: C.purple }}>
                      <span className="grid size-[56px] shrink-0 place-items-center rounded-[16px] border border-white/25 bg-white/15">
                        <Zap size={26} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/70">Campanha líder</p>
                        {best ? <FullName text={best.name} className="text-[16px] font-semibold" /> : <p className="text-[16px] font-semibold">Sem campanhas no período</p>}
                        {best && (
                          <p className="mt-0.5 text-[11px] text-white/80 tnum">
                            {int(best.conversions)} {convWord}
                            {!ctx.hideSpend && best.conversions > 0 ? ` · ${money(ctx, best.spend / best.conversions, true)} ${costWord}` : ""}
                          </p>
                        )}
                      </div>
                    </section>
                  ),
                  "s-custo": (
                    <section className="relative min-w-0 overflow-hidden rounded-[22px] text-white shadow-[0_18px_50px_rgba(222,47,126,.3)]" style={{ background: C.pink }}>
                      <div className="flex items-center gap-4 rounded-[22px] p-4" style={{ background: "rgba(255,255,255,.12)" }}>
                        <span className="grid size-[56px] shrink-0 place-items-center rounded-[16px] border border-white/30 bg-white/15">
                          <TrendingUp size={26} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[16px] font-semibold">{label(ctx, cost)}</p>
                          {costTrend.good !== null && (
                            <p className="text-[11px] text-white/85">
                              {costTrend.up ? "▲" : "▼"} {costTrend.text} contra o período anterior
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] opacity-40" aria-hidden>
                        <Spark values={costSeries} color="#ffffff" variant="solid" strokeWidth={0} endDot={false} className="h-full" />
                      </div>
                      <div className="relative flex items-end justify-between gap-3 p-4 pt-2">
                        <div className="min-w-0">
                          <p className="text-[26px] leading-tight font-bold tnum">{value(ctx, cost)}</p>
                          <p className="text-[11px] text-white/85">
                            {withGoal ? `Alvo ${money(ctx, ctx.ds.goal)} · ${goalOk ? "dentro" : "acima"}` : `${GOAL_INVITE} de custo`}
                          </p>
                        </div>
                        {pages.includes("campanhas") && (
                          <button type="button" aria-label="Ver campanhas" title="Ver campanhas" onClick={() => onPage?.("campanhas")} className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-white/80">
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </section>
                  ),
                  "s-ritmo": (
                    <Card data-ritmo={pace?.spent} title="Ritmo da verba no mês" note={pace ? `dia ${pace.day} de ${pace.daysInMonth} · ${left} ${left === 1 ? "dia restante" : "dias restantes"}` : undefined}>
                      {pace && !ctx.hideSpend ? (
                        <>
                          <p className="flex flex-wrap items-baseline gap-x-2 text-[12px]" style={{ color: C.fg2 }}>
                            <strong className="text-[20px] font-bold tnum" style={{ color: C.fg }}>{money(ctx, pace.spent, true)}</strong> de {money(ctx, pace.monthly, true)} no mês até hoje ·{" "}
                            <span className="font-semibold" style={{ color: pace.status === "no ritmo" ? C.green : pace.status === "estoura" ? "#ff6b8b" : C.pinkFlat }}>
                              {pace.status === "no ritmo" ? "no ritmo" : pace.status === "estoura" ? `vai estourar: fecha em ${money(ctx, pace.projected, true)}` : `vai sobrar: fecha em ${money(ctx, pace.projected, true)}`}
                            </span>
                          </p>
                          <PacingChart p={pace} tone={TONE} format={(v) => money(ctx, v, true)} className="mt-3 min-h-[110px] flex-1" />
                          <p className="mt-2 text-[10.5px]" style={{ color: C.fg2 }}>Tracejado: o ideal até o fim do mês · pontilhado: para onde vai no ritmo dos últimos 7 dias</p>
                        </>
                      ) : (
                        <p className="m-auto text-center text-[12.5px]" style={{ color: C.fg2 }}>
                          {ctx.hideSpend ? "Investimento oculto neste link." : `${BUDGET_INVITE} para ver se o mês vai estourar ou sobrar.`}
                        </p>
                      )}
                    </Card>
                  ),
                  "s-ontem": (
                    <Card title="Ontem contra a semana" note="faixa: mínimo a máximo dos 7 dias antes" data-ontem>
                      <ul className="space-y-4">
                        {yday
                          .filter((y) => !(y.money && ctx.hideSpend))
                          .map((y) =>
                            y.check ? (
                              <li key={y.label}>
                                <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
                                  <span style={{ color: C.fg2 }}>{y.label}</span>
                                  <span>
                                    <strong className="text-[16px] font-bold tnum">{y.fmt(y.check.value)}</strong>{" "}
                                    <span className="text-[11px] font-semibold" style={{ color: y.check.status === "normal" ? C.fg2 : y.check.status === "acima" ? C.green : "#ff6b8b" }}>
                                      {y.check.status === "normal" ? "normal" : y.check.status === "acima" ? "acima do normal" : "abaixo do normal"}
                                    </span>
                                  </span>
                                </p>
                                <BulletBar value={y.check.value} target={y.check.mean} lo={y.check.lo} hi={y.check.hi} color={C.pinkFlat} tone={TONE} label={`${y.label} ontem: ${y.fmt(y.check.value)}; média dos 7 dias antes: ${y.fmtMean(y.check.mean)}.`} />
                                <p className="mt-1 text-[10.5px] tnum" style={{ color: C.fg2 }}>média {y.fmtMean(y.check.mean)}</p>
                              </li>
                            ) : (
                              <li key={y.label} className="text-[12px]" style={{ color: C.fg2 }}>
                                {y.label}: poucos dias para comparar.
                              </li>
                            ),
                          )}
                      </ul>
                      <p className="mt-auto pt-3 text-[10.5px]" style={{ color: C.fg2 }}>Ontem ainda está em maturação: as conversões podem subir.</p>
                    </Card>
                  ),
                  "s-tabela": (
                    <Card title="Campanhas agora" note="status pelos últimos dias · clique no nome para filtrar">
                      <StatusTable ctx={ctx} className="-mx-1 flex-1 px-1" />
                    </Card>
                  ),
                  "s-ranking": (
                    <Card title={`Ranking por ${sales ? "receita" : convWord}`} note="contra o período anterior">
                      {movers.length === 0 ? (
                        <p className="m-auto text-center text-[12.5px]" style={{ color: C.fg2 }}>Sem campanhas com resultado no período.</p>
                      ) : (
                        <ol className="space-y-2">
                          {movers.map((m) => (
                            <li key={m.item.id} className="flex min-w-0 items-center gap-2">
                              <span className="w-5 shrink-0 text-[12px] font-bold tnum" style={{ color: C.fg2 }}>{m.rank}</span>
                              <MoveTag moved={m.moved} tone={TONE} />
                              <FullName text={m.item.name} className="min-w-0 flex-1 text-[12.5px] font-semibold" />
                              <span className="shrink-0 text-[12px] font-bold tnum">{sales ? money(ctx, m.value, true) : int(m.value)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </Card>
                  ),
                }}
              />
              )}
            </div>
          </div>
        </div>

        {/* lateral "Atenção agora": em todas as abas (em Ações de hoje, a aba é ela por inteiro); recolhível */}
        {!ownPage && (
          <aside
            // na tela do dashboard a lateral não dita a altura: acompanha a dos blocos e rola dentro; no estreito, vem antes dos blocos
            className={`hidden min-w-0 @[1000px]:block @[1000px]:border-l ${closed ? "@[1000px]:p-0" : "@[1000px]:p-5"} ${screen ? "@[1000px]:overflow-y-auto @[1000px]:[contain:size] @[1000px]:[scrollbar-width:thin]" : ""}`}
            style={{ borderColor: C.line, background: "#0d0a18" }}
          >
            <AttentionPanel ctx={ctx} syncHours={syncHours} pages={pages} onPage={onPage} closed={closed} />
          </aside>
        )}
      </div>
    </div>
  );
}
