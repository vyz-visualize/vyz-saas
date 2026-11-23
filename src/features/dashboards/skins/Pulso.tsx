"use client";

// Visual "Pulso": escuro, com destaque vibrante. Barra lateral com as abas (ícone e nome),
// card de visão geral em roxo com a onda e o pico marcado, dois blocos coloridos (roxo e
// rosa), as campanhas que mais trazem resultado (participação e custo de cada uma, contra a
// média) e a coluna da direita com os criativos e o público (idade e gênero).
// Nada de número inventado: meta de custo e verba do mês só aparecem quando o dashboard tem
// (metrics/targets); sem elas, o bloco mostra outro dado real ou o convite para definir.

import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
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
  Target,
  TrendingUp,
  Type,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DayRow } from "@/features/metrics/source";
import { GOAL_INVITE, hasBudget, hasGoal } from "@/features/metrics/targets";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { ChartTheme, dayDates, FlowLines, SkinBar, SkinChrome, SkinPage, Spark, type SkinPalette } from "./bklit-blocks";
import { FullName } from "./FullName";
import { SkinGrid } from "./SkinGrid";
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
  platformName,
  value,
  type SkinProps,
} from "./shared";

const C = {
  bg: "#07050f",
  frame: "#110d1e",
  card: "#1a1530",
  card2: "#221b3d",
  side: "linear-gradient(180deg,#2b1e63 0%,#1a1340 100%)",
  sideActive: "#7b5cff",
  purple: "linear-gradient(150deg,#7c5cff 0%,#5434d4 100%)",
  purpleFlat: "#7b5cff",
  pink: "linear-gradient(150deg,#ff5fa9 0%,#de2f7e 100%)",
  pinkFlat: "#ff5fa9",
  fg: "#f4f1ff",
  fg2: "#a79ecf",
  line: "#2a2346",
  green: "#3ee08f",
};

// cores dos gráficos (Bklit UI) sobre o roxo: tooltip escuro, texto branco
const CHART: SkinPalette = { scheme: "dark", bg: "#2e1f78", card: "#5434d4", fg: "#ffffff", fg2: "rgb(255 255 255 / 0.75)", line: "rgb(255 255 255 / 0.25)", accent: "#ff7ab8", accentSoft: "#4a1f45", onAccent: "#ffffff", muted: "rgb(255 255 255 / 0.3)", error: "#ffd0c8", errorSoft: "#5a2a3a", good: "#8ff0b0" };

// controles e outras abas: os componentes padrão no escuro do visual, com o roxo de destaque
const PAGE: SkinPalette = { scheme: "dark", bg: C.frame, card: C.card, fg: C.fg, fg2: C.fg2, line: C.line, accent: "#8b6cff", accentSoft: "#2a2152", onAccent: "#ffffff", muted: "#3b3268", error: "#ff6b8b", errorSoft: "#3a1626", good: C.green };

/** Ícone de cada aba na barra lateral (o nome vai embaixo). */
const PAGE_ICON: Partial<Record<PageId, LucideIcon>> = {
  "visao-geral": Gauge,
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

const CARD_ICONS: LucideIcon[] = [Target, TrendingUp, Zap];

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
}: SkinProps) {
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
  const creatives = useMemo(
    () => [...ctx.ds.creatives].sort((a, b) => b.conversions - a.conversions),
    [ctx.ds.creatives],
  );
  const [crTab, setCrTab] = useState<"todos" | "video">("todos");
  const crList = (
    crTab === "todos"
      ? creatives
      : creatives.filter((c) => /v[íi]deo|reels/i.test(c.format))
  ).slice(0, 5);
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
  const campaignTotal = Math.max(1, campaigns.reduce((a, c) => a + c.conversions, 0));
  const convWord = label(ctx, "conversions").toLowerCase();
  const costWord = label(ctx, cost).replace(/^Custo por /i, "por ");

  /** Uma das campanhas que mais trazem resultado: a participação dela e o custo contra a média. */
  const progCard = (k: number) => {
    const c = campaigns[k];
    if (!c) return null;
    const Icon = CARD_ICONS[k % CARD_ICONS.length];
    const share = c.conversions / campaignTotal;
    const cpaC = c.conversions > 0 ? c.spend / c.conversions : null;
    const cheaper = cpaC !== null && cpaC <= costNow;
    // o ícone flutua acima do card: o espaço dele fica dentro do bloco da grade
    return (
      <div className="flex min-w-0 flex-col pt-7">
        <section
          className="relative flex min-w-0 flex-1 flex-col rounded-[22px] border px-4 pt-11 pb-4"
          style={{ background: C.card, borderColor: C.line }}
        >
          <span
            className="absolute -top-7 left-1/2 grid size-[58px] -translate-x-1/2 place-items-center rounded-[16px] text-white shadow-[0_10px_30px_rgba(123,92,255,.45)]"
            style={{ background: C.purple }}
          >
            <Icon size={26} strokeWidth={1.8} />
          </span>
          <FullName text={c.name} className="text-center text-[15px] font-bold" />
          <p className="text-center text-[11px]" style={{ color: C.fg2 }}>
            {platformName(c.platform)} · {money(ctx, c.spend, true)}
          </p>
          {/* a participação fica na base do card: sobra de altura vira respiro no meio, não um vazio embaixo */}
          <p className="mt-auto flex justify-between gap-2 pt-4 text-[11.5px] font-semibold">
            <span>Participação em {convWord}</span>
            <span className="tnum">{decimal(share * 100, 0)}%</span>
          </p>
          <div className="mt-1.5 h-[7px] rounded-full" style={{ background: C.line }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: C.pink }} />
          </div>
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px]" style={{ color: C.fg2 }}>
            <span className="tnum">
              {int(c.conversions)} de {int(campaignTotal)}
            </span>
            {cpaC !== null && !ctx.hideSpend && (
              <span
                className="rounded-full px-3 py-1 font-semibold tnum"
                style={cheaper ? { background: "rgb(62 224 143 / 0.14)", color: C.green } : { background: "rgb(255 95 169 / 0.16)", color: C.pinkFlat }}
              >
                {money(ctx, cpaC, true)} {costWord} · {cheaper ? "abaixo" : "acima"} da média
              </span>
            )}
          </p>
        </section>
      </div>
    );
  };

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div
      className={screen ? "@container flex min-h-dvh flex-col" : "@container rounded-[32px] p-3 @[700px]:p-8"}
      style={{ background: screen ? C.frame : C.bg, color: C.fg }}
      data-visual="pulso"
    >
      <SkinBar palette={PAGE} bar={bar} className="px-4 pt-3 @[700px]:px-5" />
      <div
        className={`grid overflow-hidden ${screen ? "flex-1" : "rounded-[28px] border"} ${children ? "" : "@[1000px]:grid-cols-[minmax(0,1fr)_260px]"}`}
        style={{ background: C.frame, borderColor: C.line }}
      >
        <div className={`flex min-w-0 gap-5 p-4 @[700px]:p-5 ${screen ? "pb-[var(--screen-pb,7rem)] @[700px]:pb-[var(--screen-pb,7rem)]" : ""}`}>
          {/* barra lateral: uma aba por página, com ícone e nome; com muitas, a lista rola dentro da barra */}
          <aside
            className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] w-[88px] shrink-0 flex-col items-center gap-2 self-start rounded-[26px] py-4 text-white @[700px]:flex"
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

            <div className="mt-5">
              {children ? <SkinPage palette={PAGE}>{children}</SkinPage> : (
              <SkinGrid
                skin="pulso"
                palette={PAGE}
                ctx={ctx}
                grid={grid}
                // nada em branco: com menos de 3 campanhas no período, os cards que sobrariam vazios saem
                hide={[0, 1, 2].filter((k) => !campaigns[k]).map((k) => `s-prog${k + 1}`)}
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
                      <div className="relative mt-3 grid grid-cols-3 items-end text-center">
                        <div className="min-w-0 px-1 pb-5">
                          <p className="text-[10.5px] text-white/70">Investimento</p>
                          <p className="text-[15px] leading-tight font-semibold whitespace-nowrap tnum @[420px]:text-[18px] @[520px]:text-[22px]">{money(ctx, ctx.cur.spend, true)}</p>
                          {/* com a verba do mês definida: quanto dela já foi e quantos dias faltam */}
                          <p className="text-[11px] text-white/70">
                            {withBudget && !ctx.hideSpend ? `${decimal((budget.spent / budget.monthly) * 100, 0)}% da verba do mês · ${left} ${left === 1 ? "dia restante" : "dias restantes"}` : periodLabel}
                          </p>
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
                            <p className="text-[10.5px] text-white/70">Meta de custo</p>
                            <p className="text-[15px] leading-tight font-semibold whitespace-nowrap tnum @[420px]:text-[18px] @[520px]:text-[22px]">{money(ctx, ctx.ds.goal)}</p>
                            <p className="text-[11px] text-white/70">{goalOk ? "dentro da meta" : "acima da meta"}</p>
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
                            {withGoal ? `Meta ${money(ctx, ctx.ds.goal)} · ${goalOk ? "dentro" : "acima"}` : `${GOAL_INVITE} de custo`}
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
                  "s-prog1": progCard(0),
                  "s-prog2": progCard(1),
                  "s-prog3": progCard(2),
                }}
              />
              )}
            </div>
          </div>
        </div>

        {/* coluna da direita: só na primeira aba (as outras usam a largura toda) */}
        {!children && (
          <aside
            // na tela do dashboard a coluna da direita não dita a altura: acompanha a dos blocos e rola dentro
            className={`min-w-0 border-t p-5 @[1000px]:border-t-0 @[1000px]:border-l ${screen ? "@[1000px]:overflow-y-auto @[1000px]:[contain:size] @[1000px]:[scrollbar-width:thin]" : ""}`}
            style={{ borderColor: C.line, background: "#0d0a18" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-bold">
                <ImageIcon size={17} style={{ color: C.pinkFlat }} /> Criativos
              </h3>
              {pages.includes("criativos") && (
                <button type="button" onClick={() => onPage?.("criativos")} className="text-[11px] font-semibold" style={{ color: C.pinkFlat }}>
                  Ver todos
                </button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 rounded-[14px] p-1 text-[12px]" style={{ background: C.card }}>
              {(["todos", "video"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCrTab(t)}
                  className="rounded-[10px] py-2 font-semibold"
                  style={t === crTab ? { background: C.purple, color: "#fff" } : { color: C.fg2 }}
                >
                  {t === "todos" ? "Ativos" : "Vídeos"}
                </button>
              ))}
            </div>
            <ul className="mt-4 space-y-4">
              {crList.length === 0 && (
                <li className="text-[12px]" style={{ color: C.fg2 }}>
                  {crTab === "video" ? "Nenhum vídeo no período." : "Nenhum criativo no período."}
                </li>
              )}
              {crList.map((c, i) => (
                <li key={c.id} className="flex min-w-0 items-center gap-3">
                  {/* dados reais: a imagem do anúncio; amostra ou sem imagem: as iniciais */}
                  <CreativeImage
                    src={c.imageUrl}
                    video={isVideoFormat(c.format)}
                    compact
                    className="size-10 shrink-0 rounded-full ring-2 ring-[#7b5cff]/40"
                    fallback={
                      <span className="grid size-full place-items-center text-[11px] font-bold text-white" style={{ background: ["#7b5cff", "#ff5fa9", "#3ea7ff", "#ffb347", "#3ee08f"][i % 5] }}>
                        {initials(c.name)}
                      </span>
                    }
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <FullName text={c.name} className="text-[12.5px] font-bold" />
                    <span className="block truncate text-[10.5px]" style={{ color: C.fg2 }}>
                      {c.format} · {platformName(c.platform)}
                    </span>
                    <span className="block text-[10.5px] tnum">
                      <strong className="font-bold" style={{ color: C.pinkFlat }}>{int(c.conversions)}</strong> <span style={{ color: C.fg2 }}>{convWord}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <Audience ctx={ctx} />
          </aside>
        )}
      </div>
    </div>
  );
}

/** Público de verdade: idade (barras) e gênero, pela parte das impressões; sem o dado, diz que falta. */
function Audience({ ctx }: { ctx: SkinProps["ctx"] }) {
  const ages = ctx.ds.audience.filter((a) => a.share > 0).slice(0, 5);
  const gender = ctx.ds.gender.filter((g) => g.share > 0);
  const top = Math.max(0.0001, ...ages.map((a) => a.share));
  return (
    <div className="mt-6 border-t pt-5" style={{ borderColor: C.line }}>
      <h3 className="flex items-center justify-between text-[15px] font-bold">
        <span className="flex items-center gap-2">
          <Users size={17} style={{ color: C.pinkFlat }} /> Público
        </span>
        <span className="text-[10.5px] font-medium" style={{ color: C.fg2 }}>
          parte das impressões
        </span>
      </h3>
      {ages.length === 0 && gender.length === 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: C.fg2 }}>
          Sem dados de idade e gênero no período.
        </p>
      ) : (
        <>
          {ages.length > 0 && (
            <ul className="mt-3 space-y-2" aria-label="Idade">
              {ages.map((a) => (
                <li key={a.label} className="grid grid-cols-[44px_minmax(0,1fr)_34px] items-center gap-2 text-[11px]">
                  <span style={{ color: C.fg2 }}>{a.label}</span>
                  <span className="h-[8px] rounded-full" style={{ background: C.line }}>
                    <span className="block h-full rounded-full" style={{ width: `${(a.share / top) * 100}%`, background: a.share === top ? C.pink : C.purple }} />
                  </span>
                  <span className="text-right font-semibold tnum">{decimal(a.share * 100, 0)}%</span>
                </li>
              ))}
            </ul>
          )}
          {gender.length > 0 && (
            <div className="mt-4" aria-label="Gênero">
              <div className="flex h-[10px] overflow-hidden rounded-full">
                {gender.map((g, i) => (
                  <span key={g.label} style={{ width: `${g.share * 100}%`, background: i === 0 ? C.pinkFlat : C.purpleFlat }} />
                ))}
              </div>
              <p className="mt-1.5 flex justify-between text-[11px]" style={{ color: C.fg2 }}>
                {gender.map((g) => (
                  <span key={g.label}>
                    {g.label} <span className="font-semibold tnum" style={{ color: C.fg }}>{decimal(g.share * 100, 0)}%</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
