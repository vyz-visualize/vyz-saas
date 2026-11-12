"use client";

// Páginas das fontes que não são de anúncio, nos modelos novos (visual + objetivo +
// contas): Site (GA4), Força dos canais (GA4 × investimento das plataformas),
// Instagram, Página do Facebook e Conteúdo. Com as contas ligadas, os números são os
// reais; sem elas, a amostra (o mesmo desenho).

import { useRef, type ReactNode } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { FitChart } from "@/components/charts/FitChart";
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
import { addDays, diffDays } from "@/features/sync/dates";
import { brl, int, pct } from "@/lib/format";

export type SourceExtras = {
  current: DateRange;
  previous: DateRange;
  currency: string;
  analytics: AnalyticsRow[];
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
  for (const x of r) byDay.set(x.date, (byDay.get(x.date) ?? 0) + x.sessions);
  const days = diffDays(range.from, range.to) + 1;
  const series = Array.from({ length: days }, (_, i) => byDay.get(addDays(range.from, i)) ?? 0);
  return { sessions: sum("sessions"), users: sum("users"), engaged: sum("engagedSessions"), conv, revenue: sum("revenue"), series };
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
    kpi("site-conv", convLabel, cur.conv, prev.conv, "int", []),
    kpi("site-rate", "Taxa de conversão", cur.sessions ? cur.conv / cur.sessions : 0, prev.sessions ? prev.conv / prev.sessions : 0, "pct", []),
    ...(purchase ? [kpi("site-revenue", "Receita (GA4)", cur.revenue, prev.revenue, "money", [])] : []),
  ];
  const today = addDays(extras.current.to, 1);
  const ago = cur.series.map((_, i) => diffDays(addDays(extras.current.from, i), today));
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-2 gap-2.5 @[640px]:grid-cols-3 @[1040px]:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} currency={extras.currency} maturing={0} featured={k.id === "site-conv"} />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 @[1040px]:grid-cols-2">
        <Panel title="Sessões por dia" subtitle={`${ddmm(extras.current.from)} a ${ddmm(extras.current.to)} · todas as propriedades ligadas`} className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          {/* o gráfico ocupa a altura do quadro (sem sobra embaixo) */}
          <FitChart className="flex-1" minHeight={180}>
            {({ height }) => <LineChart height={height} values={cur.series} ago={ago} formatY={(v) => int(v)} summary={`Sessões por dia: ${int(cur.sessions)} no período.`} />}
          </FitChart>
        </Panel>
        <div className="min-h-0 overflow-auto">
          <ChannelTable extras={extras} profile={profile} spendByChannel={{}} />
        </div>
      </div>
    </div>
  );
}

/** Investimento das plataformas no canal do GA4 que elas alimentam. */
const SPEND_CHANNEL: Record<string, string> = { meta: "Paid Social", google: "Paid Search" };

export function ChannelsPage({ extras, profile, ds }: { extras: SourceExtras; profile: Profile; ds: Dataset }) {
  const spend: Record<string, number> = {};
  for (const d of ds.current) for (const [p, v] of Object.entries(d.byPlatform)) if (SPEND_CHANNEL[p]) spend[SPEND_CHANNEL[p]] = (spend[SPEND_CHANNEL[p]] ?? 0) + (v?.spend ?? 0) / 100;
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="shrink-0 text-[13px] text-fg-2">
        Conversões e receita vêm do GA4 (sem a atribuição em dobro das plataformas). O investimento da Meta entra em Paid Social e o do Google Ads em Paid Search.
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        <ChannelTable extras={extras} profile={profile} spendByChannel={spend} />
      </div>
    </div>
  );
}

type ChannelRow = { channel: string; sessions: number; conv: number; revenue: number; spend: number | null; share: number };

function ChannelTable({ extras, profile, spendByChannel }: { extras: SourceExtras; profile: Profile; spendByChannel: Record<string, number> }) {
  const purchase = PURCHASE.includes(profile);
  const map = new Map<string, ChannelRow>();
  for (const r of extras.analytics) {
    if (!inRange(r.date, extras.current)) continue;
    const c = map.get(r.channel) ?? { channel: r.channel, sessions: 0, conv: 0, revenue: 0, spend: spendByChannel[r.channel] ?? null, share: 0 };
    c.sessions += r.sessions;
    c.conv += purchase ? r.transactions : r.keyEvents;
    c.revenue += r.revenue;
    map.set(r.channel, c);
  }
  const rows = [...map.values()];
  const total = rows.reduce((a, r) => a + r.conv, 0);
  for (const r of rows) r.share = total ? r.conv / total : 0;
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

/** Instagram, Página do Facebook e Conteúdo: as páginas do orgânico com os perfis de cada um. */
export function OrganicSourcePage({ extras, which }: { extras: SourceExtras; which: "instagram" | "facebook" | "conteudo" }) {
  const organic = which === "conteudo" ? extras.organic.all : extras.organic[which];
  const data = { currency: extras.currency, current: extras.current, organic } as LiveDashboardData;
  // o orgânico tem mais blocos do que cabe numa tela: rola dentro da moldura, não a página
  return <div className="h-full min-h-0 overflow-auto">{which === "conteudo" ? <OrganicContent data={data} /> : <OrganicOverview data={data} />}</div>;
}
