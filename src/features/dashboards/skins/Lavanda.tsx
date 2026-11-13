"use client";

// Visual "Lavanda": cards claros com gráfico em cima, barra de filtros e o
// painel escuro com a lista de campanhas e o detalhe da escolhida em lilás.

import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Link2,
  Plus,
  Search,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { PAGES } from "@/features/templates/pages";
import { ChartTheme, dayDates, FlowLines, SkinBar, SkinChrome, SkinPage, WeekBars, type SkinPalette } from "./bklit-blocks";
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
  bg: "#eef0f7",
  card: "#ffffff",
  line: "#e6e8f0",
  fg: "#16172b",
  fg2: "#8a8da3",
  accent: "#5b4ff0",
  accentSoft: "#c9c4fb",
  dark: "#1d1e2c",
  dark2: "#2a2b3c",
  panel: "linear-gradient(140deg,#5d55d8 0%,#6f63e6 55%,#5a4fd2 100%)",
};

// cores dos gráficos (Bklit UI) dentro dos cards claros
const CHART: SkinPalette = { scheme: "light", bg: "#ffffff", card: "#ffffff", fg: C.fg, fg2: C.fg2, line: C.line, accent: C.accent, accentSoft: C.accentSoft, onAccent: "#ffffff", muted: C.accentSoft, error: "#d92d20", errorSoft: "#fde7e4", good: "#1f9d55" };

// controles e outras abas: os componentes padrão na paleta lilás, sobre o fundo claro da moldura
const PAGE: SkinPalette = { ...CHART, bg: "#f8f9fd", accentSoft: "#e4e1fd", muted: "#c9c4fb" };

type Tab = "todas" | PlatformId;

export function LavandaSkin({
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
  const campaigns = useMemo(
    () => [...ctx.ds.campaigns].sort((a, b) => b.spend - a.spend),
    [ctx.ds.campaigns],
  );
  const platforms = ctx.ds.adPlatforms;
  const [tab, setTab] = useState<Tab>("todas");
  const list =
    tab === "todas" ? campaigns : campaigns.filter((c) => c.platform === tab);
  const [picked, setPicked] = useState<string | null>(null);
  const sel = list.find((c) => c.id === picked) ?? list[0];
  const days = chrono(ctx.ds.current);
  // objetivo de venda: receita e ROAS; nos outros, o resultado do objetivo e a taxa de conversão
  const g = goalOf(ctx.profile, ctx.cur.leads);
  const revenueBars = buckets(
    days.map((d) => d[g.value]),
    6,
  );
  const top = buckets(
    days.map((d) => (g.sales ? d.revenue : d.conversions)),
    9,
  );
  const base = buckets(
    days.map((d) => (g.sales ? d.spend : d.sessions)),
    9,
  );
  const roasLine = top.map((r, i) => r / Math.max(1, base[i]));
  const showValue = (v: number, compact = false) => (g.sales ? money(ctx, v, compact) : int(v));
  const showEfficiency = (v: number) => (ctx.hideSpend && g.sales ? "•••" : g.sales ? decimal(v, 1) : `${decimal(v * 100, 1)}%`);
  // o primeiro dia de cada parte do ROAS (título do tooltip)
  const roasStep = Math.max(1, Math.ceil(days.length / 9));
  const roasDates = dayDates(days.filter((_, i) => i % roasStep === 0).map((d) => d.ago), ctx.today);
  const cpa = change(ctx, "cpa");
  const rev = change(ctx, g.value);
  const roas = change(ctx, g.efficiency);
  const byPlat = platforms.map((p) => ({
    id: p,
    spend: campaigns
      .filter((c) => c.platform === p)
      .reduce((a, c) => a + c.spend, 0),
  }));
  const topPlat = [...byPlat].sort((a, b) => b.spend - a.spend)[0]?.id;
  const status = (i: number) =>
    i % 3 === 0 ? "Ativa" : i % 3 === 1 ? "Aprendizado" : "Limitada";

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div
      className={screen ? "@container" : "@container rounded-[28px] p-3 @[700px]:p-6"}
      style={{ background: screen ? "#f8f9fd" : C.bg, color: C.fg }}
    >
      <div
        className={screen ? "min-h-dvh px-4 pt-3 pb-[var(--screen-pb,7rem)] @[700px]:px-6" : "rounded-[24px] p-4 @[700px]:p-6"}
        style={{ background: "#f8f9fd" }}
      >
        <SkinBar palette={PAGE} bar={bar} className="mb-3" />
        {/* topo: marca, navegação em pílulas e ícones */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="grid size-8 place-items-center rounded-[10px] text-white"
              style={{ background: C.accent }}
            >
              <Wallet size={16} />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight uppercase">
                {client}
              </p>
              <p className="text-[10px]" style={{ color: C.fg2 }}>
                Mídia paga, decisões melhores
              </p>
            </div>
          </div>
          <span
            className="grid size-9 place-items-center rounded-full border text-[12px] font-semibold"
            style={{ borderColor: C.line, background: C.card }}
          >
            {days.length}
          </span>
          <nav
            className="flex min-w-0 max-w-full flex-nowrap gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap"
            style={{ background: C.dark }}
          >
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage?.(p)}
                className="rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors"
                style={
                  p === active
                    ? { background: C.accent, color: "#fff" }
                    : { color: "#d6d7e4" }
                }
              >
                {p === active ? "+ " : ""}
                {PAGES[p].name}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {[FileText, CalendarDays, Link2].map((Icon, i) => (
              <span
                key={i}
                className="hidden size-9 place-items-center rounded-full border @[900px]:grid"
                style={{ borderColor: C.line, background: C.card }}
              >
                <Icon size={15} />
              </span>
            ))}
            <span
              className="relative grid size-9 place-items-center rounded-full border"
              style={{ borderColor: C.line, background: C.card }}
            >
              <Bell size={15} />
              <span className="absolute top-2 right-2.5 size-1.5 rounded-full bg-red-500" />
            </span>
            <span
              className="grid size-9 place-items-center rounded-full text-[12px] font-bold text-white"
              style={{ background: C.dark }}
            >
              {initials(client)}
            </span>
          </div>
        </div>

        {/* título (com o voltar de verdade no topo, a seta de enfeite sai para não repetir) */}
        <div className={`flex flex-wrap items-center ${screen ? "mt-3 gap-3" : "mt-6 gap-4"}`}>
          {!bar && (
            <span
              className="grid size-10 place-items-center rounded-full border"
              style={{ borderColor: C.line, background: C.card }}
            >
              <ArrowLeft size={16} />
            </span>
          )}
          {/* na tela do dashboard, título e frase dividem a linha: sobra altura para os blocos */}
          <div className={screen ? "min-w-0 flex-1 @[1000px]:flex @[1000px]:items-baseline @[1000px]:gap-3" : "min-w-0 flex-1"}>
            <h2 className={`leading-none font-bold tracking-[-0.03em] ${screen ? "text-[24px]" : "text-[30px]"}`}>
              {name}
            </h2>
            <p className={`text-[13px] ${screen ? "mt-1 min-w-0 truncate @[1000px]:mt-0" : "mt-1"}`} style={{ color: C.fg2 }}>
              Acompanhe {g.sales ? "receita" : label(ctx, g.conv).toLowerCase()}, investimento e campanhas num lugar só ·{" "}
              {periodLabel}
            </p>
          </div>
          <span
            className={`grid place-items-center rounded-[14px] border ${screen ? "size-9" : "size-11"}`}
            style={{ borderColor: C.line, background: C.card }}
          >
            <SlidersHorizontal size={16} />
          </span>
          <span
            className={`flex items-center gap-2 rounded-[14px] text-[13px] font-semibold text-white ${screen ? "h-9 px-4" : "h-11 px-5"}`}
            style={{ background: C.accent }}
          >
            <Plus size={16} /> {label(ctx, g.value)}: {value(ctx, g.value)}
          </span>
        </div>

        <SkinChrome palette={PAGE} controls={controls} note={note} screen={screen} className="mt-4" />

        {/* respiro entre o título e os cards; nas outras abas, os blocos padrão na paleta do visual */}
        <div className={screen ? "mt-3" : "mt-5"}>
        {children ? <SkinPage palette={PAGE}>{children}</SkinPage> : (
        <SkinGrid
          skin="lavanda"
          ctx={ctx}
          grid={grid}
          nodes={{
            "s-cpa": (
              <section
                className="fit-fill flex min-h-[230px] flex-col overflow-hidden rounded-[20px] border p-4"
                style={{ borderColor: C.line, background: C.card }}
              >
                <header className="flex shrink-0 items-center justify-between text-[13px] font-semibold">
                  {label(ctx, "cpa")}
                  <AlertCircle size={16} className="text-red-500" />
                </header>
                <p className="mt-3 shrink-0 text-[28px] leading-tight font-bold tracking-tight tnum">
                  {value(ctx, "cpa")}
                </p>
                <Trend c={cpa} />
                <DeskArt />
              </section>
            ),
            "s-receita": (
              <section
                className="fit-fill flex min-h-[230px] flex-col overflow-hidden rounded-[20px] border p-4"
                style={{ borderColor: C.line, background: C.card }}
              >
                <header className="flex shrink-0 items-center justify-between text-[13px] font-semibold">
                  {label(ctx, g.value)}
                  <span
                    className="grid size-7 place-items-center rounded-full"
                    style={{ background: "#eeedfd", color: C.accent }}
                  >
                    <CalendarDays size={14} />
                  </span>
                </header>
                <p className="mt-3 shrink-0 text-[28px] leading-tight font-bold tracking-tight tnum">
                  {value(ctx, g.value)}
                </p>
                <Trend c={rev} />
                <ChartTheme palette={CHART} className="mt-2 flex min-h-[min(92px,var(--fit-cap,92px))] flex-1 flex-col">
                  <WeekBars
                    className="flex-1"
                    values={revenueBars}
                    labels={revenueBars.map((_, i) => `S${i + 1}`)}
                    color={C.accent}
                    soft={C.accentSoft}
                    what={label(ctx, g.value)}
                    format={(v) => showValue(v, true)}
                    summary={`${label(ctx, g.value)} em ${revenueBars.length} partes do período: total de ${value(ctx, g.value)}.`}
                  />
                </ChartTheme>
              </section>
            ),
            "s-roas": (
              <section
                className="fit-fill flex min-h-[230px] flex-col overflow-hidden rounded-[20px] border p-4"
                style={{ borderColor: C.line, background: C.card }}
              >
                <header className="flex shrink-0 items-center justify-between text-[13px] font-semibold">
                  {g.sales ? `${label(ctx, "roas")} médio` : label(ctx, g.efficiency)}
                  <Clock size={16} style={{ color: "#3b9bdc" }} />
                </header>
                <p className="mt-3 shrink-0 text-[28px] leading-tight font-bold tracking-tight tnum">
                  {value(ctx, g.efficiency)}
                </p>
                <Trend c={roas} />
                <ChartTheme palette={CHART} className="mt-2 flex min-h-[min(92px,var(--fit-cap,92px))] flex-1 flex-col">
                  <FlowLines
                    className="-mx-4 -mb-4 flex-1 overflow-hidden rounded-b-[20px]"
                    points={roasLine.map((v) => ({ roas: v }))}
                    dates={roasDates}
                    series={[{ key: "roas", label: label(ctx, g.efficiency), color: C.accent, width: 2.2, area: 0.26 }]}
                    format={(_, v) => showEfficiency(v)}
                    summary={`${label(ctx, g.efficiency)} ao longo do período: ${g.sales ? "média de " : ""}${value(ctx, g.efficiency)}.`}
                  />
                </ChartTheme>
              </section>
            ),
            "s-plataformas": (
              <section
                className="fit-fill flex min-h-[230px] flex-col overflow-hidden rounded-[20px] border p-4"
                style={{ borderColor: C.line, background: C.card }}
              >
                <header className="flex shrink-0 items-center justify-between text-[13px] font-semibold">
                  Investimento por plataforma
                  <span
                    className="grid size-7 place-items-center rounded-full border"
                    style={{ borderColor: C.line }}
                  >
                    <ArrowUpRight size={14} />
                  </span>
                </header>
                <div className="mt-3 flex shrink-0 items-center gap-2">
                  <p className="text-[26px] leading-tight font-bold tracking-tight whitespace-nowrap tnum">
                    {money(ctx, ctx.cur.spend, true)}
                  </p>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px]"
                    style={{ borderColor: C.line }}
                  >
                    {int(ctx.cur.conversions)}{" "}
                    {label(ctx, "conversions").toLowerCase()}
                  </span>
                </div>
                <div className="mt-auto flex min-h-[56px] flex-[0_1_116px] items-end gap-1.5 pt-3">
                  {byPlat.slice(0, 3).map((p) => {
                    const hi = p.id === topPlat;
                    return (
                      <div
                        key={p.id}
                        className="flex flex-1 flex-col justify-between rounded-[12px] p-2 text-[10px]"
                        style={{
                          height: hi ? "100%" : "79%",
                          background: hi ? C.accent : "#f2f3f8",
                          color: hi ? "#fff" : C.fg2,
                        }}
                      >
                        <span
                          className="font-semibold tnum"
                          style={{ color: hi ? "#fff" : C.fg }}
                        >
                          {money(ctx, p.spend, true)}
                        </span>
                        <span>{platformName(p.id)}</span>
                      </div>
                    );
                  })}
                  <span
                    className="self-end rounded-full px-3 py-2 text-[10.5px] font-semibold whitespace-nowrap text-white"
                    style={{ background: C.dark }}
                  >
                    {Math.round(
                      ((byPlat.find((p) => p.id === topPlat)?.spend ?? 0) /
                        Math.max(1, ctx.cur.spend)) *
                        100,
                    )}
                    % na maior
                  </span>
                </div>
              </section>
            ),
            "s-filtros": (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 flex items-center gap-2 text-[13px] font-semibold">
                  Filtros ativos
                  <span
                    className="grid size-5 place-items-center rounded-full text-[10px] text-white"
                    style={{ background: C.dark }}
                  >
                    {tab === "todas" ? 1 : 2}
                  </span>
                </span>
                <Pill>
                  {tab === "todas" ? "Todas as plataformas" : platformName(tab)}{" "}
                  <ChevronDown size={14} />
                </Pill>
                <Pill>
                  {sel ? sel.name : "Todas as campanhas"}{" "}
                  <ChevronDown size={14} />
                </Pill>
                <Pill>
                  {dayLabel(days.length, ctx.today)} <CalendarDays size={14} />
                </Pill>
                <Pill>
                  {dayLabel(0, ctx.today)} <CalendarDays size={14} />
                </Pill>
                <Pill grow>
                  <span style={{ color: C.fg2 }}>Buscar campanha</span>{" "}
                  <Search size={14} />
                </Pill>
              </div>
            ),
            "s-campanhas": (
              <div
                className="fit-fill relative flex flex-col rounded-[24px] p-4 @[700px]:p-5"
                style={{ background: C.dark, color: "#fff" }}
              >
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[14px] font-semibold">
                    Campanhas no período
                  </h3>
                  <div
                    className="flex gap-1 rounded-full bg-white p-1 text-[12px]"
                    style={{ color: C.fg }}
                  >
                    {(["todas", ...platforms] as Tab[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setTab(p);
                          setPicked(null);
                        }}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium"
                        style={
                          p === tab
                            ? { background: C.accent, color: "#fff" }
                            : undefined
                        }
                      >
                        {p === "todas" ? "Todas" : platformName(p)}
                        {p !== "todas" && (
                          <span
                            className="grid size-5 place-items-center rounded-full text-[10px]"
                            style={{
                              background: p === tab ? "#fff" : "#eceaf9",
                              color: C.accent,
                            }}
                          >
                            {campaigns.filter((c) => c.platform === p).length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid min-h-0 flex-1 gap-4 @[900px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] @[900px]:grid-rows-[minmax(0,1fr)]">
                  {/* a lista rola dentro do painel quando não cabe inteira */}
                  <ul className="min-h-0 space-y-1.5 overflow-y-auto [scrollbar-width:thin]">
                    {list.slice(0, 6).map((c, i) => {
                      const on = c.id === sel?.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setPicked(c.id)}
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors"
                            style={
                              on
                                ? { background: C.accent }
                                : { background: "transparent" }
                            }
                          >
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                              style={{
                                background: on ? "#fff" : C.dark2,
                                color: on ? C.accent : "#cfd0e0",
                              }}
                            >
                              {initials(c.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold">
                                {c.name}
                              </span>
                              <span className="block text-[10.5px] opacity-60">
                                {platformName(c.platform)}
                              </span>
                            </span>
                            <span
                              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                              style={
                                on
                                  ? { background: "#fff", color: C.fg }
                                  : { background: C.dark2, color: "#cfd0e0" }
                              }
                            >
                              {status(i)}
                            </span>
                            <span className="w-[86px] shrink-0 text-right text-[12.5px] font-semibold tnum">
                              {money(ctx, c.spend, true)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {sel && (
                    <div
                      className="flex min-h-0 flex-col overflow-hidden rounded-[20px] p-4 @[700px]:p-5"
                      style={{ background: C.panel }}
                    >
                      <div className="grid shrink-0 gap-3 text-[11px] @[700px]:grid-cols-3">
                        <div>
                          <p className="opacity-70">Campanha</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[22px] font-bold tracking-tight">
                              {sel.name}
                            </span>
                            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px]">
                              {status(list.indexOf(sel))}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="opacity-70">Plataforma</p>
                          <p className="mt-1 text-[20px] font-bold tracking-tight">
                            {platformName(sel.platform)}
                          </p>
                        </div>
                        <div>
                          <p className="opacity-70">Cliente</p>
                          <p className="mt-1 flex items-center gap-2">
                            <span
                              className="grid size-8 place-items-center rounded-full bg-white text-[11px] font-bold"
                              style={{ color: C.accent }}
                            >
                              {initials(client)}
                            </span>
                            <span className="leading-tight">
                              <span className="block text-[12.5px] font-semibold">
                                {client}
                              </span>
                              <span className="block opacity-70">
                                Conta de anúncios
                              </span>
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid min-h-[60px] flex-[1_1_96px] grid-cols-2 gap-2.5 @[700px]:grid-cols-4">
                        {[
                          { v: money(ctx, sel.spend), l: "Investimento" },
                          ...(g.sales
                            ? [
                                {
                                  v: money(ctx, sel.revenue),
                                  l: label(ctx, "revenue"),
                                },
                              ]
                            : [
                                {
                                  v: int(sel.clicks),
                                  l: "Cliques",
                                },
                              ]),
                          {
                            v: int(sel.conversions),
                            l: label(ctx, "conversions"),
                          },
                        ].map((tile) => (
                          <div
                            key={tile.l}
                            className="flex min-h-0 flex-col justify-between rounded-[14px] bg-white/12 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[16px] font-bold tnum">
                                {tile.v}
                              </span>
                              <ArrowUpRight size={14} className="opacity-70" />
                            </div>
                            <span className="text-[11px] opacity-80">
                              {tile.l}
                            </span>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            onPage?.(
                              pages.includes("campanhas")
                                ? "campanhas"
                                : (pages[1] ?? active),
                            )
                          }
                          className="flex min-h-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] border border-dashed border-white/50 text-[11px]"
                        >
                          <span className="grid size-7 place-items-center rounded-full bg-white/15">
                            <Plus size={14} />
                          </span>
                          Ver mais detalhes
                        </button>
                      </div>

                      <div className="mt-4 flex shrink-0 flex-wrap items-end gap-x-8 gap-y-3 border-t border-white/20 pt-4">
                        {[
                          {
                            l: label(ctx, "cpa"),
                            v: ctx.hideSpend
                              ? "•••"
                              : money(
                                  ctx,
                                  sel.spend / Math.max(1, sel.conversions),
                                ),
                          },
                          ...(g.sales
                            ? [
                                {
                                  l: label(ctx, "roas"),
                                  v: ctx.hideSpend
                                    ? "•••"
                                    : decimal(
                                        sel.revenue / Math.max(1, sel.spend),
                                        2,
                                      ),
                                },
                              ]
                            : []),
                          {
                            l: "CTR",
                            v: `${decimal((sel.clicks / Math.max(1, sel.impressions)) * 100, 2)}%`,
                          },
                        ].map((s) => (
                          <div key={s.l}>
                            <p className="text-[10.5px] opacity-70">{s.l}</p>
                            <p className="text-[18px] font-bold tnum">{s.v}</p>
                          </div>
                        ))}
                        <div className="ml-auto flex items-center gap-2">
                          {[Link2, CalendarDays].map((Icon, i) => (
                            <span
                              key={i}
                              className="grid size-9 place-items-center rounded-full border border-white/30"
                            >
                              <Icon size={14} />
                            </span>
                          ))}
                          <span
                            className="rounded-full bg-white px-4 py-2.5 text-[12px] font-semibold"
                            style={{ color: C.fg }}
                          >
                            {int(sel.clicks)} cliques
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ),
          }}
        />
        )}
        </div>
      </div>
    </div>
  );
}

function Trend({ c }: { c: ReturnType<typeof change> }) {
  const color = c.good === null ? C.fg2 : c.good ? "#3b9bdc" : "#e5484d";
  const Icon = c.up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className="mt-1 flex items-center gap-1 text-[11px]"
      style={{ color: C.fg2 }}
    >
      <Icon size={13} style={{ color }} />
      <span className="font-semibold" style={{ color }}>
        {c.text}
      </span>
      em relação ao período anterior
    </p>
  );
}

function Pill({
  children,
  grow,
}: {
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <span
      className={`flex h-10 items-center justify-between gap-3 rounded-[12px] border px-3 text-[12px] ${grow ? "min-w-[180px] flex-1" : "min-w-[150px]"}`}
      style={{ borderColor: C.line, background: C.card }}
    >
      {children}
    </span>
  );
}

/** Ilustração da mesa (planta, notebook, luminária), feita em SVG. */
function DeskArt() {
  return (
    <svg
      viewBox="0 0 240 100"
      className="mt-auto -mx-4 -mb-4 min-h-[40px] w-[calc(100%+2rem)] flex-[0_1_104px]"
      aria-hidden
    >
      <rect x="0" y="0" width="240" height="100" fill="#f1f1f4" />
      <rect x="0" y="78" width="240" height="22" fill="#e4e3e8" />
      <rect x="0" y="76" width="240" height="4" fill="#d6d5dc" />
      {/* planta */}
      <path d="M38 76 L44 56 L58 56 L64 76 Z" fill="#fafafa" stroke="#d9d9de" />
      <path d="M51 56 C40 40 30 36 26 22 C38 26 46 36 51 56" fill="#3d6b4f" />
      <path d="M51 56 C56 38 64 30 74 24 C70 38 62 46 51 56" fill="#4f8462" />
      <path d="M51 56 C48 40 50 28 54 14 C58 28 56 42 51 56" fill="#2f5a40" />
      {/* notebook */}
      <rect x="100" y="52" width="40" height="24" rx="2" fill="#2b2c33" />
      <rect x="94" y="75" width="52" height="3" rx="1" fill="#3a3b44" />
      {/* xícara */}
      <rect x="152" y="66" width="10" height="10" rx="2" fill="#2b2c33" />
      {/* luminária */}
      <rect x="182" y="74" width="26" height="4" rx="2" fill="#2b2c33" />
      <path
        d="M195 74 L188 48 L206 30"
        stroke="#2b2c33"
        strokeWidth="3"
        fill="none"
      />
      <path d="M200 28 L218 22 L222 38 Z" fill="#2b2c33" />
      <circle cx="216" cy="36" r="5" fill="#fff6c9" opacity="0.8" />
    </svg>
  );
}
