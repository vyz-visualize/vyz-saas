"use client";

// Blocos das páginas de plataforma: quebras (posicionamento, dispositivo, estado, hora),
// termos de pesquisa (tabela, desperdício, correspondência, palavras) e retenção dos vídeos.
// Todos leem o detalhe do Dataset (metrics/detail.ts); sem ele, dizem que o dado ainda
// não chegou, sem inventar número.

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { metric, type Profile } from "@/features/metrics/definitions";
import { matchLabel, type BreakdownRow, type DetailDimension, type SearchTermRow } from "@/features/metrics/detail";
import type { Creative } from "@/features/metrics/source";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import { CreativeImage } from "./CreativeImage";
import { platformColor, type WidgetContext } from "./Widgets";

const HIDDEN = "•••";
const sales = (p: Profile) => p === "ecommerce" || p === "infoproduto" || p === "marketplace" || p === "executivo";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-[12px] text-fg-2">{children}</p>;
}

/** Soma por chave (com mais de uma plataforma no mesmo valor, ex.: celular no Meta e no Google). */
function merge(rows: readonly BreakdownRow[]): BreakdownRow[] {
  const by = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const b = by.get(r.key);
    if (!b) by.set(r.key, { ...r });
    else {
      b.spend += r.spend;
      b.impressions += r.impressions;
      b.clicks += r.clicks;
      b.conversions += r.conversions;
      b.revenue += r.revenue;
    }
  }
  return [...by.values()];
}

// ---- quebras -----------------------------------------------------------------------------

export function BreakdownWidget({ ctx, dimension, platform, limit = 7 }: { ctx: WidgetContext; dimension: DetailDimension; platform?: PlatformId; limit?: number }) {
  const all = ctx.ds.breakdowns?.[dimension];
  const rows = useMemo(() => merge((all ?? []).filter((r) => !platform || r.platform === platform)), [all, platform]);
  if (!all) return <Empty>Esta quebra chega com a próxima sincronização da conta.</Empty>;
  if (!rows.length) return <Empty>Sem dados desta quebra no período.</Empty>;
  if (dimension === "hour") return <Hours rows={rows} ctx={ctx} />;
  const money = sales(ctx.profile);
  const spend = rows.reduce((a, r) => a + r.spend, 0) || 1;
  const conv = rows.reduce((a, r) => a + r.conversions, 0);
  const avg = money ? rows.reduce((a, r) => a + r.revenue, 0) / spend : conv ? spend / conv : 0;
  const list = [...rows].sort((a, b) => b.spend - a.spend).slice(0, limit);
  const effLabel = money ? "ROAS" : metric("cpa", ctx.profile).label;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_56px] gap-x-3 border-b border-line pb-1.5 text-[10.5px] font-medium tracking-[0.04em] text-fg-2 uppercase">
        <span>{ctx.hideSpend ? "Parte das conversões" : "Parte do investimento"}</span>
        <span className="text-right">{metric("conversions", ctx.profile).label.split(" ")[0]}</span>
        <span className="text-right">{ctx.hideSpend ? "" : effLabel}</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pt-1 [scrollbar-width:thin]">
        {list.map((r) => {
          const share = ctx.hideSpend ? (conv ? r.conversions / conv : 0) : r.spend / spend;
          const eff = money ? (r.spend ? r.revenue / r.spend : 0) : r.conversions ? r.spend / r.conversions : Infinity;
          const good = money ? eff >= avg : eff <= avg;
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_64px_56px] items-center gap-x-3 py-1.5">
              <div className="min-w-0">
                <p className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="truncate font-medium">{r.label}</span>
                  <span className="shrink-0 text-[11px] text-fg-2 tnum">{pct(share, 0)}</span>
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: platform ? platformColor(platform) : "var(--accent)" }} />
                </div>
              </div>
              <span className="text-right text-[12px] font-semibold tnum">{int(r.conversions)}</span>
              <span className={`text-right text-[12px] font-semibold tnum ${ctx.hideSpend ? "" : good ? "text-accent" : "text-error-fg"}`}>{ctx.hideSpend ? "" : !Number.isFinite(eff) ? "—" : money ? decimal(eff) : brl(eff, { decimals: false })}</span>
            </li>
          );
        })}
      </ul>
      {!ctx.hideSpend && <p className="mt-1.5 text-[10.5px] text-fg-2">Verde: {money ? `ROAS acima da média (${decimal(avg)})` : `custo abaixo da média (${brl(avg, { decimals: false })})`}.</p>}
    </div>
  );
}

/** Por hora do dia: colunas com as conversões e a hora mais barata em destaque. */
function Hours({ rows, ctx }: { rows: BreakdownRow[]; ctx: WidgetContext }) {
  const byHour = Array.from({ length: 24 }, (_, h) => rows.find((r) => Number(r.key) === h) ?? { key: String(h), label: `${h}h`, platform: "meta" as PlatformId, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
  const max = Math.max(...byHour.map((r) => r.conversions), 1);
  const cpa = (r: BreakdownRow) => (r.conversions ? r.spend / r.conversions : Infinity);
  const best = byHour.filter((r) => r.conversions >= max * 0.3).sort((a, b) => cpa(a) - cpa(b))[0];
  const peak = byHour.reduce((a, b) => (b.conversions > a.conversions ? b : a));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[90px] flex-1 gap-[3px]" role="img" aria-label={`Conversões por hora. Pico às ${peak.key}h${best && !ctx.hideSpend ? `; menor custo às ${best.key}h` : ""}.`}>
        {byHour.map((r, h) => (
          <div key={h} className="group/h relative flex flex-1 flex-col justify-end" title={`${h}h · ${int(r.conversions)} ${ctx.hideSpend ? "" : `· ${Number.isFinite(cpa(r)) ? brl(cpa(r), { decimals: false }) : "—"}`}`}>
            <div className={`w-full rounded-t-[4px] transition-opacity group-hover/h:opacity-100 ${r === best ? "bg-accent" : "bg-[color-mix(in_srgb,var(--accent)_45%,var(--card))] opacity-90"}`} style={{ height: `${Math.max(3, (r.conversions / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-fg-2 tnum" aria-hidden>
        {["0h", "6h", "12h", "18h", "23h"].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-fg-2">
        Pico de {metric("conversions", ctx.profile).label.toLowerCase()} às <strong className="text-fg">{peak.key}h</strong>
        {best && !ctx.hideSpend && (
          <>
            {" "}· menor custo às <strong className="text-accent">{best.key}h</strong> ({brl(cpa(best), { decimals: false })})
          </>
        )}
      </p>
    </div>
  );
}

// ---- termos de pesquisa ------------------------------------------------------------------

type TermSort = "spend" | "clicks" | "conversions" | "cpa" | "ctr";

function termStats(t: SearchTermRow) {
  return { ctr: t.impressions ? t.clicks / t.impressions : 0, cpc: t.clicks ? t.spend / t.clicks : 0, cpa: t.conversions ? t.spend / t.conversions : Infinity, rate: t.clicks ? t.conversions / t.clicks : 0, roas: t.spend ? t.revenue / t.spend : 0 };
}

export function SearchTermsWidget({ ctx, view }: { ctx: WidgetContext; view: "table" | "waste" | "match" | "words" }) {
  const terms = ctx.ds.searchTerms;
  if (!terms) return <Empty>Ligue uma conta do Google Ads com campanhas de pesquisa para ver os termos.</Empty>;
  if (!terms.length) return <Empty>Nenhum termo de pesquisa no período. Eles aparecem quando as campanhas de pesquisa recebem cliques.</Empty>;
  if (view === "waste") return <Waste terms={terms} ctx={ctx} />;
  if (view === "match") return <Match terms={terms} ctx={ctx} />;
  if (view === "words") return <Words terms={terms} ctx={ctx} />;
  return <TermTable terms={terms} ctx={ctx} />;
}

function TermTable({ terms, ctx }: { terms: SearchTermRow[]; ctx: WidgetContext }) {
  const [sort, setSort] = useState<TermSort>(ctx.hideSpend ? "clicks" : "spend");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");
  const money = sales(ctx.profile);
  const avgCpa = (() => {
    const s = terms.reduce((a, t) => a + t.spend, 0);
    const c = terms.reduce((a, t) => a + t.conversions, 0);
    return c ? s / c : Infinity;
  })();
  const rows = terms
    .filter((t) => !q || t.term.toLowerCase().includes(q.toLowerCase()))
    .map((t) => ({ t, s: termStats(t) }))
    .sort((a, b) => {
      const v = (x: typeof a) => (sort === "cpa" ? x.s.cpa : sort === "ctr" ? x.s.ctr : x.t[sort]);
      const d = v(a) - v(b);
      return (asc ? d : -d) || a.t.term.localeCompare(b.t.term);
    });
  const head = (id: TermSort | null, label: string, right = true) => (
    <th scope="col" className={`py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      {id ? (
        <button
          type="button"
          onClick={() => {
            if (sort === id) setAsc((v) => !v);
            else {
              setSort(id);
              setAsc(id === "cpa");
            }
          }}
          className={`inline-flex items-center gap-0.5 rounded outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent ${sort === id ? "text-fg" : ""}`}
        >
          {label}
          {sort === id && (asc ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />)}
        </button>
      ) : (
        label
      )}
    </th>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="mb-2 flex h-8 max-w-72 items-center gap-2 rounded-full border border-line bg-field/60 px-3 focus-within:border-accent">
        <Search size={13} aria-hidden className="text-fg-2" />
        <span className="sr-only">Buscar termo</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${terms.length} termos`} className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-fg-2/70" />
      </label>
      <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[640px] text-[11.5px] tnum">
          <thead className="sticky top-0 bg-card text-fg-2">
            <tr className="border-b border-line">
              {head(null, "Termo", false)}
              {head(null, "Correspondência", false)}
              {head("clicks", "Cliques")}
              {head("ctr", "CTR")}
              {!ctx.hideSpend && head("spend", "Investimento")}
              {!ctx.hideSpend && <th scope="col" className="py-2 text-right font-medium">CPC</th>}
              {head("conversions", metric("conversions", ctx.profile).label.split(" ")[0])}
              {!ctx.hideSpend && head("cpa", metric("cpa", ctx.profile).label)}
              {money && !ctx.hideSpend && <th scope="col" className="py-2 text-right font-medium">ROAS</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, s }) => {
              const waste = t.conversions === 0 && t.spend > 0;
              return (
                <tr key={`${t.term}|${t.matchType}`} className="border-b border-line/50 last:border-0 hover:bg-surface-2">
                  <td className="max-w-[260px] py-2 pr-2">
                    <span className="block truncate font-medium text-fg" title={t.term}>
                      {t.term}
                    </span>
                    <span className="block truncate text-[10.5px] text-fg-2">{t.campaign}</span>
                  </td>
                  <td className="py-2">
                    <span className="rounded-full border border-line px-1.5 py-px text-[10.5px] text-fg-2">{matchLabel(t.matchType)}</span>
                  </td>
                  <td className="py-2 text-right">{int(t.clicks)}</td>
                  <td className="py-2 text-right">{pct(s.ctr, 1)}</td>
                  {!ctx.hideSpend && <td className="py-2 text-right">{brlCompact(t.spend)}</td>}
                  {!ctx.hideSpend && <td className="py-2 text-right text-fg-2">{brl(s.cpc)}</td>}
                  <td className={`py-2 text-right font-semibold ${waste ? "text-error-fg" : ""}`}>{int(t.conversions)}</td>
                  {!ctx.hideSpend && <td className={`py-2 text-right font-semibold ${!Number.isFinite(s.cpa) ? "text-error-fg" : s.cpa <= avgCpa ? "text-accent" : ""}`}>{Number.isFinite(s.cpa) ? brl(s.cpa, { decimals: false }) : "sem conversão"}</td>}
                  {money && !ctx.hideSpend && <td className="py-2 text-right">{decimal(s.roas)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Termos que gastam e não convertem: candidatos a palavra-chave negativa. */
function Waste({ terms, ctx }: { terms: SearchTermRow[]; ctx: WidgetContext }) {
  const avgCpa = (() => {
    const s = terms.reduce((a, t) => a + t.spend, 0);
    const c = terms.reduce((a, t) => a + t.conversions, 0);
    return c ? s / c : Infinity;
  })();
  const list = terms
    .filter((t) => t.conversions === 0 || t.spend / t.conversions > avgCpa * 1.8)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);
  const lost = list.filter((t) => t.conversions === 0).reduce((a, t) => a + t.spend, 0);
  if (!list.length) return <Empty>Nenhum termo gastando sem retorno. Bom sinal.</Empty>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!ctx.hideSpend && (
        <div className="mb-2 rounded-[10px] bg-error-fg/10 px-3 py-2">
          <p className="text-[10.5px] font-medium tracking-[0.04em] text-error-fg uppercase">Sem conversão no período</p>
          <p className="text-[20px] leading-tight font-bold text-error-fg tnum">{brlCompact(lost)}</p>
        </div>
      )}
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto [scrollbar-width:thin]">
        {list.map((t) => (
          <li key={`${t.term}|${t.matchType}`} className="flex items-center justify-between gap-2 rounded-[8px] px-1 py-1.5 text-[12px] hover:bg-surface-2">
            <span className="min-w-0">
              <span className="block truncate font-medium">{t.term}</span>
              <span className="text-[10.5px] text-fg-2">
                {int(t.clicks)} cliques · {matchLabel(t.matchType)}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {!ctx.hideSpend && <span className="block font-semibold tnum">{brlCompact(t.spend)}</span>}
              <span className={`text-[10.5px] ${t.conversions ? "text-warning" : "text-error-fg"}`}>{t.conversions ? `${int(t.conversions)} conv. caras` : "0 conversão"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10.5px] text-fg-2">Candidatos a palavra-chave negativa.</p>
    </div>
  );
}

/** Por tipo de correspondência: quanto vai para cada uma e o custo de cada. */
function Match({ terms, ctx }: { terms: SearchTermRow[]; ctx: WidgetContext }) {
  const by = new Map<string, { spend: number; clicks: number; conv: number }>();
  for (const t of terms) {
    const k = matchLabel(t.matchType);
    const b = by.get(k) ?? { spend: 0, clicks: 0, conv: 0 };
    b.spend += t.spend;
    b.clicks += t.clicks;
    b.conv += t.conversions;
    by.set(k, b);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].spend - a[1].spend);
  const total = rows.reduce((a, [, b]) => a + (ctx.hideSpend ? b.clicks : b.spend), 0) || 1;
  const colors = ["var(--accent)", "#E9A23B", "#5B8DEF", "var(--fg-2)", "#E2557F"];
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
      <div className="flex h-3 gap-[3px] overflow-hidden rounded-full" aria-hidden>
        {rows.map(([k, b], i) => (
          <span key={k} style={{ width: `${((ctx.hideSpend ? b.clicks : b.spend) / total) * 100}%`, background: colors[i % colors.length] }} />
        ))}
      </div>
      <ul className="space-y-2">
        {rows.map(([k, b], i) => (
          <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 text-[12px]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full" style={{ background: colors[i % colors.length] }} aria-hidden />
              {k}
            </span>
            <span className="text-fg-2 tnum">{pct((ctx.hideSpend ? b.clicks : b.spend) / total, 0)}</span>
            <span className="w-20 text-right font-semibold tnum">{ctx.hideSpend ? `${int(b.conv)} conv.` : b.conv ? brl(b.spend / b.conv, { decimals: false }) : "—"}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10.5px] text-fg-2">{ctx.hideSpend ? "Parte dos cliques e conversões" : `Parte do investimento e ${metric("cpa", ctx.profile).label.toLowerCase()}`} por tipo de correspondência.</p>
    </div>
  );
}

const STOP = new Set(["de", "da", "do", "das", "dos", "para", "pra", "com", "e", "a", "o", "em", "no", "na", "perto", "mim", "que", "é", "um", "uma", "como", "por", "vale", "pena"]);

/** Palavras que mais aparecem nos termos que convertem (e nas que só gastam). */
function Words({ terms, ctx }: { terms: SearchTermRow[]; ctx: WidgetContext }) {
  const by = new Map<string, { conv: number; spend: number; n: number }>();
  for (const t of terms)
    for (const w of new Set(t.term.toLowerCase().split(/\s+/))) {
      if (w.length < 3 || STOP.has(w)) continue;
      const b = by.get(w) ?? { conv: 0, spend: 0, n: 0 };
      b.conv += t.conversions;
      b.spend += t.spend;
      b.n += 1;
      by.set(w, b);
    }
  const rows = [...by.entries()].filter(([, b]) => b.n > 1 || b.conv > 0).sort((a, b) => b[1].conv - a[1].conv || b[1].spend - a[1].spend).slice(0, 14);
  const max = Math.max(...rows.map(([, b]) => b.conv), 1);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap content-start gap-1.5 overflow-hidden">
        {rows.map(([w, b]) => {
          const k = b.conv / max;
          return (
            <span key={w} title={`${int(b.conv)} conversões em ${b.n} termos${ctx.hideSpend ? "" : ` · ${brlCompact(b.spend)}`}`} className={`rounded-full border px-2.5 py-1 font-medium ${b.conv === 0 ? "border-error-fg/40 text-error-fg" : "border-transparent"}`} style={b.conv ? { fontSize: `${11 + k * 5}px`, background: `color-mix(in srgb, var(--accent) ${12 + k * 40}%, transparent)` } : { fontSize: "11px" }}>
              {w}
              <span className="ml-1 text-[10px] font-normal text-fg-2 tnum">{int(b.conv)}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-auto pt-2 text-[10.5px] text-fg-2">Maior e mais forte: a palavra aparece nos termos que mais convertem. Em vermelho: só gasta.</p>
    </div>
  );
}

// ---- vídeos (retenção) -------------------------------------------------------------------

export function VideoWidget({ ctx, platform }: { ctx: WidgetContext; platform?: PlatformId }) {
  const vids = ctx.ds.creatives.filter((c): c is Creative & { video: NonNullable<Creative["video"]> } => !!c.video && c.video.views > 0 && (!platform || c.platform === platform)).sort((a, b) => b.video.views - a.video.views).slice(0, 4);
  if (!vids.length) return <Empty>Nenhum vídeo com visualizações no período.</Empty>;
  const steps = ["Início", "25%", "50%", "75%", "100%"] as const;
  const colors = ["var(--accent)", "#E9A23B", "#5B8DEF", "#E2557F"];
  const W = 100;
  const pts = (v: Creative["video"] & object) => [1, v.p25 / v.views, v.p50 / v.views, v.p75 / v.views, v.p100 / v.views];
  return (
    <div className="grid min-h-0 flex-1 gap-4 @[560px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex min-h-[140px] flex-col">
        <div className="relative min-h-0 flex-1">
          <svg viewBox={`0 0 ${W} 60`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <line key={g} x1={0} x2={W} y1={60 - g * 60} y2={60 - g * 60} stroke="var(--line)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />
            ))}
            {vids.map((v, i) => (
              <polyline key={v.id} points={pts(v.video).map((p, k) => `${(k / 4) * W},${60 - p * 60}`).join(" ")} fill="none" stroke={colors[i]} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            ))}
          </svg>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-fg-2" aria-hidden>
          {steps.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <p className="mt-1.5 text-[10.5px] text-fg-2">Quantas pessoas que começaram o vídeo chegaram a cada ponto.</p>
      </div>
      <ul className="min-h-0 space-y-2 overflow-y-auto [scrollbar-width:thin]">
        {vids.map((v, i) => (
          <li key={v.id} className="flex items-center gap-2.5">
            <span className="relative w-14 shrink-0 overflow-hidden rounded-[8px]">
              <CreativeImage src={v.imageUrl} video className="aspect-video" fallback={<div className="absolute inset-0" style={{ background: colors[i], opacity: 0.55 }} />} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[12px] font-medium">
                <span className="size-2 shrink-0 rounded-full" style={{ background: colors[i] }} aria-hidden />
                <span className="truncate">{v.name}</span>
              </span>
              <span className="text-[10.5px] text-fg-2 tnum">
                {int(v.video.views)} visualizações{ctx.hideSpend ? "" : ` · ${brl(v.spend / v.video.views, { decimals: true })} por vis.`}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-[13px] font-bold tnum">{pct(v.video.p100 / v.video.views, 0)}</span>
              <span className="text-[10px] text-fg-2">até o fim</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vídeo de um criativo: a curva da retenção em barras (detalhe do criativo). */
export function RetentionBars({ video }: { video: NonNullable<Creative["video"]> }) {
  const steps = [
    ["Início", 1],
    ["25%", video.p25 / video.views],
    ["50%", video.p50 / video.views],
    ["75%", video.p75 / video.views],
    ["100%", video.p100 / video.views],
  ] as const;
  return (
    <div className="flex h-32 items-end gap-2">
      {steps.map(([l, v]) => (
        <div key={l} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[11px] font-semibold tnum">{pct(v, 0)}</span>
          <div className="w-full rounded-t-[6px] bg-accent" style={{ height: `${Math.max(3, v * 100)}%`, opacity: 0.35 + v * 0.65 }} />
          <span className="text-[10.5px] text-fg-2">{l}</span>
        </div>
      ))}
    </div>
  );
}

export { HIDDEN };
