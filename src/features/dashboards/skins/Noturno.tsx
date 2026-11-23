"use client";

// Visual "Noturno": análise, em azul-noite com a receita em âmbar. Filtros fixos no topo
// (plataforma, campanha, dia da semana e comparar), a faixa de números, o mestre-detalhe (as
// campanhas à esquerda; o escolhido à direita, com o dia a dia, os dias fora do padrão e o
// período anterior), dia da semana × hora e onde o mês fecha. Nas abas de cada plataforma, o
// mesmo mestre-detalhe só com as campanhas dela; com o catálogo, a aba "Produtos" (NoturnoParts).
// Fora dos objetivos de venda, o resultado do objetivo toma o lugar da receita.

import { breakEvenOf, GOAL_INVITE, hasGoal, hasMargin, MARGIN_INVITE } from "@/features/metrics/targets";
import { CalendarDays, CircleDollarSign, Percent, ShoppingBag, Target, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { metric } from "@/features/metrics/definitions";
import { PAGES } from "@/features/templates/pages";
import { brlCompact } from "@/lib/format";
import { Block, SkinBar, SkinChrome, SkinPage, StatBlock, themeVars, type SkinPalette } from "./bklit-blocks";
import { HeatGrid, MonthCloseChart } from "./extras";
import { heatPeak, monthClose, WEEKDAYS } from "./insights";
import { SkinGrid } from "./SkinGrid";
import { AnalysisBar, MasterDetail, ProductsPage } from "./NoturnoParts";
import { PAGE_PLATFORM } from "@/features/templates/dashboards/composed";
import { brl, change, daily, decimal, goalOf, int, label, value, type SkinProps } from "./shared";

const P: SkinPalette = {
  scheme: "dark",
  bg: "#0c101a",
  card: "#151a28",
  fg: "#eef0f7",
  fg2: "#8b93a8",
  line: "#242b3d",
  accent: "#ffb347",
  accentSoft: "#3a2c14",
  onAccent: "#1c1304",
  muted: "#39415a",
  error: "#ff8f7d",
  errorSoft: "#3d201c",
  good: "#5fd6a4",
};
const BLUE = "#6ea8ff";
const VIOLET = "#b392ff";
/** A linha do período anterior. */
const PREV = "rgb(238 240 247 / 0.45)";
const HERO = "linear-gradient(140deg,#ffc76e 0%,#ff9f43 100%)";
/** Cores dos blocos exclusivos (extras.tsx). */
const TONE = { fg: P.fg, fg2: P.fg2, line: P.line, accent: P.accent, good: P.good, bad: P.error };

export function NoturnoSkin({ ctx, name, client, pages, active, onPage, periodLabel, grid, controls, note, children, screen, bar }: SkinProps) {
  // filtros desta análise: o dia da semana e o comparar (plataforma e campanha são os do dashboard)
  const [weekday, setWeekday] = useState<number | null>(null);
  const [compare, setCompare] = useState(true);
  const ownPage = active === "produtos" && !children;
  const only = PAGE_PLATFORM[active];
  const platformTab = only && (active === "meta-ads" || active === "google-ads") && ctx.ds.campaigns.some((c) => c.platform === only) ? only : null;
  const hide = !!ctx.hideSpend;
  const current = ctx.ds.current;
  // objetivo de venda: receita, ROAS e funil de compra; nos outros, o resultado do objetivo
  // (leads, agendamentos...), a taxa de conversão e o custo por resultado
  // memorizado: o compilador do React sabe que não muda depois (as listas abaixo dependem dele)
  const g = useMemo(() => goalOf(ctx.profile, ctx.cur.leads), [ctx.profile, ctx.cur.leads]);
  const valueKey = g.value;
  const resultName = metric(g.conv, ctx.profile).label;
  const showValue = (v: number) => (g.sales ? brlCompact(v) : int(v));

  // tendência: dias fora do padrão, dia da semana × hora, onde o mês fecha e as campanhas dia a dia
  const hourWeek = ctx.ds.hourWeek;
  const peak = useMemo(() => heatPeak(hourWeek), [hourWeek]);
  const close = useMemo(() => monthClose(current, (d) => d[valueKey], ctx.ds.budget), [current, valueKey, ctx.ds.budget]);
  // nada em branco: sem a quebra por hora, a grade sai; sem dias para a previsão, o fecha sai (o vizinho ocupa)
  const hidden = [...(peak ? [] : ["s-calor"]), ...(close ? [] : ["s-fecha"])];

  const nodes = {
    "s-receita": <StatBlock title={label(ctx, valueKey)} v={value(ctx, valueKey)} delta={change(ctx, valueKey)} note="contra o período anterior" values={daily(ctx, valueKey)} icon={g.sales ? CircleDollarSign : Target} solid={HERO} />,
    "s-invest": <StatBlock title={label(ctx, "spend")} v={value(ctx, "spend")} delta={hide ? undefined : change(ctx, "spend")} note={hide ? "oculto neste link" : `${int(ctx.cur[g.conv])} ${resultName.toLowerCase()}`} values={hide ? undefined : daily(ctx, "spend")} color={BLUE} icon={Wallet} />,
    "s-roas": !g.sales ? (
      <StatBlock title={label(ctx, "convRate")} v={value(ctx, "convRate")} delta={change(ctx, "convRate")} note={`${resultName.toLowerCase()} ÷ visitas da página`} values={daily(ctx, "convRate")} color={P.accent} icon={Percent} />
    ) : <StatBlock title={label(ctx, "roas")} v={value(ctx, "roas")} delta={hide ? undefined : change(ctx, "roas")} note={hide ? undefined : `equilíbrio em ${decimal(breakEvenOf(ctx.ds), 1)}${hasMargin(ctx.ds) ? "" : ` · ${MARGIN_INVITE}`}`} values={hide ? undefined : daily(ctx, "roas")} color={P.accent} icon={Percent} />,
    "s-cpa": <StatBlock title={label(ctx, g.cost)} v={value(ctx, g.cost)} delta={hide ? undefined : change(ctx, g.cost)} note={hide ? undefined : hasGoal(ctx.ds) ? `alvo ${brl(ctx.ds.goal, { decimals: false })}` : GOAL_INVITE} values={hide ? undefined : daily(ctx, g.cost)} color={VIOLET} icon={Target} />,
    "s-calor": (
      <Block title={`${resultName} por dia da semana e hora`} aside={peak ? <span className="text-[11px] text-fg-2">pico: {WEEKDAYS[peak.day]}, {peak.hour}h</span> : undefined}>
        {hourWeek && <HeatGrid grid={hourWeek} color={P.accent} tone={TONE} what={resultName} format={(v) => decimal(v, v < 10 ? 1 : 0)} />}
        <p className="mt-auto pt-2 text-[10.5px] text-fg-2">Pela hora de cada dia na Meta, no fuso da conta.</p>
      </Block>
    ),
    "s-fecha": (
      <Block title="Onde o mês fecha" aside={<span className="text-[11px] text-fg-2">dia {ctx.ds.budget.day} de {ctx.ds.budget.daysInMonth}</span>}>
        {close && !(hide && g.sales) && (
          <>
            <p className="text-[24px] leading-tight font-bold tnum">{showValue(close.total)}</p>
            <p className="text-[11.5px] text-fg-2 tnum">
              entre {showValue(close.totalLo)} e {showValue(close.totalHi)} · {label(ctx, valueKey).toLowerCase()} no mês
            </p>
            <MonthCloseChart m={close} color={P.accent} tone={TONE} label={`${label(ctx, valueKey)} no mês: ${showValue(close.done.at(-1) ?? 0)} até hoje; deve fechar em ${showValue(close.total)}.`} className="mt-3 min-h-[70px] flex-1" />
            <p className="mt-1 text-[10.5px] text-fg-2">Cheio: até hoje · tracejado: a previsão, com a faixa de 95%</p>
          </>
        )}
      </Block>
    ),
    "s-analise": <MasterDetail ctx={ctx} tone={TONE} weekday={weekday} compare={compare} accent={P.accent} prevColor={PREV} />,
  };

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div data-chart-theme className={screen ? "@container" : "@container rounded-[32px] p-2.5 @[700px]:p-4"} style={{ ...themeVars(P), background: screen ? P.bg : "#05070c" }}>
      <div className={screen ? "min-h-dvh px-4 pt-3 pb-[var(--screen-pb,7rem)] @[700px]:px-6" : "rounded-[26px] p-4 @[700px]:p-6"} style={{ background: `radial-gradient(820px 340px at 88% -12%, rgb(255 179 71 / 0.11), transparent 62%), ${P.bg}` }}>
        <SkinBar palette={P} bar={bar} className="mb-3" />
        {/* topo: marca do cliente, abas em pílula e período */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[13px]" style={{ background: HERO, color: P.onAccent }}>
              {g.sales ? <ShoppingBag size={18} strokeWidth={2.2} /> : <Target size={18} strokeWidth={2.2} />}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] font-medium tracking-[0.08em] text-fg-2 uppercase">{client}</p>
              <h2 className="truncate text-[18px] font-bold tracking-tight">{name}</h2>
            </div>
          </div>
          <nav data-tour="abas" className="order-last flex w-full min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-[22px] border border-line p-1 [scrollbar-width:none] @[900px]:order-none @[900px]:ml-2 @[900px]:w-auto @[900px]:flex-1 [&>*]:shrink-0 [&>*]:whitespace-nowrap" style={{ background: "rgb(255 255 255 / 0.03)" }}>
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage?.(p)}
                aria-current={p === active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${p === active ? "" : "text-fg-2 hover:text-fg"}`}
                style={p === active ? { background: P.fg, color: P.bg } : undefined}
              >
                {PAGES[p].name}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* sem os controles (galeria, PDF), o período aparece só como etiqueta */}
            {!controls && (
              <span className="flex h-9 items-center gap-2 rounded-full border border-line px-3 text-[11.5px] text-fg-2">
                <CalendarDays size={14} /> {periodLabel}
              </span>
            )}
          </div>
        </div>

        <SkinChrome palette={P} controls={controls} note={note} screen={screen} className="mt-4" />

        <div className="mt-5">
          {children ? (
            <>
              {/* abas de uma plataforma: o mesmo mestre-detalhe, só com as campanhas dela */}
              {platformTab && (
                <div className="mb-4 space-y-3">
                  <AnalysisBar ctx={ctx} weekday={weekday} setWeekday={setWeekday} compare={compare} setCompare={setCompare} platformOnly={platformTab} />
                  <div className="flex h-auto flex-col @[900px]:h-[440px] [&>*]:flex-1">
                    <MasterDetail ctx={ctx} tone={TONE} weekday={weekday} compare={compare} platform={platformTab} accent={P.accent} prevColor={PREV} />
                  </div>
                </div>
              )}
              <SkinPage palette={P}>{children}</SkinPage>
            </>
          ) : ownPage ? (
            <ProductsPage ctx={ctx} tone={TONE} />
          ) : (
            <>
              {/* filtros fixos da análise: valem para a aba (plataforma e campanha) e para a lista e o detalhe (dia da semana) */}
              <AnalysisBar ctx={ctx} weekday={weekday} setWeekday={setWeekday} compare={compare} setCompare={setCompare} />
              <div className="mt-4">
                <SkinGrid skin="noturno" ctx={ctx} grid={grid} nodes={nodes} hide={hidden} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
