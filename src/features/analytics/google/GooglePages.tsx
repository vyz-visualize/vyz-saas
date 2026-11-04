"use client";

// Páginas do Google Ads · E-commerce: visão geral, campanhas, termos de pesquisa e produtos.

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Heatmap } from "@/components/charts/Heatmap";
import { Segmented } from "@/components/ui/Segmented";
import { decimal, int, pct } from "@/lib/format";
import { useColumnVisible } from "@/features/dashboards/metric-prefs-context";
import { CHANNEL_LABEL } from "../aggregate";
import { formatValue, HIDDEN, MATCH_LABEL, money, moneyCompact } from "../format";
import { GOOGLE_EXTRA_METRICS } from "../live-metrics";
import { useDashFilters } from "../filter-context";
import { CAMPAIGN_ROW_FILTER, extraColumns, maturingPoints, useExtraColumnsWidth, hiddenOr, HeroChart, StatusCell, TopCampaigns, type PageProps } from "../shared";
import type { CampaignRowVM, GoogleView, ProductVM, SearchTermVM } from "../types";
import { Chip, DataTable, InlineBar, KpiGrid, NoData, Panel, Roas, SliceBars, Thumb } from "../ui";

const channelLabel = (c: string | null) => (c ? (CHANNEL_LABEL[c] ?? "Outras") : "Outras");
const google = (data: PageProps["data"]) => data.view as GoogleView;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function GoogleOverview({ data }: PageProps) {
  const view = google(data);
  const filters = useDashFilters();
  return (
    <div className="space-y-3">
      <KpiGrid platform={view.platform} kpis={view.kpis} extra={view.extraKpis} currency={data.currency} maturing={maturingPoints(data, filters?.filters.days)} hideSpend={data.hideSpend} />
      <div className="grid gap-3 @[1040px]:grid-cols-3">
        <div className="min-w-0 @[1040px]:col-span-2">
          <HeroChart data={data} spendLabel="Custo" valueLabel="Valor de conversão" />
        </div>
        <ImpressionSharePanel view={view} hideSpend={data.hideSpend} />
      </div>
      <div className="grid gap-3 @[900px]:grid-cols-2">
        <ChannelsPanel data={data} />
        <Panel section="breakdown" title="Dispositivos" subtitle={data.hideSpend ? "Participação no valor de conversão." : "Participação no valor de conversão e ROAS."}>
          <SliceBars items={view.devices} breakEven={view.breakEvenRoas} label="Dispositivos" />
        </Panel>
      </div>
      <HourPanel view={view} data={data} />
    </div>
  );
}

function ImpressionSharePanel({ view, hideSpend }: { view: GoogleView; hideSpend: boolean }) {
  const s = view.impressionShare;
  if (s.share == null) {
    return (
      <Panel title="Parcela de impressões" subtitle="Só as campanhas de pesquisa têm esse dado.">
        <NoData text="Nenhuma campanha de pesquisa no período." />
      </Panel>
    );
  }
  const won = s.share;
  const budget = s.lostBudget ?? 0;
  const rank = s.lostRank ?? Math.max(0, 1 - won - budget);
  const parts = [
    { label: "Ganha", value: won, color: "var(--accent)" },
    { label: "Perdida por orçamento", value: budget, color: "#D9A441" },
    { label: "Perdida por classificação", value: rank, color: "var(--muted)" },
  ];
  return (
    <Panel title="Parcela de impressões" subtitle="Pesquisa: de cada 100 vezes que o anúncio podia aparecer, quantas apareceu.">
      <p className="text-[34px] leading-none font-bold tracking-[-0.03em] tnum">{pct(won, 0)}</p>
      <p className="mt-1 text-[12px] text-fg-2">{s.previousShare == null ? "sem comparação" : `${pct(s.previousShare, 0)} no período anterior`}</p>
      <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.value, 0)}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.label} style={{ width: `${p.value * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[12.5px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-fg">
              <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
              {p.label}
            </span>
            <strong className="tnum">{pct(p.value, 0)}</strong>
          </li>
        ))}
      </ul>
      {budget >= 0.1 && <p className="mt-3 rounded-control bg-bg px-2.5 py-2 text-[12px] leading-snug text-fg-2">O orçamento corta {pct(budget, 0)} das aparições.{!hideSpend && " Se o ROAS dessas campanhas está bom, vale aumentar a verba."}</p>}
    </Panel>
  );
}

function ChannelsPanel({ data }: PageProps) {
  const view = google(data);
  const list = view.channels;
  const showRoas = useColumnVisible("roas");
  return (
    <Panel title="Por tipo de campanha" subtitle={data.hideSpend ? "Participação de cada tipo e o valor que volta." : "Onde o custo vai e quanto volta."}>
      {!list.length ? (
        <NoData />
      ) : (
        <>
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
            {list.map((c, i) => (
              <span key={c.channel} style={{ width: `${c.spendShare * 100}%`, background: `var(--seq-${"abcd"[Math.min(3, i)]})` }} />
            ))}
          </div>
          <table className="mt-3 w-full text-[12.5px] tnum">
            <caption className="sr-only">{data.hideSpend ? "Participação e valor por tipo de campanha" : "Custo, valor e ROAS por tipo de campanha"}</caption>
            <thead>
              <tr className="text-[11px] text-fg-2">
                <th scope="col" className="pb-1 text-left font-medium">
                  Tipo
                </th>
                <th scope="col" className="pb-1 text-right font-medium">
                  {data.hideSpend ? "Participação" : "Custo"}
                </th>
                <th scope="col" className="pb-1 text-right font-medium">
                  Valor
                </th>
                {showRoas && (
                  <th scope="col" className="pb-1 text-right font-medium">
                    ROAS
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((c, i) => (
                <tr key={c.channel} className="border-t border-line/60">
                  <th scope="row" className="py-1.5 text-left font-normal text-fg">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--seq-${"abcd"[Math.min(3, i)]})` }} aria-hidden />
                      {c.label}
                    </span>
                  </th>
                  <td className="py-1.5 text-right">{data.hideSpend ? pct(c.spendShare, 0) : moneyCompact(c.spend, data.currency)}</td>
                  <td className="py-1.5 text-right">{moneyCompact(c.value, data.currency)}</td>
                  {showRoas && (
                    <td className="py-1.5 text-right">
                      <Roas value={c.roas} breakEven={view.breakEvenRoas} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

type HourMetric = "conversions" | "value";

function HourPanel({ view, data }: { view: GoogleView; data: PageProps["data"] }) {
  const [metric, setMetric] = useState<HourMetric>("conversions");
  const cells = view.heatmap.map((c) => ({
    row: c.weekday,
    col: c.hour,
    value: metric === "conversions" ? c.conversions : c.value,
    detail: metric === "conversions" ? `${decimal(c.conversions, 1)} conversões` : `${moneyCompact(c.value, data.currency)} em valor`,
  }));
  const hours = Array.from({ length: 24 }, (_, h) => `${h}h`);
  return (
    <Panel
      section="breakdown"
      title="Quando as conversões acontecem"
      subtitle="Dia da semana × hora (fuso da conta), somando o período."
      aside={
        <Segmented
          label="Métrica do mapa"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "conversions", label: "Conversões" },
            { value: "value", label: "Valor" },
          ]}
        />
      }
    >
      {cells.length ? (
        <div className="-mx-1 overflow-x-auto px-1 contain-paint">
          <div className="min-w-[520px]">
            <Heatmap rows={WEEKDAYS} cols={hours} cells={cells} colTicks={[0, 3, 6, 9, 12, 15, 18, 21]} legend={["menos", "mais"]} summary={`Mapa de calor de ${metric === "conversions" ? "conversões" : "valor de conversão"} por dia da semana e hora.`} />
          </div>
        </div>
      ) : (
        <NoData />
      )}
    </Panel>
  );
}

export function GoogleCampaigns({ data }: PageProps) {
  const view = google(data);
  const { currency, hideSpend } = data;
  const extraWidth = useExtraColumnsWidth(GOOGLE_EXTRA_METRICS.map((m) => m.id));
  return (
    <div className="space-y-3">
      <Panel title="Todas as campanhas" subtitle="Parcela de impressões só nas de pesquisa: ganha, perdida por orçamento e por classificação.">
        <DataTable<CampaignRowVM>
          rows={view.campaigns}
          rowKey={(c) => c.id}
          rowFilter={CAMPAIGN_ROW_FILTER}
          caption="Campanhas do Google Ads no período"
          initialSort={{ key: "spend", dir: "desc" }}
          minWidth={1040 + extraWidth}
          rowClassName={(c) => (c.belowBreakEven ? "[&>*]:bg-error-soft/30" : "")}
          columns={[
            { key: "name", label: "Campanha", sticky: true, className: "w-[15rem] max-w-[15rem]", sort: (c) => c.name, render: (c) => <StatusCell name={c.name} status={c.status} sub={channelLabel(c.kind)} /> },
            {
              key: "spend", metric: "spend",
              label: "Custo",
              sort: (c) => c.spendShare,
              className: "w-[10rem]",
              render: (c) => (
                <span className="block">
                  <span className="block text-right">{hiddenOr(hideSpend, money(c.spend, currency, { decimals: false }))}</span>
                  <InlineBar share={c.spendShare} />
                </span>
              ),
            },
            { key: "value", metric: "value", label: "Valor conv.", align: "right", sort: (c) => c.value, render: (c) => moneyCompact(c.value, currency) },
            { key: "roas", metric: "roas", label: "ROAS", align: "right", sort: (c) => c.roas, render: (c) => <Roas value={c.roas} breakEven={view.breakEvenRoas} /> },
            { key: "conv", metric: "conversions", label: "Conversões", align: "right", sort: (c) => c.conversions, render: (c) => decimal(c.conversions, 1) },
            { key: "cpa", metric: "cpa", label: "CPA", align: "right", sort: (c) => c.cpa, render: (c) => money(c.cpa, currency) },
            { key: "ctr", metric: "ctr", label: "CTR", align: "right", sort: (c) => c.ctr, render: (c) => formatValue(c.ctr, "pct") },
            { key: "cpc", metric: "cpc", label: "CPC médio", align: "right", sort: (c) => c.cpc, render: (c) => money(c.cpc, currency) },
            { key: "is", metric: "impressionShare", label: "Parcela de impressões", sort: (c) => c.impressionShare, className: "w-[11rem]", render: (c) => <ShareBar c={c} /> },
            ...extraColumns(GOOGLE_EXTRA_METRICS, currency),
          ]}
        />
      </Panel>
      <TopCampaigns data={data} kindLabel={channelLabel} limit={3} />
    </div>
  );
}

function ShareBar({ c }: { c: CampaignRowVM }) {
  if (c.impressionShare == null) return <span className="block text-right text-fg-2">—</span>;
  const won = c.impressionShare;
  const budget = c.lostBudget ?? 0;
  const rank = c.lostRank ?? Math.max(0, 1 - won - budget);
  return (
    <span className="block" aria-label={`Ganha ${pct(won, 0)}, perdida por orçamento ${pct(budget, 0)}, por classificação ${pct(rank, 0)}`}>
      <span className="flex justify-between text-[11px]">
        <strong className="text-fg">{pct(won, 0)}</strong>
        <span className={budget >= 0.1 ? "font-semibold text-fg" : "text-fg-2"}>
          {pct(budget, 0)} orç. · {pct(rank, 0)} class.
        </span>
      </span>
      <span className="mt-1 flex h-1.5 gap-px overflow-hidden rounded-full" aria-hidden>
        <span className="bg-accent" style={{ width: `${won * 100}%` }} />
        <span className="bg-warning" style={{ width: `${budget * 100}%` }} />
        <span className="bg-muted" style={{ width: `${rank * 100}%` }} />
      </span>
    </span>
  );
}

// ---- termos ---------------------------------------------------------------------------------

export function GoogleTerms({ data }: PageProps) {
  const view = google(data);
  const { currency, hideSpend } = data;
  const [q, setQ] = useState("");
  const id = useId();
  const filter = (list: SearchTermVM[]) => {
    const s = q.trim().toLocaleLowerCase("pt-BR");
    return s ? list.filter((t) => t.term.toLocaleLowerCase("pt-BR").includes(s)) : list;
  };
  const top = useMemo(() => view.searchTerms.filter((t) => t.conversions > 0), [view.searchTerms]);
  if (!view.searchTerms.length) return <NoData text="Nenhum termo de pesquisa no período." />;
  const termCol = { key: "term", label: "Termo", sticky: true, className: "w-[14rem] max-w-[14rem]", sort: (t: SearchTermVM) => t.term, render: (t: SearchTermVM) => <TermCell t={t} /> };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 @[760px]:grid-cols-3">
        <Summary label="Termos com conversão" value={int(top.length)} note={`de ${int(view.searchTerms.length)} termos`} />
        <Summary label="Gasto sem conversão" value={hideSpend ? HIDDEN : money(view.wastedSpend, currency, { decimals: false })} note={`${pct(view.wastedShare, 1)} do custo · ${view.wastedTerms.length} termos`} bad={view.wastedShare >= 0.03} />
        <Summary label="Melhor termo" value={top[0]?.term ?? "—"} note={top[0] ? `${moneyCompact(top[0].value, currency)} em valor` : ""} small />
      </div>
      <div className="relative max-w-sm">
        <label htmlFor={id} className="sr-only">
          Filtrar termos
        </label>
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" aria-hidden />
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar termos"
          className="h-10 w-full rounded-control border border-line bg-field pr-3 pl-9 text-[14px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>
      <Panel title="Termos que mais trazem valor" subtitle="Somados por termo e tipo de correspondência.">
        <DataTable<SearchTermVM>
          rows={filter(top)}
          rowKey={(t) => `${t.term}|${t.matchType}`}
          caption="Termos de pesquisa que mais trazem valor"
          initialSort={{ key: "value", dir: "desc" }}
          limit={15}
          minWidth={760}
          columns={[
            termCol,
            { key: "value", metric: "value", label: "Valor conv.", align: "right", sort: (t) => t.value, render: (t) => moneyCompact(t.value, currency) },
            { key: "conv", metric: "conversions", label: "Conversões", align: "right", sort: (t) => t.conversions, render: (t) => decimal(t.conversions, 1) },
            { key: "roas", metric: "roas", label: "ROAS", align: "right", sort: (t) => t.roas, render: (t) => <Roas value={t.roas} breakEven={view.breakEvenRoas} /> },
            { key: "spend", metric: "spend", label: "Custo", align: "right", sort: (t) => t.spend, render: (t) => hiddenOr(hideSpend, money(t.spend, currency)) },
            { key: "ctr", metric: "ctr", label: "CTR", align: "right", sort: (t) => t.ctr, render: (t) => formatValue(t.ctr, "pct") },
            { key: "cpa", metric: "cpa", label: "CPA", align: "right", sort: (t) => t.cpa, render: (t) => money(t.cpa, currency) },
          ]}
        />
      </Panel>
      <Panel title="Desperdício: gastaram e não converteram" subtitle="Candidatos a palavra-chave negativa. Ordenados pelo custo.">
        <DataTable<SearchTermVM>
          rows={filter(view.wastedTerms)}
          rowKey={(t) => `${t.term}|${t.matchType}`}
          caption="Termos de pesquisa com custo e sem conversão"
          initialSort={hideSpend ? { key: "clicks", dir: "desc" } : { key: "spend", dir: "desc" }}
          limit={10}
          minWidth={620}
          columns={[
            termCol,
            {
              key: "spend", metric: "spend",
              label: "Custo",
              sort: (t) => t.spend,
              className: "w-[11rem]",
              render: (t) => (
                <span className="block">
                  <span className="block text-right font-semibold text-error-fg">{hiddenOr(hideSpend, money(t.spend, currency))}</span>
                  {!hideSpend && <InlineBar share={(t.spend ?? 0) / Math.max(1, view.wastedTerms[0]?.spend ?? 1)} tone="bad" />}
                </span>
              ),
            },
            { key: "clicks", metric: "clicks", label: "Cliques", align: "right", sort: (t) => t.clicks, render: (t) => int(t.clicks) },
            { key: "impr", metric: "impressions", label: "Impressões", align: "right", sort: (t) => t.impressions, render: (t) => int(t.impressions) },
            { key: "ctr", metric: "ctr", label: "CTR", align: "right", sort: (t) => t.ctr, render: (t) => formatValue(t.ctr, "pct") },
          ]}
        />
      </Panel>
    </div>
  );
}

function TermCell({ t }: { t: SearchTermVM }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium text-fg" title={t.term}>
        {t.term}
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-fg-2">
        <Chip>{MATCH_LABEL[t.matchType] ?? t.matchType}</Chip>
        <span className="truncate">{t.campaignName}</span>
      </span>
    </span>
  );
}

function Summary({ label, value, note, bad = false, small = false }: { label: string; value: string; note: string; bad?: boolean; small?: boolean }) {
  return (
    <div className={`min-w-0 rounded-card border px-4 py-3 ${bad ? "border-error/30 bg-error-soft/50" : "border-line bg-card"}`}>
      <p className="label-caps text-[10.5px] text-fg-2">{label}</p>
      <p className={`mt-1 truncate leading-tight font-bold tracking-[-0.02em] tnum ${small ? "text-[17px]" : "text-[22px]"} ${bad ? "text-error-fg" : "text-fg"}`} title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-fg-2">{note}</p>
    </div>
  );
}

// ---- produtos ---------------------------------------------------------------------------------

export function GoogleProducts({ data }: PageProps) {
  const view = google(data);
  const { currency, hideSpend } = data;
  if (!view.products.length) return <NoData text="Nenhum produto com dados no período (Shopping e Performance Max)." />;
  const podium = view.products.slice(0, 3);
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 @[760px]:grid-cols-3" aria-label="Os três produtos que mais vendem">
        {podium.map((p, i) => (
          <li key={p.id} className="flex gap-3 overflow-hidden rounded-card border border-line bg-card p-3">
            <Thumb seed={p.id} url={p.imageUrl} label={p.category ?? ""} className="size-20 shrink-0 rounded-control" />
            <div className="min-w-0">
              <p className="label-caps text-[10px] text-fg-2">{i + 1}º em valor</p>
              <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-fg">{p.title}</p>
              <p className="mt-1 text-[12px] tnum text-fg-2">
                <strong className="text-fg">{moneyCompact(p.value, currency)}</strong>
                {!hideSpend && (
                  <>
                    {" "}
                    · ROAS <Roas value={p.roas} breakEven={view.breakEvenRoas} />
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 @[1040px]:grid-cols-[3fr_1fr]">
        <Panel section="products" title="Ranking de produtos" subtitle="Shopping e Performance Max. Conversões aproximam as unidades vendidas.">
          <DataTable<ProductVM>
            rows={view.products}
            rowKey={(p) => p.id}
            caption="Produtos por valor de conversão"
            initialSort={{ key: "value", dir: "desc" }}
            limit={12}
            minWidth={800}
            columns={[
              {
                key: "title",
                label: "Produto",
                sticky: true,
                className: "w-[16rem] max-w-[16rem]",
                sort: (p) => p.title,
                render: (p) => (
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Thumb seed={p.id} url={p.imageUrl} label="" className="size-9 shrink-0 rounded-[6px]" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg" title={p.title}>
                        {p.title}
                      </span>
                      <span className="block truncate text-[11px] text-fg-2">
                        {p.category ?? "Sem categoria"}
                        {p.price != null ? ` · ${money(p.price, currency)}` : ""}
                      </span>
                    </span>
                  </span>
                ),
              },
              {
                key: "value", metric: "value",
                label: "Valor conv.",
                sort: (p) => p.value,
                className: "w-[11rem]",
                render: (p) => (
                  <span className="block">
                    <span className="block text-right">{moneyCompact(p.value, currency)}</span>
                    <InlineBar share={p.valueShare / Math.max(0.0001, view.products[0].valueShare)} />
                  </span>
                ),
              },
              { key: "conv", metric: "conversions", label: "Conversões", align: "right", sort: (p) => p.conversions, render: (p) => decimal(p.conversions, 1) },
              { key: "roas", metric: "roas", label: "ROAS", align: "right", sort: (p) => p.roas, render: (p) => <Roas value={p.roas} breakEven={view.breakEvenRoas} /> },
              { key: "spend", metric: "spend", label: "Custo", align: "right", sort: (p) => p.spend, render: (p) => hiddenOr(hideSpend, money(p.spend, currency, { decimals: false })) },
              { key: "ctr", metric: "ctr", label: "CTR", align: "right", sort: (p) => p.ctr, render: (p) => formatValue(p.ctr, "pct") },
            ]}
          />
        </Panel>
        <Panel section="products" title="Categorias" subtitle={hideSpend ? "Participação no valor." : "Participação no valor e ROAS."}>
          <SliceBars items={view.productCategories} breakEven={view.breakEvenRoas} label="Categorias de produto" />
        </Panel>
      </div>
    </div>
  );
}
