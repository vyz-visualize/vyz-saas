"use client";

// Visual "Lavanda": claro, em lilás. Cards claros com gráfico em cima (o custo por resultado
// ao longo do período, as barras da receita com o valor de cada parte), barra de filtros e o
// painel escuro com a lista de campanhas e o detalhe da escolhida em lilás. Sem dado
// inventado: o status das campanhas não vem das plataformas, então não aparece.

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { PAGES } from "@/features/templates/pages";
import { hasGoal } from "@/features/metrics/targets";
import { ChartTheme, dayDates, FlowLines, SkinBar, SkinChrome, SkinPage, WeekBars, type SkinPalette } from "./bklit-blocks";
import { FullName } from "./FullName";
import { SkinGrid } from "./SkinGrid";
import {
  buckets,
  change,
  chrono,
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
  // busca de campanha (no painel das campanhas): filtra a lista pelo nome
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const list = (tab === "todas" ? campaigns : campaigns.filter((c) => c.platform === tab)).filter((c) => !q || c.name.toLocaleLowerCase("pt-BR").includes(q));
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
  // as plataformas com investimento no período (com uma só, a divisão não diz nada)
  const spendingPlats = byPlat.filter((p) => p.spend > 0);
  const topShare = Math.round(((byPlat.find((p) => p.id === topPlat)?.spend ?? 0) / Math.max(1, ctx.cur.spend)) * 100);
  // valor curto embaixo de cada barra ("9,4 mil"): o título do card já diz o que é (dinheiro vem em centavos)
  const shortValue = (v: number) => (g.sales ? money(ctx, v, true).replace(/^R\$\s?/, "") : v >= 10_000 ? `${decimal(v / 1000, 0)} mil` : int(v));
  // custo por resultado ao longo do período (9 partes): o gráfico do primeiro card
  const costParts = buckets(days.map((d) => d.spend), 9).map((sp, i) => {
    const r = buckets(days.map((d) => d[g.conv]), 9)[i];
    return r > 0 ? sp / r : 0;
  });
  const costDates = dayDates(days.filter((_, i) => i % roasStep === 0).map((d) => d.ago), ctx.today);
  const costKnown = costParts.filter((v) => v > 0);
  const withGoal = hasGoal(ctx.ds);
  const campaignSpend = Math.max(1, campaigns.reduce((a, c) => a + c.spend, 0));

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
            data-tour="abas"
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
          {/* os atalhos de enfeite (PDF, agenda, link, sino) e o avatar repetido não tinham ação: saíram */}
        </div>

        {/* título (com o voltar de verdade no topo, a seta de enfeite sai para não repetir) */}
        <div className={`flex flex-wrap items-center ${screen ? "mt-3 gap-3" : "mt-6 gap-4"}`}>
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
          {/* selo informativo (não é botão): o número principal do objetivo no período */}
          <p
            className="flex shrink-0 items-baseline gap-2 rounded-full border px-4 py-1.5 text-[12px]"
            style={{ borderColor: C.accentSoft, background: "#eeedfd", color: C.fg2 }}
            data-selo
          >
            {label(ctx, g.value)} <strong className="text-[15px] font-bold tnum" style={{ color: C.accent }}>{value(ctx, g.value)}</strong>
          </p>
        </div>

        <SkinChrome palette={PAGE} controls={controls} note={note} screen={screen} className="mt-4" />

        {/* respiro entre o título e os cards; nas outras abas, os blocos padrão na paleta do visual */}
        <div className={screen ? "mt-3" : "mt-5"}>
        {children ? <SkinPage palette={PAGE}>{children}</SkinPage> : (
        <SkinGrid
          skin="lavanda"
          palette={PAGE}
          ctx={ctx}
          grid={grid}
          // nada em branco: sem campanhas no período (só GA4 ou orgânico), a lista e os filtros dela saem
          // a barra de filtros era só desenho: sai (a plataforma e a busca ficam no painel das campanhas)
          hide={campaigns.length ? ["s-filtros"] : ["s-filtros", "s-campanhas"]}
          nodes={{
            "s-cpa": (
              <section
                className="fit-fill flex min-h-[230px] flex-col overflow-hidden rounded-[20px] border p-4"
                style={{ borderColor: C.line, background: C.card }}
              >
                <header className="flex shrink-0 items-center justify-between text-[13px] font-semibold">
                  {label(ctx, g.cost)}
                  {/* o alerta só aparece quando o custo piorou */}
                  {cpa.good === false ? <AlertCircle size={16} className="text-red-500" aria-label="Custo subiu" /> : <Wallet size={16} style={{ color: C.accent }} aria-hidden />}
                </header>
                <p className="mt-3 shrink-0 text-[28px] leading-tight font-bold tracking-tight tnum">
                  {value(ctx, g.cost)}
                </p>
                <Trend c={cpa} />
                {costKnown.length >= 2 && !ctx.hideSpend ? (
                  <>
                    <ChartTheme palette={CHART} className="mt-2 flex min-h-[min(72px,var(--fit-cap,72px))] flex-1 flex-col">
                      <FlowLines
                        className="flex-1"
                        points={costParts.map((v) => ({ custo: v, ...(withGoal ? { meta: ctx.ds.goal } : {}) }))}
                        dates={costDates}
                        series={[
                          { key: "custo", label: label(ctx, g.cost), color: C.accent, width: 2.2, area: 0.18 },
                          ...(withGoal ? [{ key: "meta", label: "Meta de custo", color: "#9aa0b8", width: 1.4, dashed: true }] : []),
                        ]}
                        format={(_, v) => money(ctx, v)}
                        summary={`${label(ctx, g.cost)} ao longo do período: de ${money(ctx, Math.min(...costKnown))} a ${money(ctx, Math.max(...costKnown))}.`}
                      />
                    </ChartTheme>
                    <p className="mt-1 flex shrink-0 justify-between gap-2 text-[10.5px] tnum" style={{ color: C.fg2 }}>
                      {withGoal ? (
                        <span>
                          Meta {money(ctx, ctx.ds.goal)} · <strong style={{ color: ctx.cur[g.cost] <= ctx.ds.goal ? "#2f9e5b" : "#e5484d" }}>{ctx.cur[g.cost] <= ctx.ds.goal ? "dentro" : "acima"}</strong>
                        </span>
                      ) : (
                        <>
                          <span>Menor {money(ctx, Math.min(...costKnown), true)}</span>
                          <span>Maior {money(ctx, Math.max(...costKnown), true)}</span>
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-auto text-[11.5px]" style={{ color: C.fg2 }}>
                    {ctx.hideSpend ? "Investimento oculto neste link." : "Poucos dias com resultado para mostrar a evolução."}
                  </p>
                )}
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
                    showValues
                    valueFormat={shortValue}
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
                  {/* com uma plataforma só, a divisão não diz nada: a etiqueta some */}
                  {spendingPlats.length > 1 && topPlat && (
                    <span
                      className="self-end rounded-full px-3 py-2 text-[10.5px] font-semibold whitespace-nowrap text-white"
                      style={{ background: C.dark }}
                    >
                      {topShare}% no {platformName(topPlat)}
                    </span>
                  )}
                </div>
              </section>
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
                  <label className="order-last flex h-9 w-full items-center gap-2 rounded-full bg-white/10 px-3 text-[12px] @[900px]:order-none @[900px]:ml-auto @[900px]:w-[220px]">
                    <Search size={14} className="shrink-0 opacity-70" aria-hidden />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPicked(null);
                      }}
                      placeholder="Buscar campanha"
                      aria-label="Buscar campanha"
                      className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/50"
                    />
                  </label>
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
                    {list.length === 0 && <li className="px-3 py-2.5 text-[12.5px] opacity-70">Nenhuma campanha com “{query.trim()}”.</li>}
                    {list.slice(0, 6).map((c) => {
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
                              <span className="block truncate text-[12.5px] font-semibold" title={c.name}>
                                {c.name}
                              </span>
                              <span className="block text-[10.5px] opacity-60">
                                {platformName(c.platform)}
                              </span>
                            </span>
                            {/* parte da verba do período (o status da campanha não vem das plataformas) */}
                            {!ctx.hideSpend && (
                              <span
                                className="hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium tnum @[520px]:inline"
                                style={
                                  on
                                    ? { background: "#fff", color: C.fg }
                                    : { background: C.dark2, color: "#cfd0e0" }
                                }
                                title="Parte do investimento do período"
                              >
                                {decimal((c.spend / campaignSpend) * 100, 0)}% da verba
                              </span>
                            )}
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
                          {/* nome longo: duas linhas com reticências; o inteiro ao apontar ou tocar */}
                          <FullName key={sel.id} text={sel.name} lines={2} className="mt-1 text-[18px] leading-tight font-bold tracking-tight @[700px]:text-[22px]" />
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

                      <div className="mt-4 grid flex-[1_1_96px] auto-rows-[minmax(68px,1fr)] grid-cols-2 gap-2.5 @[700px]:grid-cols-4">
                        {[
                          { v: money(ctx, sel.spend, true), l: "Investimento" },
                          ...(g.sales
                            ? [
                                {
                                  v: money(ctx, sel.revenue, true),
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
                            className="flex min-w-0 flex-col justify-between gap-1 rounded-[14px] bg-white/12 p-3"
                          >
                            <span className="min-w-0 truncate text-[14px] font-bold tnum @[700px]:text-[16px]">
                              {tile.v}
                            </span>
                            <span className="truncate text-[11px] opacity-80">
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
                          className="flex min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] border border-dashed border-white/50 p-2 text-center text-[11px]"
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

