"use client";

// Blocos que Meta e Google compartilham: o gráfico principal (investimento ×
// receita por dia) e a tabela compacta das campanhas da visão geral.

import { ComboChart } from "@/components/charts/ComboChart";
import { brl, brlCompact, decimal } from "@/lib/format";
import { formatValue, HIDDEN, money } from "./format";
import { ddmm } from "./ranges";
import type { CampaignRowVM, LiveDashboardData } from "./types";
import { DataTable, InlineBar, Panel, Roas, StatusDot } from "./ui";

export type PageProps = { data: LiveDashboardData };

/** Rótulo curto do eixo em reais (os valores já estão em reais). */
const axisMoney = (cur: string) => (v: number) => (cur === "BRL" ? (Math.abs(v) >= 10_000 ? brlCompact(v * 100) : brl(v * 100, { decimals: false })) : decimal(v, 0));

export function HeroChart({ data, spendLabel, valueLabel }: PageProps & { spendLabel: string; valueLabel: string }) {
  const { view, currency, hideSpend } = data;
  const points = view.daily.map((d) => ({ label: ddmm(d.date), bar: hideSpend ? null : d.spend, line: d.value, maturing: d.maturing }));
  const total = view.totals;
  const settled = view.daily.filter((d) => !d.maturing);
  const best = [...settled].sort((a, b) => b.value - a.value)[0];
  const summary = `${valueLabel} por dia nos últimos ${view.daily.length} dias: total ${formatValue(total.value, "money", currency)}${hideSpend ? "" : `, ${spendLabel.toLowerCase()} ${formatValue(total.spend, "money", currency)}`}, ROAS ${total.roas == null ? "—" : decimal(total.roas, 2)}.${best ? ` Melhor dia ${ddmm(best.date)}.` : ""} Os últimos dias estão em maturação.`;
  return (
    <Panel
      title={hideSpend ? `${valueLabel} por dia` : `${spendLabel} × ${valueLabel.toLowerCase()} por dia`}
      subtitle={hideSpend ? "Investimento oculto neste link." : "Barras: o que foi investido. Linha: o que voltou. Mesmo eixo, em reais."}
      aside={
        hideSpend ? undefined : (
          <span className="tnum">
            ROAS do período <strong className="text-fg">{total.roas == null ? "—" : decimal(total.roas, 2)}</strong>
          </span>
        )
      }
    >
      <ComboChart
        points={points}
        barLabel={spendLabel}
        lineLabel={valueLabel}
        formatY={axisMoney(currency)}
        summary={summary}
        tooltip={(i) => {
          const d = view.daily[i];
          return [
            ...(hideSpend ? [] : ([[spendLabel, money(d.spend, currency)]] as [string, string][])),
            [valueLabel, money(d.value, currency)],
            ...(hideSpend ? [] : ([["ROAS", d.roas == null ? "—" : decimal(d.roas, 2)]] as [string, string][])),
            ["Conversões", formatValue(d.conversions, "decimal")],
          ];
        }}
      />
    </Panel>
  );
}

/** As campanhas que mais investem, com participação e ROAS. */
export function TopCampaigns({ data, limit = 6, kindLabel }: PageProps & { limit?: number; kindLabel: (kind: string | null) => string }) {
  const { view, currency, hideSpend } = data;
  return (
    <Panel title="Campanhas que mais investem" subtitle={hideSpend ? "Participação de cada campanha no período." : `ROAS em vermelho fica abaixo do equilíbrio${view.breakEvenRoas ? ` (${decimal(view.breakEvenRoas, 1)})` : " (1,0)"}.`}>
      <DataTable<CampaignRowVM>
        rows={view.campaigns.slice(0, limit)}
        rowKey={(c) => c.id}
        caption="Campanhas que mais investem no período"
        minWidth={520}
        columns={[
          {
            key: "name",
            label: "Campanha",
            sticky: true,
            className: "max-w-[14rem]",
            render: (c) => (
              <span className="block min-w-0">
                <span className="block truncate font-medium text-fg">{c.name}</span>
                <span className="text-[11px] text-fg-2">{kindLabel(c.kind)}</span>
              </span>
            ),
          },
          { key: "share", metric: hideSpend ? undefined : "spend", label: hideSpend ? "Participação" : "Investimento", render: (c) => <InlineBar share={c.spendShare} label={hideSpend ? `${Math.round(c.spendShare * 100)}%` : undefined} />, className: "w-[30%]" },
          ...(hideSpend ? [] : [{ key: "spend", metric: "spend", label: "Valor", align: "right" as const, render: (c: CampaignRowVM) => money(c.spend, currency, { decimals: false }) }]),
          { key: "roas", metric: "roas", label: "ROAS", align: "right", render: (c) => <Roas value={c.roas} breakEven={view.breakEvenRoas} /> },
          { key: "cpa", metric: "cpa", label: "CPA", align: "right", render: (c) => money(c.cpa, currency) },
        ]}
      />
    </Panel>
  );
}

export function StatusCell({ name, status, sub }: { name: string; status: string; sub?: string }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium text-fg" title={name}>
        {name}
      </span>
      <span className="flex items-center gap-2">
        <StatusDot status={status} />
        {sub && <span className="truncate text-[11px] text-fg-2">{sub}</span>}
      </span>
    </span>
  );
}

export const hiddenOr = (hide: boolean, v: string) => (hide ? HIDDEN : v);
