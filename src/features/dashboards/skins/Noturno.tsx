"use client";

// Visual "Noturno": painel azul-noite com a receita em âmbar e o investimento em azul.
// Faixa de números com minilinha, receita e investimento por dia, anéis por canal, funil
// de compra, produtos e campanhas. Fora dos objetivos de venda, o resultado do objetivo
// (leads, agendamentos...) toma o lugar da receita e a taxa de conversão o do ROAS.
// Gráficos da Bklit UI.

import { funnelRows, funnelSummary } from "@/features/metrics/funnel";
import { breakEvenOf, GOAL_INVITE, hasGoal, hasMargin, MARGIN_INVITE } from "@/features/metrics/targets";
import { CalendarDays, CircleDollarSign, Percent, ShoppingBag, Target, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { biggestDrop, platformPart } from "@/features/metrics/compute";
import { metric } from "@/features/metrics/definitions";
import { PAGES } from "@/features/templates/pages";
import { brlCompact } from "@/lib/format";
import { Block, SkinBar, SkinChrome, SkinPage, DailyChart, dayDates, LegendDots, Segmented, ShareRings, StageFunnel, StatBlock, themeVars, weekly, weekStarts, type DailySeries, type SkinPalette } from "./bklit-blocks";
import { HeatGrid, MiniSpark, MonthCloseChart, MoveTag } from "./extras";
import { FullName } from "./FullName";
import { dayNotes, heatPeak, monthClose, productMovers, sharesOfTotal, WEEKDAYS } from "./insights";
import { SkinGrid } from "./SkinGrid";
import { brl, change, chrono, daily, dayLabel, decimal, goalOf, HIDDEN, initials, int, Invite, label, money, platformName, value, type SkinProps } from "./shared";

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
const TEAL = "#5fd6c0";
const CHANNEL = [P.accent, BLUE, VIOLET, TEAL];
const HERO = "linear-gradient(140deg,#ffc76e 0%,#ff9f43 100%)";
/** Cores dos blocos exclusivos (extras.tsx). */
const TONE = { fg: P.fg, fg2: P.fg2, line: P.line, accent: P.accent, good: P.good, bad: P.error };

export function NoturnoSkin({ ctx, name, client, pages, active, onPage, periodLabel, grid, controls, note, children, screen, bar }: SkinProps) {
  const [mode, setMode] = useState<"dia" | "semana">("dia");
  const hide = !!ctx.hideSpend;
  const current = ctx.ds.current;
  const days = useMemo(() => chrono(current), [current]);
  // objetivo de venda: receita, ROAS e funil de compra; nos outros, o resultado do objetivo
  // (leads, agendamentos...), a taxa de conversão e o custo por resultado
  // memorizado: o compilador do React sabe que não muda depois (as listas abaixo dependem dele)
  const g = useMemo(() => goalOf(ctx.profile, ctx.cur.leads), [ctx.profile, ctx.cur.leads]);
  const valueKey = g.value;
  const resultName = metric(g.conv, ctx.profile).label;
  const showValue = (v: number) => (g.sales ? brlCompact(v) : int(v));

  // receita e investimento por dia (ou somados por semana); fora de venda, só o resultado (outra escala)
  const chart = useMemo(() => {
    const byWeek = mode === "semana";
    const revenue = byWeek ? weekly(days.map((d) => d[valueKey])) : days.map((d) => d[valueKey]);
    const spend = byWeek ? weekly(days.map((d) => d.spend)) : days.map((d) => d.spend);
    const first = byWeek ? weekStarts(days) : days;
    return {
      points: revenue.map((r, i): Record<string, number> => (hide || valueKey !== "revenue" ? { revenue: r } : { revenue: r, spend: spend[i] })),
      dates: dayDates(first.map((d) => d.ago), ctx.today),
      labels: first.map((d) => dayLabel(d.ago, ctx.today)),
    };
  }, [ctx.today, days, hide, mode, valueKey]);
  const series: DailySeries[] = [
    ...(hide || !g.sales ? [] : [{ key: "spend", label: label(ctx, "spend"), color: BLUE, kind: "bar" as const }]),
    { key: "revenue", label: label(ctx, valueKey), color: P.accent, kind: "area" as const },
  ];

  const channels = useMemo(
    () =>
      ctx.ds.adPlatforms
        .map((id) => ({ id, t: platformPart(ctx.ds, id, "current") }))
        .sort((a, b) => b.t[valueKey] - a.t[valueKey])
        .map((c, i) => ({ ...c, color: CHANNEL[i % CHANNEL.length] })),
    [ctx.ds, valueKey],
  );
  const totalRevenue = channels.reduce((a, c) => a + c.t[valueKey], 0);
  // o anel divide o total do card na proporção do que cada canal atribui a si (as partes somam o card)
  const cardTotal = ctx.cur[valueKey];
  const channelShares = sharesOfTotal(channels.map((c) => ({ ...c, value: g.sales ? c.t.revenue / 100 : c.t[valueKey] })), g.sales ? cardTotal / 100 : cardTotal);

  const funnel = ctx.ds.funnel;
  const drop = funnel.length > 1 ? biggestDrop(funnel) : 0;
  const products = useMemo(() => [...ctx.ds.products].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [ctx.ds.products]);
  const campaigns = useMemo(() => [...ctx.ds.campaigns].sort((a, b) => (g.sales ? b.revenue - a.revenue : b.conversions - a.conversions)).slice(0, 5), [ctx.ds.campaigns, g.sales]);
  const breakEven = ctx.ds.breakEven;

  // tendência: dias fora do padrão, dia da semana × hora, onde o mês fecha e as campanhas dia a dia
  const notes = useMemo(() => dayNotes(current, (d) => d[valueKey], 3), [current, valueKey]);
  const hourWeek = ctx.ds.hourWeek;
  const peak = useMemo(() => heatPeak(hourWeek), [hourWeek]);
  const close = useMemo(() => monthClose(current, (d) => d[valueKey], ctx.ds.budget), [current, valueKey, ctx.ds.budget]);
  const moving = useMemo(() => new Map(productMovers(ctx.ds.products, 5).map((m) => [m.item.name, m.moved])), [ctx.ds.products]);
  const minis = useMemo(() => [...ctx.ds.campaigns].filter((c) => c.daily && c.conversions > 0).sort((a, b) => b.conversions - a.conversions).slice(0, 6), [ctx.ds.campaigns]);
  const miniMax = Math.max(1e-9, ...minis.flatMap((c) => c.daily?.conversions ?? []));

  // nada em branco: fora de venda, produtos saem (o funil ocupa o espaço); funil e campanhas vazios também saem;
  // com um canal só, o anel de 100% não diz nada (o gráfico do lado ocupa); sem a quebra por hora, a grade sai
  const hidden = [
    ...(g.sales ? [] : ["s-produtos"]),
    ...(funnel.length < 2 ? ["s-funil"] : []),
    ...(campaigns.length ? [] : ["s-campanhas"]),
    ...(channels.length < 2 ? ["s-canais"] : []),
    ...(peak ? [] : ["s-calor"]),
    ...(close ? [] : ["s-fecha"]),
    ...(minis.length >= 2 ? [] : ["s-minis"]),
  ];

  const nodes = {
    "s-receita": <StatBlock title={label(ctx, valueKey)} v={value(ctx, valueKey)} delta={change(ctx, valueKey)} note="contra o período anterior" values={daily(ctx, valueKey)} icon={g.sales ? CircleDollarSign : Target} solid={HERO} />,
    "s-invest": <StatBlock title={label(ctx, "spend")} v={value(ctx, "spend")} delta={hide ? undefined : change(ctx, "spend")} note={hide ? "oculto neste link" : `${int(ctx.cur[g.conv])} ${resultName.toLowerCase()}`} values={hide ? undefined : daily(ctx, "spend")} color={BLUE} icon={Wallet} />,
    "s-roas": !g.sales ? (
      <StatBlock title={label(ctx, "convRate")} v={value(ctx, "convRate")} delta={change(ctx, "convRate")} note={`${resultName.toLowerCase()} ÷ visitas da página`} values={daily(ctx, "convRate")} color={P.accent} icon={Percent} />
    ) : <StatBlock title={label(ctx, "roas")} v={value(ctx, "roas")} delta={hide ? undefined : change(ctx, "roas")} note={hide ? undefined : `equilíbrio em ${decimal(breakEvenOf(ctx.ds), 1)}${hasMargin(ctx.ds) ? "" : ` · ${MARGIN_INVITE}`}`} values={hide ? undefined : daily(ctx, "roas")} color={P.accent} icon={Percent} />,
    "s-cpa": <StatBlock title={label(ctx, g.cost)} v={value(ctx, g.cost)} delta={hide ? undefined : change(ctx, g.cost)} note={hide ? undefined : hasGoal(ctx.ds) ? `alvo ${brl(ctx.ds.goal, { decimals: false })}` : GOAL_INVITE} values={hide ? undefined : daily(ctx, g.cost)} color={VIOLET} icon={Target} />,
    "s-vendas": (
      <Block
        title={!g.sales ? `${resultName} por dia` : hide ? "Receita por dia" : "Receita e investimento"}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <LegendDots items={series.map((s) => ({ label: s.label, color: s.color })).reverse()} />
            <Segmented
              label="Agrupar por"
              value={mode}
              onChange={setMode}
              options={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
              ]}
            />
          </div>
        }
      >
        <DailyChart
          points={chart.points}
          dates={chart.dates}
          labels={chart.labels}
          series={series}
          format={(_, v) => (g.sales ? brl(v, { decimals: false }) : int(v))}
          formatY={g.sales ? brlCompact : int}
          summary={`${label(ctx, valueKey)} por ${mode}: total de ${value(ctx, valueKey)} no período.`}
        />
        {notes.length > 0 && (
          // os dias fora do padrão, explicados: o esperado vem da tendência com o dia da semana
          <p className="mt-2 shrink-0 text-[11px] text-fg-2" data-notas>
            Fora do padrão:{" "}
            {notes.map((n, i) => (
              <span key={n.ago}>
                {i > 0 && " · "}
                <strong className="font-semibold text-fg">{dayLabel(n.ago, ctx.today)}</strong>{" "}
                <span style={{ color: n.change > 0 ? P.good : P.error }}>
                  {n.change > 0 ? "+" : "−"}
                  {decimal(Math.abs(n.change) * 100, 0)}%
                </span>{" "}
                contra o esperado
              </span>
            ))}
          </p>
        )}
      </Block>
    ),
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
    "s-minis": (
      <Block title="Campanhas dia a dia" aside={<span className="text-[11px] text-fg-2">{label(ctx, "conversions").toLowerCase()} · mesma escala</span>}>
        {/* a fileira se ajusta ao número de campanhas: cada cartão cresce e não sobra buraco */}
        <div className="flex min-h-0 flex-1 flex-wrap gap-3">
          {minis.map((c) => (
            <div key={c.id} className="flex min-w-[140px] flex-[1_1_140px] flex-col rounded-[12px] border border-line p-2.5">
              <FullName text={c.name} className="text-[11.5px] font-medium" />
              <p className="text-[15px] font-bold tnum">{int(c.conversions)}</p>
              <MiniSpark values={c.daily?.conversions ?? []} color={P.accent} scaleMax={miniMax} className="mt-auto h-8 w-full" label={`${c.name}: ${int(c.conversions)} ${label(ctx, "conversions").toLowerCase()} no período`} />
            </div>
          ))}
        </div>
      </Block>
    ),
    "s-canais": (
      <Block title={`${label(ctx, valueKey)} por canal`}>
        <span hidden data-anel-total={g.sales ? cardTotal / 100 : cardTotal} data-anel-partes={channelShares.items.reduce((x, c) => x + c.value, 0)} />
        <ShareRings
          className="flex-1"
          items={channelShares.items.map((c) => ({ label: platformName(c.id), value: c.value, color: c.color }))}
          centerLabel={label(ctx, valueKey)}
          format={g.sales ? { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }}
          summary={`${label(ctx, valueKey)} por canal (total ${value(ctx, valueKey)}): ${channelShares.items.map((c) => `${platformName(c.id)} ${showValue(g.sales ? c.value * 100 : c.value)}`).join(", ")}.`}
        />
        <ul className="mt-3 space-y-1.5 text-[12px]">
          {channelShares.items.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{platformName(c.id)}</span>
              <span className="text-fg-2 tnum">{totalRevenue > 0 ? `${Math.round((c.t[valueKey] / totalRevenue) * 100)}%` : "—"}</span>
              <span className="w-[74px] text-right font-semibold tnum">{showValue(g.sales ? c.value * 100 : c.value)}</span>
            </li>
          ))}
        </ul>
        {Math.round(channelShares.attributed) !== Math.round(g.sales ? cardTotal / 100 : cardTotal) && (
          <p className="mt-2 text-[10.5px] leading-snug text-fg-2" data-atribuicao>
            Total do card dividido pelo que cada canal atribui a si. Juntos, eles contam {showValue(g.sales ? channelShares.attributed * 100 : channelShares.attributed)}: a mesma venda pode entrar nos dois.
          </p>
        )}
      </Block>
    ),
    "s-funil": (
      <Block title={g.sales ? "Funil de compra" : "Funil"} aside={funnel.length > 1 ? <span className="text-[11px] text-error-fg">maior queda: {funnel[drop - 1]?.label} → {funnel[drop].label}</span> : undefined}>
        <StageFunnel
          className="flex-1"
          orientation="horizontal"
          color={P.accent}
          steps={funnelRows(funnel, "entrada").map((r, i) => ({ ...r, color: i === drop && funnel.length > 1 ? P.error : undefined }))}
          summary={funnelSummary(g.sales ? "Funil de compra" : "Funil", funnel)}
        />
      </Block>
    ),
    "s-produtos": (
      <Block title="Produtos que mais vendem">
        {products.length ? (
          <ol className="flex min-h-0 flex-1 flex-col justify-around gap-1.5" aria-label="Produtos por receita, com a posição contra o período anterior">
            {products.map((p, i) => (
              <li key={p.name} className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-[11px] font-bold text-fg-2 tnum">{i + 1}</span>
                <MoveTag moved={moving.get(p.name) ?? null} tone={TONE} />
                <span className="min-w-0 flex-1">
                  <FullName text={p.name} className="text-[12px] font-medium" />
                  <span className="mt-0.5 block h-1.5 rounded-full" style={{ width: `${Math.max(4, (p.revenue / Math.max(1, products[0].revenue)) * 100)}%`, background: P.accent }} aria-hidden />
                </span>
                <span className="shrink-0 text-[12px] font-semibold tnum">{brlCompact(p.revenue)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Invite>Os produtos aparecem quando o período tem campanhas de catálogo na Meta ou de Shopping no Google.</Invite>
        )}
      </Block>
    ),
    "s-campanhas": (
      <Block title="Campanhas">
        <ul className="-my-1 min-h-0 flex-1 divide-y divide-line overflow-hidden">
          {campaigns.map((c) => {
            const roas = c.spend > 0 ? c.revenue / c.spend : 0;
            // fora de venda: o custo por resultado, sem julgar (não há equilíbrio de ROAS)
            const ok: boolean | null = g.sales ? roas >= breakEven : null;
            const tone = hide || ok === null ? "var(--fg-2)" : ok ? "var(--good)" : "var(--error-fg)";
            return (
              <li key={c.id} className="flex items-center gap-2.5 py-[7px]">
                <span className="grid size-[30px] shrink-0 place-items-center rounded-[10px] text-[10.5px] font-bold" style={{ background: "color-mix(in srgb, var(--fg) 8%, transparent)" }}>
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <FullName text={c.name} className="text-[12.5px] leading-tight font-medium" />
                  <span className="mt-0.5 block truncate text-[11px] leading-tight text-fg-2">
                    {platformName(c.platform)} · {g.sales ? money(ctx, c.revenue, true) : `${int(c.conversions)} ${resultName.toLowerCase()}`}
                  </span>
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tnum" style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}>
                  {hide ? HIDDEN : g.sales ? `${decimal(roas, 1)}×` : c.conversions > 0 ? money(ctx, c.spend / c.conversions, true) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </Block>
    ),
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

        <div className="mt-5">{children ? <SkinPage palette={P}>{children}</SkinPage> : <SkinGrid skin="noturno" ctx={ctx} grid={grid} nodes={nodes} hide={hidden} />}</div>
      </div>
    </div>
  );
}
