"use client";

// Visual "Noturno" (e-commerce): painel azul-noite com a receita em âmbar e o
// investimento em azul. Faixa de números com minilinha, receita e investimento por
// dia, anéis por canal, funil de compra, produtos e campanhas. Gráficos da Bklit UI.

import { CalendarDays, CircleDollarSign, Percent, ShoppingBag, Target, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { biggestDrop, platformPart } from "@/features/metrics/compute";
import { PAGES } from "@/features/templates/pages";
import { brlCompact } from "@/lib/format";
import { Block, SkinBar, SkinChrome, SkinPage, DailyChart, dayDates, LegendDots, RankBars, Segmented, ShareRings, StageFunnel, StatBlock, themeVars, weekly, weekStarts, type DailySeries, type SkinPalette } from "./bklit-blocks";
import { SkinGrid } from "./SkinGrid";
import { brl, change, chrono, daily, dayLabel, decimal, HIDDEN, initials, int, label, money, platformName, platformShort, value, type SkinProps } from "./shared";

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

export function NoturnoSkin({ ctx, name, client, pages, active, onPage, periodLabel, grid, controls, note, children, screen, bar }: SkinProps) {
  const [mode, setMode] = useState<"dia" | "semana">("dia");
  const hide = !!ctx.hideSpend;
  const current = ctx.ds.current;
  const days = useMemo(() => chrono(current), [current]);

  // receita e investimento por dia (ou somados por semana)
  const chart = useMemo(() => {
    const byWeek = mode === "semana";
    const revenue = byWeek ? weekly(days.map((d) => d.revenue)) : days.map((d) => d.revenue);
    const spend = byWeek ? weekly(days.map((d) => d.spend)) : days.map((d) => d.spend);
    const first = byWeek ? weekStarts(days) : days;
    return {
      points: revenue.map((r, i): Record<string, number> => (hide ? { revenue: r } : { revenue: r, spend: spend[i] })),
      dates: dayDates(first.map((d) => d.ago), ctx.today),
      labels: first.map((d) => dayLabel(d.ago, ctx.today)),
    };
  }, [ctx.today, days, hide, mode]);
  const series: DailySeries[] = [
    ...(hide ? [] : [{ key: "spend", label: label(ctx, "spend"), color: BLUE, kind: "bar" as const }]),
    { key: "revenue", label: label(ctx, "revenue"), color: P.accent, kind: "area" as const },
  ];

  const channels = useMemo(
    () =>
      ctx.ds.adPlatforms
        .map((id) => ({ id, t: platformPart(ctx.ds, id, "current") }))
        .sort((a, b) => b.t.revenue - a.t.revenue)
        .map((c, i) => ({ ...c, color: CHANNEL[i % CHANNEL.length] })),
    [ctx.ds],
  );
  const totalRevenue = channels.reduce((a, c) => a + c.t.revenue, 0);

  const funnel = ctx.ds.funnel;
  const drop = funnel.length > 1 ? biggestDrop(funnel) : 0;
  const products = useMemo(() => [...ctx.ds.products].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [ctx.ds.products]);
  const campaigns = useMemo(() => [...ctx.ds.campaigns].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [ctx.ds.campaigns]);
  const breakEven = ctx.ds.breakEven;

  const nodes = {
    "s-receita": <StatBlock title={label(ctx, "revenue")} v={value(ctx, "revenue")} delta={change(ctx, "revenue")} note="contra o período anterior" values={daily(ctx, "revenue")} icon={CircleDollarSign} solid={HERO} />,
    "s-invest": <StatBlock title={label(ctx, "spend")} v={value(ctx, "spend")} delta={hide ? undefined : change(ctx, "spend")} note={hide ? "oculto neste link" : `${int(ctx.cur.conversions)} vendas`} values={hide ? undefined : daily(ctx, "spend")} color={BLUE} icon={Wallet} />,
    "s-roas": <StatBlock title={label(ctx, "roas")} v={value(ctx, "roas")} delta={hide ? undefined : change(ctx, "roas")} note={hide ? undefined : `equilíbrio em ${decimal(breakEven, 1)}`} values={hide ? undefined : daily(ctx, "roas")} color={P.accent} icon={Percent} />,
    "s-cpa": <StatBlock title={label(ctx, "cpa")} v={value(ctx, "cpa")} delta={hide ? undefined : change(ctx, "cpa")} note={hide ? undefined : `alvo ${brl(ctx.ds.goal, { decimals: false })}`} values={hide ? undefined : daily(ctx, "cpa")} color={VIOLET} icon={Target} />,
    "s-vendas": (
      <Block
        title={hide ? "Receita por dia" : "Receita e investimento"}
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
          format={(_, v) => brl(v, { decimals: false })}
          formatY={brlCompact}
          summary={`${label(ctx, "revenue")} por ${mode}: total de ${value(ctx, "revenue")} no período.`}
        />
      </Block>
    ),
    "s-canais": (
      <Block title="Receita por canal">
        <ShareRings
          className="flex-1"
          items={channels.map((c) => ({ label: platformName(c.id), value: Math.round(c.t.revenue / 100), color: c.color }))}
          centerLabel="Receita"
          format={{ style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }}
          summary={`Receita por canal: ${channels.map((c) => `${platformName(c.id)} ${brlCompact(c.t.revenue)}`).join(", ")}.`}
        />
        <ul className="mt-3 space-y-1.5 text-[12px]">
          {channels.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{platformName(c.id)}</span>
              <span className="text-fg-2 tnum">{totalRevenue > 0 ? `${Math.round((c.t.revenue / totalRevenue) * 100)}%` : "—"}</span>
              <span className="w-[74px] text-right font-semibold tnum">{brlCompact(c.t.revenue)}</span>
            </li>
          ))}
        </ul>
      </Block>
    ),
    "s-funil": (
      <Block title="Funil de compra" aside={funnel.length > 1 ? <span className="text-[11px] text-error-fg">maior queda: {funnel[drop - 1]?.label} → {funnel[drop].label}</span> : undefined}>
        <StageFunnel
          className="flex-1"
          orientation="horizontal"
          color={P.accent}
          steps={funnel.map((s, i) => ({
            label: s.label,
            value: s.pct,
            display: `${s.pct}%`,
            note: i > 0 && funnel[i - 1].pct > 0 ? `${Math.round((s.pct / funnel[i - 1].pct) * 100)}% avançam` : "entrada",
            color: i === drop && funnel.length > 1 ? P.error : undefined,
          }))}
          summary={`Funil de compra: ${funnel.map((s) => `${s.label} ${s.pct}%`).join(", ")}.`}
        />
      </Block>
    ),
    "s-produtos": (
      <Block title="Produtos que mais vendem">
        <RankBars
          className="flex-1"
          color={P.accent}
          rows={products.map((p) => ({ name: p.name, value: p.revenue, display: brlCompact(p.revenue) }))}
          summary={`Produtos por receita: ${products.map((p) => `${p.name} ${brlCompact(p.revenue)}`).join(", ")}.`}
        />
      </Block>
    ),
    "s-campanhas": (
      <Block title="Campanhas">
        <ul className="-my-1 min-h-0 flex-1 divide-y divide-line overflow-hidden">
          {campaigns.map((c) => {
            const roas = c.spend > 0 ? c.revenue / c.spend : 0;
            const ok = roas >= breakEven;
            return (
              <li key={c.id} className="flex items-center gap-2.5 py-[7px]">
                <span className="grid size-[30px] shrink-0 place-items-center rounded-[10px] text-[10.5px] font-bold" style={{ background: "color-mix(in srgb, var(--fg) 8%, transparent)" }}>
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] leading-tight font-medium">{c.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] leading-tight text-fg-2">
                    {platformShort(c.platform)} · {money(ctx, c.revenue, true)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tnum" style={{ color: hide ? "var(--fg-2)" : ok ? "var(--good)" : "var(--error-fg)", background: `color-mix(in srgb, ${hide ? "var(--fg-2)" : ok ? "var(--good)" : "var(--error-fg)"} 14%, transparent)` }}>
                  {hide ? HIDDEN : `${decimal(roas, 1)}×`}
                </span>
              </li>
            );
          })}
          {!campaigns.length && <li className="py-2 text-[12px] text-fg-2">Sem campanhas neste recorte.</li>}
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
              <ShoppingBag size={18} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] font-medium tracking-[0.08em] text-fg-2 uppercase">{client}</p>
              <h2 className="truncate text-[18px] font-bold tracking-tight">{name}</h2>
            </div>
          </div>
          <nav className="order-last flex w-full min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-[22px] border border-line p-1 [scrollbar-width:none] @[900px]:order-none @[900px]:ml-2 @[900px]:w-auto @[900px]:flex-1 [&>*]:shrink-0 [&>*]:whitespace-nowrap" style={{ background: "rgb(255 255 255 / 0.03)" }}>
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
            <span className="grid size-9 place-items-center rounded-full text-[11px] font-bold" style={{ background: P.card, border: `1px solid ${P.line}` }}>
              {initials(client)}
            </span>
          </div>
        </div>

        <SkinChrome palette={P} controls={controls} note={note} screen={screen} className="mt-4" />

        <div className="mt-5">{children ? <SkinPage palette={P}>{children}</SkinPage> : <SkinGrid skin="noturno" ctx={ctx} grid={grid} nodes={nodes} />}</div>
      </div>
    </div>
  );
}
