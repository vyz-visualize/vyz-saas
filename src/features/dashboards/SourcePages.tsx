"use client";

// Páginas das fontes que não são de anúncio, nos modelos novos (visual + objetivo +
// contas): Site (GA4), Força dos canais (GA4 × investimento das plataformas), CRM
// (leads, etapas e vendas, cruzado com a mídia), Instagram, Página do Facebook e
// Conteúdo. Com as contas ligadas, os números são os
// reais; sem elas, a amostra (o mesmo desenho).

import { useRef, type ReactNode } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { FitChart } from "@/components/charts/FitChart";
import { StageFunnel } from "@/components/charts/StageFunnel";
import { FIT_BOTTOM } from "./layout/GridCanvas";
import { useFitHeight } from "./layout/useFitHeight";
import type { DateRange, Kpi, LiveDashboardData } from "@/features/analytics/types";
import { OrganicContent, OrganicOverview } from "@/features/analytics/organic/OrganicPages";
import type { OrganicView } from "@/features/analytics/organic";
import { ddmm } from "@/features/analytics/ranges";
import { DataTable, InlineBar, KpiCard, NoData, Panel } from "@/features/analytics/ui";
import type { Profile } from "@/features/metrics/definitions";
import type { AnalyticsRow } from "@/features/metrics/warehouse-dataset";
import type { Dataset } from "@/features/metrics/source";
import { crmStagesForDataset, crmTotals, type CrmRow } from "@/features/metrics/crm";
import { addDays, diffDays } from "@/features/sync/dates";
import { brl, brlCompact, int, pct } from "@/lib/format";
import { BarList } from "@/components/charts/BarList";

export type SourceExtras = {
  current: DateRange;
  previous: DateRange;
  currency: string;
  analytics: AnalyticsRow[];
  /** CRM (crm_daily) das contas de CRM ligadas. */
  crm?: CrmRow[];
  organic: { instagram?: OrganicView; facebook?: OrganicView; all?: OrganicView };
};

/**
 * Encaixe na altura da tela (16:9, sem rolar a página), como a grade dos blocos: a moldura
 * fica com a altura livre e o miolo se divide nela; o que não cabe rola dentro do bloco.
 */
// @container: os cards e as colunas se ajustam à largura da página (sem ele, ficam 2 por linha e enormes)
export function FitFrame({ fit, children }: { fit: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const h = useFitHeight(ref, fit, FIT_BOTTOM);
  const on = fit && h != null && h > 240;
  return (
    <div ref={ref} data-fit-on={on ? "" : undefined} style={on ? { height: h } : undefined} className={`@container ${on ? "flex min-h-0 flex-col overflow-hidden" : ""}`}>
      {children}
    </div>
  );
}

const PURCHASE: readonly Profile[] = ["ecommerce", "marketplace", "executivo"];
const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;
const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);

function kpi(id: string, label: string, cur: number, prev: number, format: Kpi["format"], spark: number[], better: Kpi["better"] = "up"): Kpi {
  return { id, label, value: cur, previous: prev, delta: delta(cur, prev), format, better, spark };
}

/** Totais do GA4 num período e a série diária de sessões. */
function siteTotals(rows: readonly AnalyticsRow[], range: DateRange, purchase: boolean) {
  const r = rows.filter((x) => inRange(x.date, range));
  const sum = (k: keyof Omit<AnalyticsRow, "date" | "channel">) => r.reduce((a, x) => a + x[k], 0);
  const conv = purchase ? sum("transactions") : sum("keyEvents");
  const byDay = new Map<string, number>();
  const convDay = new Map<string, number>();
  for (const x of r) {
    byDay.set(x.date, (byDay.get(x.date) ?? 0) + x.sessions);
    convDay.set(x.date, (convDay.get(x.date) ?? 0) + (purchase ? x.transactions : x.keyEvents));
  }
  const days = diffDays(range.from, range.to) + 1;
  const series = Array.from({ length: days }, (_, i) => byDay.get(addDays(range.from, i)) ?? 0);
  const convSeries = Array.from({ length: days }, (_, i) => convDay.get(addDays(range.from, i)) ?? 0);
  return { sessions: sum("sessions"), users: sum("users"), engaged: sum("engagedSessions"), conv, revenue: sum("revenue"), series, convSeries };
}

export function SitePage({ extras, profile }: { extras: SourceExtras; profile: Profile }) {
  const purchase = PURCHASE.includes(profile);
  const cur = siteTotals(extras.analytics, extras.current, purchase);
  const prev = siteTotals(extras.analytics, extras.previous, purchase);
  if (!cur.sessions && !prev.sessions) return <NoData text="Sem dados do GA4 no período. Confira se a propriedade está ligada em Contas." />;
  const convLabel = purchase ? "Compras" : "Conversões (eventos-chave)";
  const kpis = [
    kpi("sessions", "Sessões", cur.sessions, prev.sessions, "int", cur.series),
    kpi("users", "Usuários", cur.users, prev.users, "int", []),
    kpi("engagement", "Taxa de engajamento", cur.sessions ? cur.engaged / cur.sessions : 0, prev.sessions ? prev.engaged / prev.sessions : 0, "pct", []),
    kpi("site-conv", convLabel, cur.conv, prev.conv, "int", cur.convSeries),
    kpi("site-rate", "Taxa de conversão", cur.sessions ? cur.conv / cur.sessions : 0, prev.sessions ? prev.conv / prev.sessions : 0, "pct", []),
    ...(purchase ? [kpi("site-revenue", "Receita (GA4)", cur.revenue, prev.revenue, "money", [])] : []),
  ];
  const today = addDays(extras.current.to, 1);
  const ago = cur.series.map((_, i) => diffDays(addDays(extras.current.from, i), today));
  const channels = channelRows(extras, purchase, {});
  const rate = cur.sessions ? cur.conv / cur.sessions : 0;
  const what = purchase ? "compras" : "conversões";
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-2 gap-2.5 @[640px]:grid-cols-3 @[1040px]:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} currency={extras.currency} maturing={0} featured={k.id === "site-conv"} />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 @[1040px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel title="Sessões por dia" subtitle={`${ddmm(extras.current.from)} a ${ddmm(extras.current.to)} · tracejado: o período anterior`} className="flex min-h-[260px] flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <FitChart className="flex-1" minHeight={180}>
            {({ height }) => <LineChart height={height} values={cur.series} previous={prev.series} ago={ago} formatY={(v) => int(v)} summary={`Sessões por dia: ${int(cur.sessions)} no período, contra ${int(prev.sessions)} no anterior.`} />}
          </FitChart>
        </Panel>
        <div className="grid min-h-0 gap-3 @[1040px]:grid-rows-2">
          <Panel title="De onde vêm as visitas" subtitle="Parte de cada canal nas sessões do período." className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col justify-center">
            <ShareStack rows={channels.map((c) => ({ label: c.channel, value: c.sessions, display: int(c.sessions) }))} summary={`Sessões por canal: ${channels.map((c) => `${c.channel} ${int(c.sessions)}`).join(", ")}.`} />
          </Panel>
          <Panel title={`Quem converte melhor`} subtitle={`Taxa de ${what} por canal; a linha é a média do site (${pct(rate, 1)}).`} className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
            <BarList
              fill
              items={channels.filter((c) => c.sessions > 0).map((c) => ({ label: c.channel, value: c.conv / c.sessions, display: pct(c.conv / c.sessions, 1) }))}
              reference={{ value: rate, label: `média ${pct(rate, 1)}` }}
              better="up"
              summary={`Taxa de ${what} por canal: ${channels.map((c) => `${c.channel} ${c.sessions ? pct(c.conv / c.sessions, 1) : "-"}`).join(", ")}.`}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Investimento das plataformas no canal do GA4 que elas alimentam. */
const SPEND_CHANNEL: Record<string, string> = { meta: "Paid Social", google: "Paid Search" };
const PAID = new Set(Object.values(SPEND_CHANNEL));

export function ChannelsPage({ extras, profile, ds }: { extras: SourceExtras; profile: Profile; ds: Dataset }) {
  const purchase = PURCHASE.includes(profile);
  const spendOf = (days: Dataset["current"]) => {
    const out: Record<string, number> = {};
    for (const d of days) for (const [p, v] of Object.entries(d.byPlatform)) if (SPEND_CHANNEL[p]) out[SPEND_CHANNEL[p]] = (out[SPEND_CHANNEL[p]] ?? 0) + (v?.spend ?? 0) / 100;
    return out;
  };
  const spend = spendOf(ds.current);
  const rows = channelRows(extras, purchase, spend);
  // o mesmo cruzamento no período anterior: os cards mostram a variação
  const before = channelRows({ ...extras, current: extras.previous }, purchase, spendOf(ds.previous));
  if (!rows.length) return <NoData text="Sem canais do GA4 no período. Confira se a propriedade está ligada em Contas." />;
  const what = purchase ? "compras" : "conversões";
  const sum = (pick: (r: ChannelRow) => number, only?: (r: ChannelRow) => boolean) => rows.filter(only ?? (() => true)).reduce((a, r) => a + pick(r), 0);
  const paid = (r: ChannelRow) => PAID.has(r.channel);
  const paidSpend = Object.values(spend).reduce((a, v) => a + v, 0);
  const paidConv = sum((r) => r.conv, paid);
  const paidRevenue = sum((r) => r.revenue, paid);
  const allConv = sum((r) => r.conv);
  const allSessions = sum((r) => r.sessions);
  const pSum = (pick: (r: ChannelRow) => number, only?: (r: ChannelRow) => boolean) => before.filter(only ?? (() => true)).reduce((a, r) => a + pick(r), 0);
  const pSpend = before.reduce((a, r) => a + (paid(r) ? (r.spend ?? 0) : 0), 0);
  const pConv = pSum((r) => r.conv, paid);
  const pAll = pSum((r) => r.conv);
  const pRevenue = pSum((r) => r.revenue, paid);
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  const cards: Kpi[] = [
    kpi("paid-spend", "Investimento em mídia", paidSpend, pSpend, "money", [], "neutral"),
    kpi("paid-conv", `${purchase ? "Compras" : "Conversões"} da mídia paga`, paidConv, pConv, "int", []),
    kpi("paid-cpa", "Custo por conversão confirmada", ratio(paidSpend, paidConv), ratio(pSpend, pConv), "money", [], "down"),
    kpi("paid-share", "Parte da mídia nas conversões", ratio(paidConv, allConv), ratio(pConv, pAll), "pct", []),
    ...(purchase ? [kpi("paid-roas", "ROAS confirmado (GA4)", ratio(paidRevenue, paidSpend), ratio(pRevenue, pSpend), "ratio", [])] : []),
  ].map((k) => ({ ...k, spendBased: k.id !== "paid-conv" && k.id !== "paid-share" }));
  const paidRows = rows.filter((r) => paid(r) && r.spend);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className={`grid shrink-0 grid-cols-2 gap-2.5 @[640px]:grid-cols-3 ${purchase ? "@[1040px]:grid-cols-5" : "@[1040px]:grid-cols-4"}`}>
        {cards.map((k) => (
          <KpiCard key={k.id} kpi={k} currency={extras.currency} maturing={0} featured={k.id === "paid-cpa"} />
        ))}
      </div>
      <div className="grid shrink-0 gap-3 @[1040px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Peso nas visitas × peso nas conversões" subtitle={`O canal cuja barra de ${what} passa a de sessões converte acima da média.`}>
          <PairedShare
            rows={rows.map((r) => ({ label: r.channel, a: allSessions ? r.sessions / allSessions : 0, b: allConv ? r.conv / allConv : 0 }))}
            aLabel="Sessões"
            bLabel={purchase ? "Compras" : "Conversões"}
            summary={`Parte nas sessões e nas ${what}: ${rows.map((r) => `${r.channel} ${pct(allSessions ? r.sessions / allSessions : 0, 0)} e ${pct(allConv ? r.conv / allConv : 0, 0)}`).join("; ")}.`}
          />
        </Panel>
        <Panel title="Mídia paga: quanto custa cada conversão confirmada" subtitle="Investimento da plataforma ÷ conversões que o GA4 confirmou no canal dela.">
          {paidRows.length ? (
            <ul className="space-y-3.5">
              {paidRows.map((r) => {
                const cpa = r.conv ? r.spend! / r.conv : 0;
                const worst = Math.max(...paidRows.map((x) => (x.conv ? x.spend! / x.conv : 0)), 1);
                return (
                  <li key={r.channel}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-medium">{r.channel === "Paid Social" ? "Meta Ads · Paid Social" : "Google Ads · Paid Search"}</span>
                      <span className="font-semibold tnum">{r.conv ? brl(cpa * 100) : "-"}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(cpa / worst) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-fg-2">
                      {brl(r.spend! * 100)} investidos · {int(r.conv)} {what}
                      {purchase && r.spend ? ` · ROAS ${decimalRatio(r.revenue / r.spend!)}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[12.5px] text-fg-2">Ligue a Meta ou o Google Ads a este dashboard para cruzar o investimento com o GA4.</p>
          )}
          {paidRows.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[12px] font-medium">{purchase ? "Investimento × receita confirmada" : "Investimento × parte nas conversões"}</p>
              <PairedShare
                rows={paidRows.map((r) => {
                  const top = Math.max(...paidRows.map((x) => Math.max(x.spend ?? 0, purchase ? x.revenue : 0)), 1);
                  return purchase ? { label: r.channel, a: (r.spend ?? 0) / top, b: r.revenue / top, aText: brlCompact((r.spend ?? 0) * 100), bText: brlCompact(r.revenue * 100) } : { label: r.channel, a: paidSpend ? (r.spend ?? 0) / paidSpend : 0, b: allConv ? r.conv / allConv : 0 };
                })}
                aLabel={purchase ? "Investimento" : "Parte no investimento"}
                bLabel={purchase ? "Receita confirmada (GA4)" : "Parte nas conversões"}
                summary={paidRows.map((r) => `${r.channel}: ${brl((r.spend ?? 0) * 100)} investidos, ${purchase ? `${brl(r.revenue * 100)} de receita confirmada` : `${int(r.conv)} conversões`}`).join("; ")}
              />
            </div>
          )}
        </Panel>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ChannelTable extras={extras} profile={profile} spendByChannel={spend} />
      </div>
    </div>
  );
}

const decimalRatio = (v: number) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "-");

/** Linhas por canal do GA4 no período atual, das que mais convertem para as que menos. */
function channelRows(extras: SourceExtras, purchase: boolean, spendByChannel: Record<string, number>): ChannelRow[] {
  const map = new Map<string, ChannelRow>();
  for (const r of extras.analytics) {
    if (!inRange(r.date, extras.current)) continue;
    const c = map.get(r.channel) ?? { channel: r.channel, sessions: 0, conv: 0, revenue: 0, spend: spendByChannel[r.channel] ?? null, share: 0 };
    c.sessions += r.sessions;
    c.conv += purchase ? r.transactions : r.keyEvents;
    c.revenue += r.revenue;
    map.set(r.channel, c);
  }
  const rows = [...map.values()].sort((a, b) => b.conv - a.conv);
  const total = rows.reduce((a, r) => a + r.conv, 0);
  for (const r of rows) r.share = total ? r.conv / total : 0;
  return rows;
}

/** Barra única dividida pelos canais (os 4 maiores e "Outros") e a lista com o número de cada um. */
function ShareStack({ rows, summary }: { rows: { label: string; value: number; display: string }[]; summary: string }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((a, r) => a + r.value, 0);
  const parts = rest > 0 ? [...top, { label: "Outros", value: rest, display: int(rest) }] : top;
  const total = parts.reduce((a, r) => a + r.value, 0) || 1;
  const shade = (i: number) => (i === 0 ? "var(--accent)" : `color-mix(in srgb, var(--accent) ${Math.max(18, 78 - i * 17)}%, var(--card))`);
  return (
    <div role="img" aria-label={summary}>
      <div className="flex h-7 gap-[2px] overflow-hidden rounded-[8px]" aria-hidden>
        {parts.map((p, i) => (
          <span key={p.label} className="h-full first:rounded-l-[8px] last:rounded-r-[8px]" style={{ width: `${(p.value / total) * 100}%`, background: shade(i) }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] @[1300px]:grid-cols-3" aria-hidden>
        {parts.map((p, i) => (
          <li key={p.label} className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: shade(i) }} />
            <span className="min-w-0 flex-1 truncate text-fg-2">{p.label}</span>
            <span className="font-medium tnum">{pct(p.value / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Duas barras por canal (parte nas sessões e parte nas conversões), na mesma régua. */
function PairedShare({ rows, aLabel, bLabel, summary }: { rows: { label: string; a: number; b: number; aText?: string; bText?: string }[]; aLabel: string; bLabel: string; summary: string }) {
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]), 0.01);
  const A = "color-mix(in srgb, var(--fg) 28%, var(--card))";
  return (
    <div role="img" aria-label={summary}>
      <p className="mt-2 mb-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: A }} /> {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" /> {bLabel}
        </span>
      </p>
      <ul className="space-y-2.5" aria-hidden>
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(84px,7rem)_minmax(0,1fr)] items-center gap-3 text-[11.5px]">
            <span className="truncate">{r.label}</span>
            <span className="space-y-[3px]">
              <span className="flex items-center gap-2">
                <span className="h-2 rounded-full" style={{ width: `${(r.a / max) * 82}%`, background: A }} />
                <span className="text-fg-2 tnum">{r.aText ?? pct(r.a, 0)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 rounded-full bg-accent" style={{ width: `${(r.b / max) * 82}%` }} />
                <span className={`tnum ${r.b > r.a * 1.1 ? "font-semibold text-fg" : "text-fg-2"}`}>{r.bText ?? pct(r.b, 0)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ChannelRow = { channel: string; sessions: number; conv: number; revenue: number; spend: number | null; share: number };

function ChannelTable({ extras, profile, spendByChannel }: { extras: SourceExtras; profile: Profile; spendByChannel: Record<string, number> }) {
  const purchase = PURCHASE.includes(profile);
  const rows = channelRows(extras, purchase, spendByChannel);
  const withSpend = Object.keys(spendByChannel).length > 0;
  if (!rows.length) return <NoData text="Sem canais no período." />;
  return (
    <Panel title="Força de cada canal" subtitle="Sessões, conversões e o peso de cada canal no total do período.">
      <DataTable
        rows={rows}
        rowKey={(r) => r.channel}
        caption="Canais do GA4"
        initialSort={{ key: "conv", dir: "desc" }}
        minWidth={withSpend ? 860 : 640}
        columns={[
          { key: "channel", label: "Canal", sticky: true, sort: (r) => r.channel, render: (r) => <span className="font-medium">{r.channel}</span> },
          { key: "sessions", label: "Sessões", align: "right", sort: (r) => r.sessions, render: (r) => int(r.sessions) },
          { key: "conv", label: purchase ? "Compras" : "Conversões", align: "right", sort: (r) => r.conv, render: (r) => int(r.conv) },
          { key: "rate", label: "Taxa", align: "right", sort: (r) => (r.sessions ? r.conv / r.sessions : 0), render: (r) => (r.sessions ? pct(r.conv / r.sessions, 1) : "-") },
          ...(purchase ? [{ key: "revenue", label: "Receita", align: "right" as const, sort: (r: ChannelRow) => r.revenue, render: (r: ChannelRow) => brl(r.revenue * 100) }] : []),
          ...(withSpend
            ? [
                { key: "spend", label: "Investimento", align: "right" as const, sort: (r: ChannelRow) => r.spend ?? -1, render: (r: ChannelRow) => (r.spend == null ? "-" : brl(r.spend * 100)) },
                { key: "cpa", label: "Custo por conversão", align: "right" as const, sort: (r: ChannelRow) => (r.spend && r.conv ? r.spend / r.conv : -1), render: (r: ChannelRow) => (r.spend && r.conv ? brl((r.spend / r.conv) * 100) : "-") },
              ]
            : []),
          { key: "share", label: "Peso nas conversões", sort: (r) => r.share, render: (r) => <InlineBar share={r.share} label={pct(r.share, 0)} /> },
        ]}
      />
    </Panel>
  );
}

/**
 * CRM: leads, negócios, vendas ganhas e receita, o funil pelas etapas e os leads por dia.
 * Com anúncios no dashboard, cruza com o investimento: custo por lead do CRM e CAC
 * (investimento ÷ vendas ganhas), que a plataforma de anúncio sozinha não mostra.
 */
export function CrmPage({ extras, ds, hideSpend = false }: { extras: SourceExtras; ds: Dataset; hideSpend?: boolean }) {
  const rows = extras.crm ?? [];
  const cur = crmTotals(rows, extras.current);
  const prev = crmTotals(rows, extras.previous);
  if (!cur.leads && !cur.deals && !cur.won && !prev.leads && !prev.deals) return <NoData text="Sem dados do CRM no período. Confira se a conta do CRM está ligada em Contas e já sincronizou." />;
  // investimento (centavos no Dataset) dos dois períodos
  const spendCur = ds.current.reduce((a, d) => a + d.spend, 0) / 100;
  const spendPrev = ds.previous.reduce((a, d) => a + d.spend, 0) / 100;
  const cross = !hideSpend && spendCur > 0;
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
  const kpis = [
    kpi("crm-leads", "Leads", cur.leads, prev.leads, "int", cur.leadsSeries),
    kpi("crm-deals", "Negócios", cur.deals, prev.deals, "int", []),
    kpi("crm-won", "Vendas ganhas", cur.won, prev.won, "int", cur.wonSeries),
    kpi("crm-revenue", "Receita ganha", cur.wonValue, prev.wonValue, "money", []),
    kpi("crm-rate", "Conversão lead → venda", ratio(cur.won, cur.leads), ratio(prev.won, prev.leads), "pct", []),
    kpi("crm-ticket", "Ticket médio", ratio(cur.wonValue, cur.won), ratio(prev.wonValue, prev.won), "money", []),
    ...(cross
      ? [
          kpi("crm-cpl", "Custo por lead do CRM", ratio(spendCur, cur.leads), ratio(spendPrev, prev.leads), "money", [], "down"),
          kpi("crm-cac", "CAC (custo por venda)", ratio(spendCur, cur.won), ratio(spendPrev, prev.won), "money", [], "down"),
        ]
      : []),
  ];
  const stages = crmStagesForDataset(rows, extras.current);
  const today = addDays(extras.current.to, 1);
  const ago = cur.leadsSeries.map((_, i) => diffDays(addDays(extras.current.from, i), today));
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className={`grid shrink-0 grid-cols-2 gap-2.5 @[640px]:grid-cols-4 ${cross ? "@[1040px]:grid-cols-8" : "@[1040px]:grid-cols-6"}`}>
        {kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} currency={extras.currency} maturing={0} hideSpend={hideSpend} featured={k.id === (cross ? "crm-cac" : "crm-won")} />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 @[1040px]:grid-cols-2">
        <Panel title="Leads por dia" subtitle={`${ddmm(extras.current.from)} a ${ddmm(extras.current.to)} · contatos novos no CRM`} className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <FitChart className="flex-1" minHeight={180}>
            {({ height }) => <LineChart height={height} values={cur.leadsSeries} ago={ago} formatY={(v) => int(v)} summary={`Leads por dia: ${int(cur.leads)} no período.`} />}
          </FitChart>
        </Panel>
        <Panel title="Funil do CRM" subtitle="Leads, negócios abertos em cada etapa e vendas ganhas no período." className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <div data-chart-theme className="flex min-h-[170px] flex-1 flex-col">
            <StageFunnel
              className="flex-1"
              orientation="horizontal"
              color="var(--chart-line-primary)"
              steps={stages.map((st) => ({ label: st.stage, value: st.count, display: int(st.count), note: st.value && !hideSpend ? brlCompact(st.value) : undefined }))}
              summary={`Funil do CRM: ${stages.map((st) => `${st.stage} ${int(st.count)}`).join(", ")}.`}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Instagram, Página do Facebook e Conteúdo: as páginas do orgânico com os perfis de cada um. */
export function OrganicSourcePage({ extras, which }: { extras: SourceExtras; which: "instagram" | "facebook" | "conteudo" }) {
  const organic = which === "conteudo" ? extras.organic.all : extras.organic[which];
  const data = { currency: extras.currency, current: extras.current, organic } as LiveDashboardData;
  // o orgânico tem mais blocos do que cabe numa tela: rola dentro da moldura, não a página
  return <div className="h-full min-h-0 overflow-auto">{which === "conteudo" ? <OrganicContent data={data} /> : <OrganicOverview data={data} />}</div>;
}
