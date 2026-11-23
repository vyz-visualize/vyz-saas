"use client";

// Visual "Areia" (pipeline do lead): tons de areia com terracota nos leads e verde-petróleo
// nos qualificados. Título que já conta o resultado e, na primeira aba, o trilho do funil é a
// navegação (Anúncio → Lead → as etapas do CRM, com a passagem entre elas): clicar numa etapa
// mostra o detalhe dela embaixo. Sem CRM, as etapas dele viram um convite só. Nas abas de cada
// plataforma, "de onde vem o lead" (AreiaParts). Gráficos da Bklit UI.

import { BUDGET_INVITE, GOAL_INVITE, hasBudget, hasGoal } from "@/features/metrics/targets";
import { BadgeCheck, CalendarDays, CircleDollarSign, Handshake, Percent, Target, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { platformPart } from "@/features/metrics/compute";
import { metric } from "@/features/metrics/definitions";
import { PAGES } from "@/features/templates/pages";
import { brlCompact } from "@/lib/format";
import { Block, SkinBar, SkinChrome, SkinPage, DailyChart, dayDates, Gauge, LegendDots, Segmented, ShareRings, StageFunnel, StatBlock, themeVars, weekly, weekStarts, type DailySeries, type SkinPalette } from "./bklit-blocks";
import { BulletBar, HeatGrid, MiniSpark, MoveTag } from "./extras";
import { FullName } from "./FullName";
import { heatPeak, sharesOfTotal, WEEKDAYS } from "./insights";
import { SkinGrid } from "./SkinGrid";
import { skinGrid } from "./blocks";
import { CrmStageDetail, FunnelRail, LeadSources, stagesOf, type Stage } from "./AreiaParts";
import { PAGE_PLATFORM } from "@/features/templates/dashboards/composed";
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
/** Cores dos blocos exclusivos (extras.tsx). */
const TONE = { fg: P.fg, fg2: P.fg2, line: P.line, accent: P.accent, good: TEAL, bad: P.error };

export function AreiaSkin({ ctx, name, client, pages, active, onPage, periodLabel, grid, controls, note, children, screen, bar }: SkinProps) {
  const [mode, setMode] = useState<"dia" | "semana">("dia");
  // o trilho do funil: a etapa escolhida (começa no lead)
  const [stagePick, setStagePick] = useState("lead");
  const only = PAGE_PLATFORM[active];
  const platformTab = only && (active === "meta-ads" || active === "google-ads") && ctx.ds.campaigns.some((c) => c.platform === only) ? only : null;
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
  // o anel divide o total do card (o mesmo de "Leads") na proporção do que cada plataforma atribui a si
  const originShares = sharesOfTotal(origins.map((o) => ({ ...o, value: o.leads })), leads);
  const totalOrigin = origins.reduce((a, o) => a + o.leads, 0);
  // com o investimento oculto, o ranking é por volume de leads
  const campaigns = useMemo(() => {
    const withLeads = ctx.ds.campaigns.filter((c) => c.conversions > 0);
    return hide ? [...withLeads].sort((a, b) => b.conversions - a.conversions).slice(0, 5) : [...withLeads].sort((a, b) => a.spend / a.conversions - b.spend / b.conversions).slice(0, 5);
  }, [ctx.ds.campaigns, hide]);
  const { budget } = ctx.ds;
  const projected = budget.day > 0 ? Math.round((budget.spent / budget.day) * budget.daysInMonth) : 0;

  // custo por lead por campanha: a posição no período anterior (subiu/desceu no ranking do mais barato)
  const prevRank = useMemo(() => {
    const cost = (c: (typeof campaigns)[number]) => (c.prev && c.prev.conversions > 0 ? c.prev.spend / c.prev.conversions : null);
    const order = ctx.ds.campaigns.filter((c) => cost(c) !== null).sort((a, b) => (hide ? (b.prev?.conversions ?? 0) - (a.prev?.conversions ?? 0) : (cost(a) ?? 0) - (cost(b) ?? 0)));
    return new Map(order.map((c, i) => [c.id, i]));
  }, [ctx.ds.campaigns, hide]);
  const hourWeek = ctx.ds.hourWeek;
  const peak = useMemo(() => heatPeak(hourWeek), [hourWeek]);

  // sem CRM: um convite só (no primeiro bloco que dependia dele); os outros dependentes saem
  const noCrm = !crm.some((s) => s.count > 0);
  const inviteIn = noCrm ? (!salesGoal && qualified <= 0 ? "s-qualificados" : !(salesGoal && !sales) ? "s-vendas" : "s-crm") : null;
  const crmOut = noCrm ? ["s-qualificados", "s-vendas", "s-crm"].filter((id) => id !== inviteIn && !(id === "s-qualificados" && (salesGoal || qualified > 0)) && !(id === "s-vendas" && salesGoal && !sales)) : [];

  // nada em branco: campanhas e origens sem números saem (o vizinho ocupa o espaço); com uma plataforma só,
  // o anel de 100% não diz nada; sem a quebra por hora, a grade sai
  const hidden = [...(campaigns.length ? [] : ["s-campanhas"]), ...(totalOrigin > 0 && origins.length > 1 ? [] : ["s-origem"]), ...crmOut, ...(peak ? [] : ["s-calor"])];
  const crmInvite = (
    <section className="flex h-full min-h-0 min-w-0 flex-col justify-center rounded-[22px] border border-dashed border-line bg-card px-4 py-3" data-convite-crm>
      <p className="text-[13px] font-semibold">Leads qualificados, vendas e o funil até a venda</p>
      <p className="mt-1 text-[12px] text-fg-2">Conecte um CRM (RD Station, HubSpot, Pipedrive ou Kommo) em Contas para ver os qualificados, as vendas fechadas e onde o lead trava.</p>
    </section>
  );

  const nodes = {
    "s-leads": <StatBlock title={label(ctx, leadKey)} v={value(ctx, leadKey)} delta={change(ctx, leadKey)} note="contra o período anterior" values={daily(ctx, leadKey)} icon={Users} solid={HERO} />,
    "s-cpl": (
      <StatBlock
        title={label(ctx, costKey)}
        v={value(ctx, costKey)}
        delta={hide ? undefined : change(ctx, costKey)}
        note={hide ? "oculto neste link" : hasGoal(ctx.ds) ? `alvo ${brl(ctx.ds.goal, { decimals: false })} · ${ctx.cur[costKey] <= ctx.ds.goal ? "dentro" : "acima"}` : GOAL_INVITE}
        // com alvo: a barra com o marcador do alvo no lugar da minilinha
        values={hide || hasGoal(ctx.ds) ? undefined : daily(ctx, costKey)}
        footer={!hide && hasGoal(ctx.ds) ? <BulletBar value={ctx.cur[costKey]} target={ctx.ds.goal} color={ctx.cur[costKey] <= ctx.ds.goal ? TEAL : P.error} tone={TONE} label={`${label(ctx, costKey)} ${value(ctx, costKey)} contra o alvo de ${brl(ctx.ds.goal, { decimals: false })}.`} /> : undefined}
        color={OCHRE}
        icon={Target}
      />
    ),
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
    "s-calor": (
      <Block title={`${resultName} por dia da semana e hora`} aside={peak ? <span className="text-[11px] text-fg-2">pico: {WEEKDAYS[peak.day]}, {peak.hour}h</span> : undefined}>
        {hourWeek && <HeatGrid grid={hourWeek} color={P.accent} tone={TONE} what={resultName} format={(v) => (v < 10 ? v.toFixed(1).replace(".", ",") : int(v))} />}
        <p className="mt-auto pt-2 text-[10.5px] text-fg-2">Pela hora de cada dia na Meta, no fuso da conta: bom para escalar o atendimento.</p>
      </Block>
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
        <span hidden data-anel-total={leads} data-anel-partes={originShares.items.reduce((x, o) => x + o.value, 0)} />
        <ShareRings className="flex-1" items={originShares.items.map((o) => ({ label: platformName(o.id), value: o.value, color: o.color }))} centerLabel={resultName} summary={`${resultName} por plataforma (total ${int(leads)}): ${originShares.items.map((o) => `${platformName(o.id)} ${int(o.value)}`).join(", ")}.`} />
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
        {Math.round(originShares.attributed) !== Math.round(leads) && (
          <p className="mt-2 text-[10.5px] leading-snug text-fg-2" data-atribuicao>
            Total de {int(leads)}, dividido pelo que cada plataforma atribui a si. Juntas, elas contam {int(originShares.attributed)}: a mesma conversão pode entrar nas duas.
          </p>
        )}
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
        <ol className="flex min-h-0 flex-1 flex-col justify-around gap-1.5" aria-label={`Campanhas: ${campaigns.map((c) => `${c.name} ${hide ? int(c.conversions) : money(ctx, c.spend / c.conversions)}`).join(", ")}.`}>
          {campaigns.map((c, i) => {
            const before = prevRank.get(c.id);
            return (
              <li key={c.id} className="flex min-w-0 items-center gap-2">
                <MoveTag moved={before === undefined ? null : before - i} tone={TONE} />
                <FullName text={c.name} className="min-w-0 flex-1 text-[12px] font-medium" />
                <MiniSpark values={c.daily?.conversions ?? []} color={TEAL} className="h-6 w-14 shrink-0" label={`${resultName} por dia`} />
                <span className="w-[66px] shrink-0 text-right text-[12px] font-semibold tnum">{hide ? int(c.conversions) : brl(c.spend / c.conversions)}</span>
              </li>
            );
          })}
        </ol>
      </Block>
    ),
  };

  // sem CRM: o convite único entra no lugar do primeiro bloco que dependia dele
  const shown: Record<string, React.ReactNode> = inviteIn ? { ...nodes, [inviteIn]: crmInvite } : nodes;

  // a primeira aba: o trilho e o detalhe da etapa escolhida, com os blocos do visual que seguem na grade salva
  const stages = stagesOf(ctx);
  const stage = stages.find((st) => st.id === stagePick) ?? stages[1];
  const present = new Set((grid?.items ?? skinGrid("areia")).map((i) => i.id).filter((id) => !hidden.includes(id)));
  const cards = (ids: string[]) => {
    const on = ids.filter((id) => present.has(id));
    return on.length ? <div className="grid gap-4 @[700px]:grid-cols-3">{on.map((id) => <div key={id} className="min-w-0">{nodes[id as keyof typeof nodes]}</div>)}</div> : null;
  };
  const blocks = (ids: { id: string; wide?: boolean; h: string }[]) => {
    const on = ids.filter((b) => present.has(b.id));
    return on.length ? (
      <div className="grid gap-4 @[900px]:grid-cols-3">
        {on.map((b) => (
          <div key={b.id} className={`flex min-w-0 flex-col [&>*]:flex-1 ${b.h} ${b.wide || on.length === 1 ? "@[900px]:col-span-2" : ""} ${on.length === 1 ? "@[900px]:col-span-3" : ""}`}>
            {nodes[b.id as keyof typeof nodes]}
          </div>
        ))}
      </div>
    ) : null;
  };
  const detail = (st: Stage) =>
    st.kind === "anuncio" ? (
      <div className="space-y-4">
        {cards(["s-cpl"])}
        {blocks([{ id: "s-campanhas", wide: true, h: "h-[340px]" }, { id: "s-verba", h: "h-[340px]" }])}
      </div>
    ) : st.kind === "lead" ? (
      <div className="space-y-4">
        {/* o número de leads e a variação já estão no trilho; no objetivo de venda, a receita e o ROAS */}
        {salesGoal && cards(["s-qualificados", "s-vendas"])}
        {blocks([{ id: "s-diario", wide: true, h: "h-[340px]" }, { id: "s-origem", h: "h-[340px]" }])}
        {blocks([{ id: "s-calor", wide: true, h: "h-[300px]" }])}
      </div>
    ) : st.kind === "crm" && st.crm ? (
      <CrmStageDetail ctx={ctx} stage={st} stages={stages} accent={P.accent} />
    ) : st.kind === "crm" ? (
      // qualificados sem CRM (imobiliário): a parte dos leads, sem o resto do funil
      cards(["s-qualificados"])
    ) : (
      <div className="h-[160px]">{crmInvite}</div>
    );
  const pipeline = (
    <div className="space-y-4" data-pipeline>
      <FunnelRail stages={stages} picked={stage.id} onPick={setStagePick} money={hide ? undefined : (v) => brlCompact(v)} accent={P.accent} />
      <div key={stage.id} className="m-in">{detail(stage)}</div>
    </div>
  );

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
          <nav data-tour="abas" className="order-last flex w-full min-w-0 flex-nowrap gap-x-5 overflow-x-auto [scrollbar-width:none] @[900px]:order-none @[900px]:w-auto @[900px]:flex-1 @[900px]:basis-0 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
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

        <div className={screen ? "mt-4" : "mt-5"}>
          {children ? (
            <>
              {platformTab && <LeadSources ctx={ctx} platform={platformTab} accent={P.accent} />}
              <SkinPage palette={P}>{children}</SkinPage>
            </>
          ) : grid?.editing ? (
            // no Personalizar, a grade de sempre: esconder e adicionar blocos valem no detalhe das etapas
            <SkinGrid skin="areia" ctx={ctx} grid={grid} nodes={shown} hide={hidden} />
          ) : (
            pipeline
          )}
        </div>
      </div>
    </div>
  );
}
