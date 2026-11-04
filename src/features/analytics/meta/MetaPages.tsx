"use client";

// Páginas do Meta Ads · E-commerce: visão geral, campanhas, funil e público (Criativos: pasta creatives/).

import { TrendingDown } from "lucide-react";
import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { AGE_BUCKETS, GENDER_LABEL } from "@/features/sync/breakdowns";
import { decimal, int, pct } from "@/lib/format";
import { FUNNEL_STAGE_LABEL } from "../aggregate";
import { formatValue, money, moneyCompact } from "../format";
import { META_EXTRA_METRICS } from "../live-metrics";
import { extraColumns, hiddenOr, useExtraColumnsWidth, HeroChart, StatusCell, TopCampaigns, type PageProps } from "../shared";
import type { CampaignRowVM, FunnelStep, MetaView } from "../types";
import { DataTable, InlineBar, KpiGrid, NoData, Panel, Roas, SliceBars } from "../ui";

const stageLabel = (s: string | null) => (s ? (FUNNEL_STAGE_LABEL[s] ?? "Outras") : "Outras");
const meta = (data: PageProps["data"]) => data.view as MetaView;

export function MetaOverview({ data }: PageProps) {
  const view = meta(data);
  return (
    <div className="space-y-3">
      <KpiGrid platform={view.platform} kpis={view.kpis} extra={view.extraKpis} currency={data.currency} maturing={data.maturingFrom ? 3 : 0} hideSpend={data.hideSpend} />
      <div className="grid gap-3 @[1040px]:grid-cols-3">
        <div className="min-w-0 @[1040px]:col-span-2">
          <HeroChart data={data} spendLabel="Investimento" valueLabel="Receita" />
        </div>
        <Panel title="Do clique à compra" subtitle="Passagem entre as etapas do período.">
          <FunnelSteps steps={view.funnel.slice(1)} compact currency={data.currency} />
        </Panel>
      </div>
      <TopCampaigns data={data} kindLabel={stageLabel} />
    </div>
  );
}

export function MetaCampaigns({ data }: PageProps) {
  const view = meta(data);
  const { currency, hideSpend } = data;
  const below = view.campaigns.filter((c) => c.belowBreakEven);
  const extraWidth = useExtraColumnsWidth([...META_EXTRA_METRICS.map((m) => m.id), "results", "costPerResult"]);
  return (
    <div className="space-y-3">
      {below.length > 0 && (
        <p className="flex items-start gap-2 rounded-card border border-error/30 bg-error-soft/60 px-3.5 py-2.5 text-[13px] text-fg" role="note">
          <TrendingDown size={16} className="mt-0.5 shrink-0 text-error-fg" aria-hidden />
          <span>
            <strong>{below.length === 1 ? "1 campanha" : `${below.length} campanhas`} abaixo do equilíbrio:</strong> {below.map((c) => c.name).join(", ")}.
          </span>
        </p>
      )}
      <Panel title="Todas as campanhas" subtitle="Clique no título da coluna para ordenar.">
        <DataTable<CampaignRowVM>
          rows={view.campaigns}
          rowKey={(c) => c.id}
          caption="Campanhas do Meta Ads no período"
          initialSort={{ key: "spend", dir: "desc" }}
          minWidth={980 + extraWidth}
          rowClassName={(c) => (c.belowBreakEven ? "[&>*]:bg-error-soft/30" : "")}
          columns={[
            { key: "name", label: "Campanha", sticky: true, className: "w-[15rem] max-w-[15rem]", sort: (c) => c.name, render: (c) => <StatusCell name={c.name} status={c.status} sub={stageLabel(c.kind)} /> },
            {
              key: "spend", metric: "spend",
              label: "Investimento",
              sort: (c) => c.spendShare,
              className: "w-[11rem]",
              render: (c) => (
                <span className="block">
                  <span className="block text-right">{hiddenOr(hideSpend, money(c.spend, currency, { decimals: false }))}</span>
                  <InlineBar share={c.spendShare} />
                </span>
              ),
            },
            { key: "value", metric: "revenue", label: "Receita", align: "right", sort: (c) => c.value, render: (c) => moneyCompact(c.value, currency) },
            { key: "roas", metric: "roas", label: "ROAS", align: "right", sort: (c) => c.roas, render: (c) => <Roas value={c.roas} breakEven={view.breakEvenRoas} /> },
            { key: "conv", metric: "purchases", label: "Compras", align: "right", sort: (c) => c.conversions, render: (c) => int(c.conversions) },
            { key: "cpa", metric: "cpa", label: "Custo/compra", align: "right", sort: (c) => c.cpa, render: (c) => money(c.cpa, currency) },
            { key: "ctr", metric: "linkCtr", label: "CTR do link", align: "right", sort: (c) => c.linkCtr, render: (c) => formatValue(c.linkCtr, "pct") },
            { key: "cpm", metric: "cpm", label: "CPM", align: "right", sort: (c) => c.cpm, render: (c) => money(c.cpm, currency) },
            { key: "freq", metric: "frequency", label: "Freq. média", align: "right", sort: (c) => c.frequency, render: (c) => (c.frequency == null ? "—" : decimal(c.frequency, 2)) },
            ...extraColumns(META_EXTRA_METRICS, currency),
            {
              key: "results",
              metric: "results",
              label: "Resultados",
              align: "right",
              sort: (c) => c.extra?.results ?? null,
              render: (c) =>
                c.extra?.results == null ? (
                  "—"
                ) : (
                  <>
                    {int(c.extra.results)} <span className="text-[11px] text-fg-2">{c.resultLabel}</span>
                  </>
                ),
            },
            { key: "costPerResult", metric: "costPerResult", label: "Custo por resultado", align: "right", sort: (c) => c.extra?.costPerResult ?? null, render: (c) => money(c.extra?.costPerResult, currency) },
          ]}
        />
      </Panel>
    </div>
  );
}

// ---- funil ---------------------------------------------------------------------------------

function biggestDrop(steps: FunnelStep[]): number {
  let idx = -1;
  let worst = 2;
  steps.forEach((s, i) => {
    if (i && s.rate != null && s.rate < worst) {
      worst = s.rate;
      idx = i;
    }
  });
  return idx;
}

function FunnelSteps({ steps, compact = false, currency }: { steps: FunnelStep[]; compact?: boolean; currency: string }) {
  const top = steps[0]?.count ?? 0;
  if (!top) return <NoData />;
  const drop = biggestDrop(steps);
  return (
    <ol className={compact ? "space-y-2.5" : "space-y-3.5"} aria-label="Etapas do funil">
      {steps.map((s, i) => {
        const width = Math.max(3, (s.count / top) * 100);
        const isDrop = i === drop;
        return (
          <li key={s.id}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="truncate text-fg">{s.label}</span>
              <span className="font-semibold tnum text-fg">{int(s.count)}</span>
            </div>
            <div className={`mt-1 overflow-hidden rounded-[4px] bg-line/50 ${compact ? "h-2" : "h-3"}`} aria-hidden>
              <div className="h-full rounded-[4px]" style={{ width: `${width}%`, background: `var(--seq-${"abcd"[Math.min(3, Math.floor((i / Math.max(1, steps.length - 1)) * 3.99))]})` }} />
            </div>
            {i > 0 && (
              <p className={`mt-0.5 flex flex-wrap gap-x-3 text-[11px] tnum ${isDrop ? "font-semibold text-error-fg" : "text-fg-2"}`}>
                <span>
                  {s.rate == null ? "—" : pct(s.rate, s.rate < 0.1 ? 1 : 0)} da etapa anterior{isDrop ? " · maior queda" : ""}
                </span>
                {!compact && s.cost != null && <span className="text-fg-2">{money(s.cost, currency)} por etapa</span>}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function MetaFunnel({ data }: PageProps) {
  const view = meta(data);
  const { currency, hideSpend } = data;
  const [imp, click, , , , buy] = view.funnel;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 @[900px]:grid-cols-[3fr_2fr]">
        <Panel title="Funil de compra" subtitle={hideSpend ? "Das impressões à compra, somando todas as campanhas." : "Das impressões à compra, somando todas as campanhas. O custo por etapa divide o investimento pela etapa."}>
          <FunnelSteps steps={view.funnel} currency={currency} />
        </Panel>
        <div className="grid content-start gap-3">
          <Stat label="Taxa de conversão do clique" value={formatValue(click && buy ? buy.count / Math.max(1, click.count) : null, "pct")} note="Compras ÷ cliques no link" />
          <Stat label="CTR do link" value={formatValue(imp && click ? click.count / Math.max(1, imp.count) : null, "pct")} note="Cliques no link ÷ impressões" />
          {!hideSpend && <Stat label="Custo por compra" value={money(buy?.cost ?? null, currency)} note={`Investimento ${moneyCompact(view.totals.spend, currency)}`} />}
        </div>
      </div>
      <Panel title="Funil por etapa da campanha" subtitle="Prospecção traz gente nova; remarketing e retenção convertem quem já conhece a loja.">
        <DataTable
          rows={view.funnelByStage}
          rowKey={(s) => s.stage}
          caption="Funil por etapa da campanha"
          minWidth={620}
          columns={[
            { key: "stage", label: "Etapa", sticky: true, render: (s) => <span className="font-medium text-fg">{s.label}</span> },
            { key: "spend", metric: "spend", label: "Investimento", align: "right", render: (s) => hiddenOr(hideSpend, money(s.spend, currency, { decimals: false })) },
            { key: "clicks", metric: "linkClicks", label: "Cliques no link", align: "right", render: (s) => int(s.linkClicks) },
            { key: "atc", metric: "addToCart", label: "Carrinho", align: "right", render: (s) => int(s.addToCart) },
            { key: "conv", metric: "purchases", label: "Compras", align: "right", render: (s) => int(s.conversions) },
            { key: "rate", metric: "convRate", label: "Conversão do clique", align: "right", render: (s) => formatValue(s.convRate, "pct") },
            { key: "roas", metric: "roas", label: "ROAS", align: "right", render: (s) => <Roas value={s.roas} breakEven={view.breakEvenRoas} /> },
          ]}
        />
      </Panel>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3">
      <p className="label-caps text-[10.5px] text-fg-2">{label}</p>
      <p className="mt-1 text-[22px] leading-none font-bold tracking-[-0.02em] tnum">{value}</p>
      <p className="mt-1 text-[11.5px] text-fg-2">{note}</p>
    </div>
  );
}

// ---- público -------------------------------------------------------------------------------

type AudienceMetric = "value" | "roas";

export function MetaAudience({ data }: PageProps) {
  const view = meta(data);
  const [metric, setMetric] = useState<AudienceMetric>("value");
  const { hideSpend } = data;
  const genders = (["female", "male"] as const).filter((g) => view.ageGender.some((c) => c.gender === g));
  const genderTotals = genders.map((g) => {
    const cells = view.ageGender.filter((c) => c.gender === g);
    const value = cells.reduce((a, c) => a + c.value, 0);
    return { g, value, share: cells.reduce((a, c) => a + c.valueShare, 0) };
  });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 @[1040px]:grid-cols-[3fr_2fr]">
        <Panel
          title="Idade × gênero"
          subtitle={metric === "value" ? "Participação na receita. Mais escuro = mais receita." : "ROAS por grupo. Vermelho = abaixo do equilíbrio."}
          aside={
            hideSpend ? undefined : (
              <Segmented
                label="Métrica do quadro"
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "value", label: "Receita" },
                  { value: "roas", label: "ROAS" },
                ]}
              />
            )
          }
        >
          {view.ageGender.length ? <AgeGenderMatrix view={view} metric={metric} genders={genders} hideSpend={hideSpend} /> : <NoData />}
        </Panel>
        <Panel title="Gênero" subtitle="Participação na receita do período.">
          {genderTotals.length ? (
            <div>
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {genderTotals.map((t, i) => (
                  <span key={t.g} style={{ width: `${t.share * 100}%`, background: i ? "var(--seq-c)" : "var(--accent)" }} />
                ))}
              </div>
              <ul className="mt-3 space-y-2 text-[13px]">
                {genderTotals.map((t, i) => (
                  <li key={t.g} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-fg">
                      <span className="size-2.5 rounded-[3px]" style={{ background: i ? "var(--seq-c)" : "var(--accent)" }} aria-hidden />
                      {GENDER_LABEL[t.g]}
                    </span>
                    <span className="tnum">
                      <strong>{pct(t.share, 0)}</strong> <span className="text-fg-2">· {moneyCompact(t.value, data.currency)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <NoData />
          )}
        </Panel>
      </div>
      <div className="grid gap-3 @[900px]:grid-cols-3">
        <Panel title="Posicionamentos" subtitle={hideSpend ? "Participação no investimento." : "Participação no investimento e ROAS."}>
          <SliceBars items={view.placements} breakEven={view.breakEvenRoas} basis="spend" label="Posicionamentos" />
        </Panel>
        <Panel title="Dispositivos" subtitle={hideSpend ? "Participação na receita." : "Participação na receita e ROAS."}>
          <SliceBars items={view.devices} breakEven={view.breakEvenRoas} label="Dispositivos" />
        </Panel>
        <Panel title="Estados que mais vendem" subtitle="Top 10 por receita.">
          <SliceBars items={[...view.regions].sort((a, b) => b.value - a.value)} limit={10} breakEven={view.breakEvenRoas} label="Estados" />
        </Panel>
      </div>
    </div>
  );
}

function AgeGenderMatrix({ view, metric, genders, hideSpend }: { view: MetaView; metric: AudienceMetric; genders: readonly ("female" | "male")[]; hideSpend: boolean }) {
  const cell = (age: string, g: string) => view.ageGender.find((c) => c.age === age && c.gender === g);
  const maxShare = Math.max(...view.ageGender.map((c) => c.valueShare)) || 1;
  const breakEven = view.breakEvenRoas ?? 1;
  const maxRoas = Math.max(...view.ageGender.map((c) => c.roas ?? 0)) || 1;
  return (
    <table className="w-full table-fixed border-separate border-spacing-[3px] text-[12px] tnum">
      <caption className="sr-only">{hideSpend ? "Receita por idade e gênero" : "Receita e ROAS por idade e gênero"}</caption>
      <thead>
        <tr>
          <th scope="col" className="w-16 text-left text-[11px] font-medium text-fg-2">
            Idade
          </th>
          {genders.map((g) => (
            <th key={g} scope="col" className="text-[11px] font-medium text-fg-2">
              {GENDER_LABEL[g]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {AGE_BUCKETS.map((age) => (
          <tr key={age}>
            <th scope="row" className="text-left text-[11.5px] font-normal text-fg-2">
              {age === "65+" ? "65+" : age}
            </th>
            {genders.map((g) => {
              const c = cell(age, g);
              if (!c) return <td key={g} className="h-11 rounded-[6px] bg-line/40 text-center text-fg-2">—</td>;
              const bad = (c.roas ?? 0) < breakEven;
              const level = metric === "value" ? c.valueShare / maxShare : (c.roas ?? 0) / maxRoas;
              const bg = metric === "roas" && bad ? "var(--error-soft)" : `color-mix(in srgb, var(--accent) ${Math.round(10 + level * 80)}%, var(--card))`;
              const dark = metric === "value" ? level > 0.55 : !bad && level > 0.55;
              return (
                <td key={g} className="h-11 rounded-[6px] px-2 text-center" style={{ background: bg }}>
                  <span className={`block font-semibold ${dark ? "text-on-accent" : bad && metric === "roas" ? "text-error-fg" : "text-fg"}`}>
                    {metric === "value" ? pct(c.valueShare, 1) : c.roas == null ? "—" : decimal(c.roas, 2)}
                  </span>
                  {!hideSpend && (
                    <span className={`block text-[10.5px] ${dark ? "text-on-accent/80" : "text-fg-2"}`}>{metric === "value" ? `ROAS ${c.roas == null ? "—" : decimal(c.roas, 1)}` : pct(c.valueShare, 0)}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
