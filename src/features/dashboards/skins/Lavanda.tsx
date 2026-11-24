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
import { ChartTheme, DailyChart, dayDates, SkinBar, SkinChrome, SkinPage, WeekBars, type SkinPalette } from "./bklit-blocks";
import { BulletBar, WaterfallBars } from "./extras";
import { FullName } from "./FullName";
import { ADJUST_LABEL, bestDay, waterfall } from "./insights";
import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
import { LavandaReport } from "./LavandaReport";
import { SkinCreatives } from "./CreativeViews";
import { AnnexChapter } from "./TabViews";
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

/** Dia da semana de "hoje − ago" (pela data, sem fuso: igual no servidor e no navegador). */
const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function weekdayOf(today: string | undefined, ago: number): string {
  // sem o dia de hoje (miniatura, render no servidor): sem dia da semana, nada de relógio no render
  if (!today) return "";
  return WEEKDAY_LONG[new Date(Date.parse(`${today}T12:00:00Z`) - ago * 86_400_000).getUTCDay()];
}

/** Cores dos blocos exclusivos (extras.tsx) nos cards claros do Lavanda. */
const TONE = { fg: C.fg, fg2: C.fg2, line: C.line, accent: C.accent, good: "#1f9d55", bad: "#e5484d" };

/** Card claro dos blocos novos. */
function Card({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="fit-fill flex min-w-0 flex-col overflow-hidden rounded-[20px] border p-4" style={{ borderColor: C.line, background: C.card }}>
      <header className="flex shrink-0 items-baseline justify-between gap-2 text-[13px] font-semibold">
        {title}
        {note && <span className="truncate text-[11px] font-normal" style={{ color: C.fg2 }}>{note}</span>}
      </header>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// cores dos gráficos (Bklit UI) dentro dos cards claros
const CHART: SkinPalette = { scheme: "light", bg: "#ffffff", card: "#ffffff", fg: C.fg, fg2: C.fg2, line: C.line, accent: C.accent, accentSoft: C.accentSoft, onAccent: "#ffffff", muted: C.accentSoft, error: "#d92d20", errorSoft: "#fde7e4", good: "#1f9d55" };

// controles e outras abas: os componentes padrão na paleta lilás, sobre o fundo claro da moldura
const PAGE: SkinPalette = { ...CHART, bg: "#f8f9fd", accentSoft: "#e4e1fd", muted: "#c9c4fb" };

type Tab = "todas" | PlatformId;

export function LavandaSkin({
  ctx: baseCtx,
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
  month,
  pageCtx,
  cards,
}: SkinProps) {
  // "Mês anterior fechado": o mês inteiro contra o mês antes dele (não contra o trecho do período anterior)
  const monthOn = !!month?.active && !!month.before;
  const ctx = monthOn ? { ...baseCtx, prev: month!.before! } : baseCtx;
  const prevName = monthOn ? month!.info.beforeLabel : "o período anterior";
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
  // o rótulo do eixo de cada parte: o primeiro dia dela
  const partLabels = days.filter((_, i) => i % roasStep === 0).map((d) => dayLabel(d.ago, ctx.today));
  const costKnown = costParts.filter((v) => v > 0);
  const withGoal = hasGoal(ctx.ds);
  const campaignSpend = Math.max(1, campaigns.reduce((a, c) => a + c.spend, 0));

  // apresentação ao cliente: resumo em texto, destaques, comparativo e cascata da variação
  const valueKey = g.sales ? "revenue" : "conversions";
  // a cascata começa e termina nos mesmos totais do comparativo e dos cards (ctx.prev e ctx.cur)
  const cascade = waterfall(ctx.ds.campaigns, valueKey, 4, { start: ctx.prev[valueKey], end: ctx.cur[valueKey] });
  const bestCampaign = useMemo(() => [...ctx.ds.campaigns].sort((a, b) => b.conversions - a.conversions)[0], [ctx.ds.campaigns]);
  const bestCreative = useMemo(() => [...ctx.ds.creatives].sort((a, b) => b.conversions - a.conversions).find((c) => c.conversions > 0), [ctx.ds.creatives]);
  const topDay = bestDay(ctx.ds.current, (d) => d[g.conv]);
  const totalConv = Math.max(1, ctx.ds.campaigns.reduce((a, c) => a + c.conversions, 0));
  const word = (c: ReturnType<typeof change>) => (c.text === "—" ? "" : `${c.up ? "subiu" : "caiu"} ${c.text}`);
  const cost = change(ctx, g.cost);
  const cmpRows = [
    { id: g.value, label: label(ctx, g.value), money: g.sales },
    { id: "spend" as const, label: label(ctx, "spend"), money: true },
    { id: g.cost, label: label(ctx, g.cost), money: true },
    { id: g.efficiency, label: label(ctx, g.efficiency), money: false },
  ].filter((r) => !(ctx.hideSpend && r.money));

  // nada em branco: sem campanhas no período (só GA4 ou orgânico), a lista sai; a barra de filtros era só desenho
  const hide = campaigns.length ? ["s-filtros"] : ["s-filtros", "s-campanhas"];
  const nodes: Record<string, React.ReactNode> = {
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
                <Trend c={cpa} against={monthOn ? `a ${prevName}` : "ao período anterior"} />
                {costKnown.length >= 2 && !ctx.hideSpend ? (
                  <>
                    {/* com eixo: o valor à esquerda e a data de cada parte embaixo */}
                    <ChartTheme palette={CHART} className="mt-2 flex min-h-[150px] flex-1 flex-col">
                      <DailyChart
                        points={costParts.map((v) => ({ custo: v, ...(withGoal ? { meta: ctx.ds.goal } : {}) }))}
                        dates={costDates.slice(0, costParts.length)}
                        labels={partLabels.slice(0, costParts.length)}
                        series={[
                          { key: "custo", label: label(ctx, g.cost), color: C.accent, kind: "area" },
                          ...(withGoal ? [{ key: "meta", label: "Alvo de custo", color: "#9aa0b8", kind: "line" as const }] : []),
                        ]}
                        format={(_, v) => money(ctx, v)}
                        formatY={(v) => money(ctx, v, true)}
                        summary={`${label(ctx, g.cost)} ao longo do período: de ${money(ctx, Math.min(...costKnown))} a ${money(ctx, Math.max(...costKnown))}.`}
                      />
                    </ChartTheme>
                    <div className="mt-1 flex shrink-0 justify-between gap-2 text-[10.5px] tnum" style={{ color: C.fg2 }}>
                      {withGoal ? (
                        <span className="w-full">
                          <BulletBar value={ctx.cur[g.cost]} target={ctx.ds.goal} color={ctx.cur[g.cost] <= ctx.ds.goal ? "#2f9e5b" : "#e5484d"} tone={TONE} label={`${label(ctx, g.cost)} ${value(ctx, g.cost)} contra o alvo de ${money(ctx, ctx.ds.goal)}.`} />
                          <span className="mt-1 block">
                            Alvo {money(ctx, ctx.ds.goal)} · <strong style={{ color: ctx.cur[g.cost] <= ctx.ds.goal ? "#2f9e5b" : "#e5484d" }}>{ctx.cur[g.cost] <= ctx.ds.goal ? "dentro" : "acima"}</strong>
                          </span>
                        </span>
                      ) : (
                        <>
                          <span>Menor {money(ctx, Math.min(...costKnown), true)}</span>
                          <span>Maior {money(ctx, Math.max(...costKnown), true)}</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-auto text-[11.5px]" style={{ color: C.fg2 }}>
                    {ctx.hideSpend ? "Investimento oculto neste link." : "Poucos dias com resultado para mostrar a evolução."}
                  </p>
                )}
              </section>
            ),
            "s-resumo": (
              // resumo do período em texto, montado pelos números (para ler em voz alta na reunião)
              <section className="fit-fill flex min-w-0 flex-col justify-center rounded-[20px] p-4 text-white @[700px]:px-6" style={{ background: C.panel }} data-resumo>
                <p className="text-[11px] tracking-[0.12em] uppercase opacity-75">Resumo · {monthOn ? month!.info.label : periodLabel}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed @[700px]:text-[15.5px]">
                  <strong className="font-bold">{value(ctx, g.value)}</strong> {g.sales ? "de receita" : label(ctx, g.value).toLowerCase()}
                  {!ctx.hideSpend && (
                    <>
                      {" "}com <strong className="font-bold">{money(ctx, ctx.cur.spend, true)}</strong> investidos
                    </>
                  )}
                  {word(rev) && <> ({word(rev)} contra {prevName})</>}.{" "}
                  {!ctx.hideSpend && (
                    <>
                      O {label(ctx, g.cost).toLowerCase()} ficou em <strong className="font-bold">{value(ctx, g.cost)}</strong>
                      {word(cost) && <> ({word(cost)})</>}.{" "}
                    </>
                  )}
                  {bestCampaign && bestCampaign.conversions > 0 && (
                    <>
                      A campanha <strong className="font-bold">{bestCampaign.name}</strong> trouxe {decimal((bestCampaign.conversions / totalConv) * 100, 0)}% dos resultados.
                    </>
                  )}
                </p>
              </section>
            ),
            "s-destaques": (
              <Card title="Destaques do período">
                <div className="grid min-h-0 flex-1 gap-3 @[700px]:grid-cols-3">
                  <div className="flex min-w-0 flex-col rounded-[14px] p-3" style={{ background: "#f6f5fe" }}>
                    <p className="text-[11px]" style={{ color: C.fg2 }}>Melhor campanha</p>
                    {bestCampaign && bestCampaign.conversions > 0 ? (
                      <>
                        <FullName text={bestCampaign.name} lines={2} className="mt-1 text-[14px] leading-snug font-bold" />
                        <p className="mt-auto pt-2 text-[12px] tnum" style={{ color: C.fg2 }}>
                          <strong style={{ color: C.accent }}>{int(bestCampaign.conversions)}</strong> {label(ctx, "conversions").toLowerCase()} · {decimal((bestCampaign.conversions / totalConv) * 100, 0)}% do total
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-[12.5px]" style={{ color: C.fg2 }}>Sem campanhas com resultado no período.</p>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center gap-3 rounded-[14px] p-3" style={{ background: "#f6f5fe" }}>
                    {bestCreative ? (
                      <>
                        <CreativeImage src={bestCreative.imageUrl} video={isVideoFormat(bestCreative.format)} compact className="size-14 shrink-0 rounded-[12px]" fallback={<span className="grid size-full place-items-center text-[12px] font-bold text-white" style={{ background: C.accent }}>{initials(bestCreative.name)}</span>} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px]" style={{ color: C.fg2 }}>Melhor criativo</span>
                          <FullName text={bestCreative.name} className="text-[13.5px] font-bold" />
                          <span className="block text-[12px] tnum" style={{ color: C.fg2 }}>
                            <strong style={{ color: C.accent }}>{int(bestCreative.conversions)}</strong> {label(ctx, "conversions").toLowerCase()} · {bestCreative.format}
                          </span>
                        </span>
                      </>
                    ) : (
                      <p className="text-[12.5px]" style={{ color: C.fg2 }}>Os criativos aparecem quando o período tem anúncios com resultado.</p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col rounded-[14px] p-3" style={{ background: "#f6f5fe" }}>
                    <p className="text-[11px]" style={{ color: C.fg2 }}>Melhor dia</p>
                    {topDay ? (
                      <>
                        <p className="mt-1 text-[18px] font-bold">{[weekdayOf(ctx.today, topDay.ago), dayLabel(topDay.ago, ctx.today)].filter(Boolean).join(", ")}</p>
                        <p className="mt-auto pt-2 text-[12px] tnum" style={{ color: C.fg2 }}>
                          <strong style={{ color: C.accent }}>{int(topDay[g.conv])}</strong> {label(ctx, g.conv).toLowerCase()}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-[12.5px]" style={{ color: C.fg2 }}>Sem resultado no período.</p>
                    )}
                  </div>
                </div>
              </Card>
            ),
            "s-comparativo": (
              <Card title={monthOn ? `${cap(month!.info.label.replace(/ de \d+$/, ""))} e ${prevName}` : "Este período e o anterior"} note={monthOn ? "mês contra mês" : "mesmo número de dias"}>
                <ul className="space-y-3">
                  {cmpRows.map((r) => {
                    const now = ctx.cur[r.id];
                    const before = ctx.prev[r.id];
                    const top = Math.max(now, before, 1e-9);
                    const c = change(ctx, r.id);
                    return (
                      <li key={r.id} data-comparativo={r.id} data-anterior={before} data-atual={now}>
                        <p className="flex items-baseline justify-between gap-2 text-[12px]">
                          <span style={{ color: C.fg2 }}>{r.label}</span>
                          <span className="tnum">
                            <strong className="font-bold">{value(ctx, r.id)}</strong>{" "}
                            <span style={{ color: c.good === null ? C.fg2 : c.good ? "#2f9e5b" : "#e5484d" }} className="text-[11px] font-semibold">
                              {c.text === "—" ? "" : `${c.up ? "▲" : "▼"} ${c.text}`}
                            </span>
                          </span>
                        </p>
                        <div className="mt-1 space-y-1" aria-hidden>
                          <span className="block h-2 rounded-full" style={{ width: `${(before / top) * 100}%`, background: C.accentSoft }} title="Período anterior" />
                          <span className="block h-2 rounded-full" style={{ width: `${(now / top) * 100}%`, background: C.accent }} title="Este período" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-auto flex gap-3 pt-3 text-[10.5px]" style={{ color: C.fg2 }}>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: C.accentSoft }} /> {monthOn ? prevName : "anterior"}</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: C.accent }} /> {monthOn ? month!.info.label.replace(/ de \d+$/, "") : "este período"}</span>
                </p>
              </Card>
            ),
            "s-cascata": (
              <Card title="O que explica a variação" note={`${label(ctx, valueKey)} por campanha`}>
                {cascade && !monthOn && !(ctx.hideSpend && g.sales) ? (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col" data-cascata-de={cascade.start} data-cascata-para={cascade.end}>
                      <WaterfallBars w={cascade} tone={TONE} base={C.accent} format={(v) => (g.sales ? money(ctx, v, true) : int(v))} />
                    </div>
                    {cascade.steps.some((st) => st.label === ADJUST_LABEL) && (
                      <p className="mt-2 shrink-0 text-[10.5px] leading-snug" style={{ color: C.fg2 }}>
                        {ADJUST_LABEL}: o que o total do dashboard conta e as campanhas não, ou contam duas vezes (a mesma conversão atribuída a duas plataformas).
                      </p>
                    )}
                  </>
                ) : (
                  <p className="m-auto text-center text-[12.5px]" style={{ color: C.fg2 }}>{monthOn ? `No mês fechado, a comparação com ${prevName} é dos totais: por campanha, só no período corrido.` : "Sem o período anterior por campanha para comparar."}</p>
                )}
              </Card>
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
                <Trend c={rev} against={monthOn ? `a ${prevName}` : "ao período anterior"} />
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
                <Trend c={roas} against={monthOn ? `a ${prevName}` : "ao período anterior"} />
                <ChartTheme palette={CHART} className="mt-2 flex min-h-[150px] flex-1 flex-col">
                  <DailyChart
                    points={roasLine.map((v) => ({ roas: v }))}
                    dates={roasDates.slice(0, roasLine.length)}
                    labels={partLabels.slice(0, roasLine.length)}
                    series={[{ key: "roas", label: label(ctx, g.efficiency), color: C.accent, kind: "area" }]}
                    format={(_, v) => showEfficiency(v)}
                    formatY={(v) => showEfficiency(v)}
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
};

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
                {p === "visao-geral" ? REPORT_NAME : PAGES[p].name}
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
              {monthOn ? `mês fechado · ${month!.info.label}` : periodLabel}
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
        {children ? (
          // as abas anexas também são capítulos: o texto e o destaque, e o conteúdo embaixo
          <SkinPage palette={PAGE}>
            {active === "criativos" && cards && cards.level !== "list" ? (
              <SkinCreatives kind="lavanda" list={cards.source} data={cards.data} kpis={cards.kpis} />
            ) : (
              <AnnexChapter ctx={pageCtx ?? ctx} name={PAGES[active].name}>
                {children}
              </AnnexChapter>
            )}
          </SkinPage>
        ) : (
        <LavandaReport
          ctx={ctx}
          nodes={nodes}
          grid={grid}
          hide={hide}
          pages={pages}
          onPage={onPage}
          periodLabel={periodLabel}
          month={month}
          monthOn={monthOn}
          palette={PAGE}
          tone={{ fg: C.fg, fg2: C.fg2, line: C.line, accent: C.accent, accentSoft: C.accentSoft, dark: C.dark, card: C.card }}
        />
        )}
        </div>
      </div>
    </div>
  );
}

/** A primeira aba do Lavanda é o relatório. */
export const REPORT_NAME = "Relatório do período";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Trend({ c, against }: { c: ReturnType<typeof change>; against: string }) {
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
      em relação {against}
    </p>
  );
}

