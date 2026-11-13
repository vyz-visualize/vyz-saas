"use client";

// Visual "Areia" (leads com CRM): tons de areia com terracota nos leads e verde-petróleo
// nos qualificados. Título que já conta o resultado, faixa de números com minilinha,
// leads por dia, funil do CRM, origem dos leads, verba do mês e custo por campanha.
// Gráficos da Bklit UI.

import { BUDGET_INVITE, GOAL_INVITE, hasBudget, hasGoal } from "@/features/metrics/targets";
import { BadgeCheck, CalendarDays, CircleDollarSign, Handshake, Percent, Target, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { platformPart } from "@/features/metrics/compute";
import { metric } from "@/features/metrics/definitions";
import { PAGES } from "@/features/templates/pages";
import { brlCompact } from "@/lib/format";
import { Block, SkinBar, SkinChrome, SkinPage, DailyChart, dayDates, Gauge, LegendDots, RankBars, Segmented, ShareRings, StageFunnel, StatBlock, themeVars, weekly, weekStarts, type DailySeries, type SkinPalette } from "./bklit-blocks";
import { SkinGrid } from "./SkinGrid";
import { brl, change, chrono, daily, dayLabel, goalOf, HIDDEN, initials, int, Invite, label, money, pct, platformName, value, type SkinProps } from "./shared";

const P: SkinPalette = {
  scheme: "light",
  bg: "#f6f0e6",
  card: "#fffdf8",
  fg: "#2b2520",
  fg2: "#8a7e70",
  line: "#e7dccb",
  accent: "#c8553d",
  accentSoft: "#f5dfd6",
  onAccent: "#fff7ef",
  muted: "#d8ccb9",
  error: "#b3261e",
  errorSoft: "#f6dcd6",
  good: "#2f7f79",
};
const TEAL = "#2f7f79";
const OCHRE = "#d59a2e";
const PLUM = "#7a5c8e";
const ORIGIN = [P.accent, TEAL, OCHRE, PLUM];
const HERO = "linear-gradient(140deg,#d2634a 0%,#b9472f 100%)";

export function AreiaSkin({ ctx, name, client, pages, active, onPage, periodLabel, grid, controls, note, children, screen, bar }: SkinProps) {
  const [mode, setMode] = useState<"dia" | "semana">("dia");
  const hide = !!ctx.hideSpend;
  const current = ctx.ds.current;
  const days = useMemo(() => chrono(current), [current]);
  // o resultado do objetivo do modelo (leads, vendas, agendamentos...), nunca o que os números sugerem
  // memorizado: o compilador do React sabe que não muda depois (as listas abaixo dependem dele)
  const { sales: salesGoal, conv: leadKey, cost: costKey } = useMemo(() => goalOf(ctx.profile, ctx.cur.leads), [ctx.profile, ctx.cur.leads]);
  const resultName = metric(leadKey, ctx.profile).label;
  const resultLower = resultName.toLowerCase();
  const leads = ctx.cur[leadKey];
  const qualified = ctx.cur.qualified;

  const chart = useMemo(() => {
    const byWeek = mode === "semana";
    const perDay = days.map((d) => d[leadKey]);
    const l = byWeek ? weekly(perDay) : perDay;
    const q = byWeek ? weekly(days.map((d) => d.qualified)) : days.map((d) => d.qualified);
    const first = byWeek ? weekStarts(days) : days;
    return {
      points: l.map((v, i) => ({ leads: v, qualified: q[i] })),
      dates: dayDates(first.map((d) => d.ago), ctx.today),
      labels: first.map((d) => dayLabel(d.ago, ctx.today)),
    };
  }, [ctx.today, days, mode, leadKey]);
  const series: DailySeries[] = [
    { key: "leads", label: resultName, color: P.accent, kind: "bar" },
    ...(qualified > 0 ? [{ key: "qualified", label: "Qualificados", color: TEAL, kind: "line" as const }] : []),
  ];

  const crm = ctx.ds.crm;
  const sales = crm.at(-1);
  const proposal = crm.at(-2);
  const origins = useMemo(
    () =>
      ctx.ds.adPlatforms
        .map((id) => ({ id, t: platformPart(ctx.ds, id, "current") }))
        .map((o) => ({ ...o, leads: o.t[leadKey] }))
        .sort((a, b) => b.leads - a.leads)
        .map((o, i) => ({ ...o, color: ORIGIN[i % ORIGIN.length] })),
    [ctx.ds, leadKey],
  );
  const totalOrigin = origins.reduce((a, o) => a + o.leads, 0);
  // com o investimento oculto, o ranking é por volume de leads
  const campaigns = useMemo(() => {
    const withLeads = ctx.ds.campaigns.filter((c) => c.conversions > 0);
    return hide ? [...withLeads].sort((a, b) => b.conversions - a.conversions).slice(0, 5) : [...withLeads].sort((a, b) => a.spend / a.conversions - b.spend / b.conversions).slice(0, 5);
  }, [ctx.ds.campaigns, hide]);
  const { budget } = ctx.ds;
  const projected = budget.day > 0 ? Math.round((budget.spent / budget.day) * budget.daysInMonth) : 0;

  // nada em branco: campanhas e origens sem números saem (o vizinho ocupa o espaço)
  const hidden = [...(campaigns.length ? [] : ["s-campanhas"]), ...(totalOrigin > 0 ? [] : ["s-origem"])];

  const nodes = {
    "s-leads": <StatBlock title={label(ctx, leadKey)} v={value(ctx, leadKey)} delta={change(ctx, leadKey)} note="contra o período anterior" values={daily(ctx, leadKey)} icon={Users} solid={HERO} />,
    "s-cpl": <StatBlock title={label(ctx, costKey)} v={value(ctx, costKey)} delta={hide ? undefined : change(ctx, costKey)} note={hide ? "oculto neste link" : hasGoal(ctx.ds) ? `alvo ${brl(ctx.ds.goal, { decimals: false })}` : GOAL_INVITE} values={hide ? undefined : daily(ctx, costKey)} color={OCHRE} icon={Target} />,
    // objetivo de venda: receita e ROAS no lugar dos leads qualificados e (sem CRM) das vendas do CRM
    "s-qualificados": salesGoal ? (
      <StatBlock title={label(ctx, "revenue")} v={value(ctx, "revenue")} delta={change(ctx, "revenue")} note="contra o período anterior" values={daily(ctx, "revenue")} color={TEAL} icon={CircleDollarSign} />
    ) : (
      // sem a qualificação nos dados (ela vem do CRM ou do imobiliário), o card diz o que falta em vez de mostrar 0
      qualified > 0 ? (
        <StatBlock title="Leads qualificados" v={int(qualified)} delta={change(ctx, "qualified")} note={leads > 0 ? `${pct(qualified / leads, 0)} dos leads` : undefined} values={daily(ctx, "qualified")} color={TEAL} icon={BadgeCheck} />
      ) : (
        <StatBlock title="Leads qualificados" v="—" note="Conecte um CRM para separar os qualificados" color={TEAL} icon={BadgeCheck} />
      )
    ),
    "s-vendas":
      salesGoal && !sales ? (
        <StatBlock title={label(ctx, "roas")} v={value(ctx, "roas")} delta={hide ? undefined : change(ctx, "roas")} note="receita ÷ investimento" values={hide ? undefined : daily(ctx, "roas")} color={PLUM} icon={Percent} />
      ) : (
        <StatBlock title="Vendas no CRM" v={sales ? int(sales.count) : "—"} note={sales ? (leads > 0 ? `${pct(sales.count / leads, 1)} ${salesGoal ? "das vendas" : "dos leads"} · ${brlCompact(sales.value)}` : undefined) : "Conecte um CRM para ver as vendas fechadas"} bars={crm.map((s) => s.count)} color={PLUM} icon={Handshake} />
      ),
    "s-diario": (
      <Block
        title={`${resultName} por dia`}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <LegendDots items={series.map((s) => ({ label: s.label, color: s.color }))} />
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
        <DailyChart points={chart.points} dates={chart.dates} labels={chart.labels} series={series} format={(_, v) => int(v)} formatY={int} summary={`${resultName} por ${mode}: ${int(leads)} no período${qualified > 0 ? `, ${int(qualified)} qualificados` : ""}.`} />
      </Block>
    ),
    "s-crm": (
      <Block title="Funil do CRM" aside={proposal ? <span className="text-[11px] text-fg-2">{brlCompact(proposal.value)} em propostas</span> : undefined}>
        {!crm.some((s) => s.count > 0) ? (
          <Invite>Conecte um CRM (RD Station, HubSpot, Pipedrive ou Kommo) em Contas para ver o funil do lead à venda.</Invite>
        ) : (
        <StageFunnel className="flex-1" orientation="vertical" color={P.accent} steps={crm.map((s, i) => ({ label: s.stage, value: s.count, display: int(s.count), note: i > 0 && crm[i - 1].count > 0 ? `${Math.round((s.count / crm[i - 1].count) * 100)}% avançam` : undefined }))} summary={`Funil do CRM: ${crm.map((s) => `${s.stage} ${int(s.count)}`).join(", ")}.`} />
        )}
      </Block>
    ),
    "s-origem": (
      <Block title={`${resultName} por plataforma`}>
        <ShareRings className="flex-1" items={origins.map((o) => ({ label: platformName(o.id), value: Math.round(o.leads), color: o.color }))} centerLabel={resultName} summary={`${resultName} por plataforma: ${origins.map((o) => `${platformName(o.id)} ${int(o.leads)}`).join(", ")}.`} />
        <ul className="mt-3 space-y-1.5 text-[12px]">
          {origins.map((o) => (
            <li key={o.id} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{platformName(o.id)}</span>
              <span className="text-fg-2 tnum">{totalOrigin > 0 ? `${Math.round((o.leads / totalOrigin) * 100)}%` : "—"}</span>
              <span className="w-[70px] text-right font-semibold tnum">{hide ? HIDDEN : brl(o.t[costKey])}</span>
            </li>
          ))}
        </ul>
      </Block>
    ),
    "s-verba": (
      <Block title="Verba do mês">
        {hide ? (
          <p className="text-[12px] text-fg-2">O investimento está oculto neste link.</p>
        ) : !hasBudget(ctx.ds) ? (
          <p className="text-[12px] text-fg-2">
            <span className="font-medium text-accent">{BUDGET_INVITE}</span> para ver o quanto já foi usado e onde o mês fecha.
          </p>
        ) : (
          <>
            <Gauge className="flex-1" value={budget.spent} max={budget.monthly} color={TEAL} label="usado" summary={`Verba do mês: ${brlCompact(budget.spent)} de ${brlCompact(budget.monthly)}, dia ${budget.day} de ${budget.daysInMonth}.`} />
            <dl className="mt-2 space-y-1 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-fg-2">Usado</dt>
                <dd className="font-semibold tnum">
                  {brlCompact(budget.spent)} de {brlCompact(budget.monthly)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-fg-2">
                  Dia {budget.day} de {budget.daysInMonth}
                </dt>
                <dd className="tnum" style={{ color: projected > budget.monthly ? "var(--error-fg)" : undefined }}>
                  fecha em {brlCompact(projected)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </Block>
    ),
    "s-campanhas": (
      <Block title={hide ? `${resultName} por campanha` : `${label(ctx, costKey)} por campanha`} aside={hide ? undefined : <span className="text-[11px] text-fg-2">do mais barato ao mais caro</span>}>
        <RankBars
          className="flex-1"
          color={TEAL}
          rows={campaigns.map((c) => (hide ? { name: c.name, value: c.conversions, display: int(c.conversions) } : { name: c.name, value: c.spend / c.conversions, display: brl(c.spend / c.conversions) }))}
          summary={`Campanhas: ${campaigns.map((c) => `${c.name} ${hide ? int(c.conversions) : money(ctx, c.spend / c.conversions)}`).join(", ")}.`}
        />
      </Block>
    ),
  };

  // título: na primeira aba conta o resultado do período; nas outras, o nome da aba
  const headline = children ? (
    PAGES[active].name
  ) : (
    <>
      <span style={{ color: P.accent }}>
        {int(leads)} {resultLower}
      </span>
      {sales && !salesGoal ? ` e ${int(sales.count)} vendas fechadas` : " no período"}
    </>
  );

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div data-chart-theme className={screen ? "@container" : "@container rounded-[32px] p-2.5 @[700px]:p-4"} style={{ ...themeVars(P), background: screen ? P.bg : "#e4d9c7" }}>
      <div className={screen ? "min-h-dvh px-4 pt-3 pb-[var(--screen-pb,7rem)] @[700px]:px-6" : "rounded-[26px] p-4 @[700px]:p-6"} style={{ background: P.bg }}>
        <SkinBar palette={P} bar={bar} className="mb-3" />
        {/* topo: cliente, abas sublinhadas e período */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: P.fg, color: P.bg }}>
              {initials(client)}
            </span>
            <p className="text-[13px] font-semibold tracking-tight">{client}</p>
          </div>
          <nav className="order-last flex w-full min-w-0 flex-nowrap gap-x-5 overflow-x-auto [scrollbar-width:none] @[900px]:order-none @[900px]:w-auto @[900px]:flex-1 @[900px]:basis-0 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage?.(p)}
                aria-current={p === active ? "page" : undefined}
                className={`relative py-1.5 text-[12.5px] font-medium transition-colors ${p === active ? "" : "text-fg-2 hover:text-fg"}`}
              >
                {PAGES[p].name}
                {p === active && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full" style={{ background: P.accent }} aria-hidden />}
              </button>
            ))}
          </nav>
          {!controls && (
            <span className="ml-auto flex h-9 items-center gap-2 rounded-full border border-line px-3 text-[11.5px] text-fg-2" style={{ background: P.card }}>
              <CalendarDays size={14} /> {periodLabel}
            </span>
          )}
          {/* na tela do dashboard, o título divide a linha com as abas: sobra altura para os blocos */}
          {screen && (
            <p className="ml-auto hidden max-w-[34%] min-w-0 shrink truncate text-[17px] leading-tight font-bold tracking-tight @[1100px]:block @[1500px]:max-w-[40%] @[1500px]:text-[20px]">{headline}</p>
          )}
        </div>

        <SkinChrome palette={P} controls={controls} note={note} screen={screen} className="mt-4" />

        <div className={screen ? "mt-4 @[1100px]:hidden" : "mt-5"}>
          <p className="text-[11px] font-medium tracking-[0.1em] text-fg-2 uppercase">{name}</p>
          <h2 className="mt-1 max-w-[24ch] text-[26px] leading-[1.15] font-bold tracking-tight text-balance @[700px]:text-[32px]">{headline}</h2>
        </div>

        <div className={screen ? "mt-4" : "mt-5"}>{children ? <SkinPage palette={P}>{children}</SkinPage> : <SkinGrid skin="areia" ctx={ctx} grid={grid} nodes={nodes} hide={hidden} />}</div>
      </div>
    </div>
  );
}
