"use client";

// Comparativo de criativos: o ranking do período (custo por resultado, CTR ou resultado), o
// duelo entre dois criativos com a confiança estatística da diferença de CTR e o alerta de
// fadiga (frequência alta). Os números são os do período, da última sincronização: nada de
// "ao vivo" (as contas sincronizam algumas vezes por dia).

import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
import { Clock, Flame, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import {
  decimal,
  int,
  label,
  money,
  normCdf,
  Panel,
  pct,
  platformName,
  SERIES,
  Stat,
  type SkinProps,
} from "./shared";
import { SkinGrid } from "./SkinGrid";
import { CardMetricsButton, cardValue, CreativeDetailModal, useCardPrefs } from "@/features/analytics/creatives/CardMetrics";
import { cardLabel, cardShort, fromDataset, metricsFor, type CardCreative } from "@/features/analytics/creatives/card-metrics";

type Sort = "cpa" | "ctr" | "conv";

/** "atualizado às 14:05" no fuso da conta (sem a hora, nada). */
export function syncedAtLabel(syncedAt: string | undefined, timeZone = "America/Sao_Paulo"): string | null {
  if (!syncedAt) return null;
  const d = new Date(syncedAt);
  if (Number.isNaN(d.getTime())) return null;
  const hm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone }).format(d);
  return `Atualizado em ${day} às ${hm}`;
}

/** Ranking: custo por resultado só com resultado (sem venda, sem custo: vai para o fim, com "—"). */
export function rankCreatives<T extends { spend: number; clicks: number; impressions: number; conversions: number }>(list: readonly T[], sort: Sort): (T & { ctr: number; cpa: number | null })[] {
  const rows = list.map((c) => ({ ...c, ctr: c.clicks / Math.max(1, c.impressions), cpa: c.conversions > 0 ? c.spend / c.conversions : null }));
  return rows.sort((a, b) => {
    if (sort === "ctr") return b.ctr - a.ctr;
    if (sort === "conv") return b.conversions - a.conversions;
    if (a.cpa === null && b.cpa === null) return b.spend - a.spend;
    if (a.cpa === null) return 1;
    if (b.cpa === null) return -1;
    return a.cpa - b.cpa;
  });
}

export function CriativosAoVivoSkin({ ctx, periodLabel, grid, syncedAt, timeZone }: SkinProps) {
  const base = useMemo(
    () => [...ctx.ds.creatives].sort((a, b) => b.spend - a.spend).slice(0, 8),
    [ctx.ds.creatives],
  );
  const [sort, setSort] = useState<Sort>("cpa");
  const ranked = rankCreatives(base, sort);
  const live = ranked;
  const stamp = syncedAtLabel(syncedAt, timeZone);
  // os cards de criativo com as métricas escolhidas (as mesmas contas do resto do dashboard)
  const cardsById = new Map(fromDataset({ creatives: base }, label(ctx, "conversions")).map((c) => [c.id, c]));
  const [detail, setDetail] = useState<string | null>(null);
  const detailCard = detail ? cardsById.get(detail) : undefined;

  const [aId, setA] = useState<string | null>(null);
  const [bId, setB] = useState<string | null>(null);
  const a = live.find((c) => c.id === aId) ?? ranked[0];
  const b = live.find((c) => c.id === bId) ?? ranked[1] ?? ranked[0];

  // teste de duas proporções no CTR (período inteiro: amostra maior)
  const pa = a ? base.find((c) => c.id === a.id)! : null;
  const pb = b ? base.find((c) => c.id === b.id)! : null;
  let confidence = 0;
  if (pa && pb && pa.id !== pb.id) {
    const p1 = pa.clicks / Math.max(1, pa.impressions);
    const p2 = pb.clicks / Math.max(1, pb.impressions);
    const p =
      (pa.clicks + pb.clicks) / Math.max(1, pa.impressions + pb.impressions);
    const se = Math.sqrt(
      p *
        (1 - p) *
        (1 / Math.max(1, pa.impressions) + 1 / Math.max(1, pb.impressions)),
    );
    confidence = Math.min(
      0.99,
      se > 0 ? 2 * normCdf(Math.abs(p1 - p2) / se) - 1 : 0,
    );
  }
  const fatigued = base.filter((c) => c.frequency >= 2.8);
  const total = base.reduce(
    (acc, c) => ({ spend: acc.spend + c.spend, conv: acc.conv + c.conversions, clicks: acc.clicks + c.clicks, imp: acc.imp + c.impressions }),
    { spend: 0, conv: 0, clicks: 0, imp: 0 },
  );

  return (
    <div className="@container space-y-4">
      {detailCard && <CreativeDetailModal c={detailCard} open onClose={() => setDetail(null)} />}
      <div className="flex flex-wrap items-center gap-3">
        {stamp && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-medium text-fg">
            <Clock size={13} aria-hidden /> {stamp}
          </span>
        )}
        <span className="text-[12.5px] text-fg-2">
          {base.length} criativos com mais investimento · {periodLabel.toLowerCase()}
        </span>
      </div>

      <SkinGrid
        skin="criativos-ao-vivo"
        ctx={ctx}
        grid={grid}
        nodes={{
          "s-stat0": (
            <Stat title="Investimento no período" v={money(ctx, total.spend, true)} sub={`${base.length} criativos`} />
          ),
          "s-stat1": (
            <Stat title={`${label(ctx, "conversions")} no período`} v={int(total.conv)} sub="dos criativos da lista" />
          ),
          "s-stat2": (
            <Stat title="CTR dos criativos" v={pct(total.clicks / Math.max(1, total.imp), 2)} sub={`conta: ${pct(ctx.cur.ctr, 2)}`} />
          ),
          "s-stat3": (
            <Stat
              title={label(ctx, "cpa")}
              v={ctx.hideSpend ? "•••" : total.conv > 0 ? money(ctx, total.spend / total.conv) : "—"}
              sub={`conta: ${ctx.cur.conversions > 0 ? money(ctx, ctx.cur.cpa) : "—"}`}
            />
          ),
          "s-ranking": (
            <Panel
              title="Ranking de criativos"
              aside={
                <div className="flex flex-wrap items-center gap-2">
                <CardMetricsButton className="h-8" />
                <div className="flex gap-1 rounded-full border border-line p-0.5 text-[11.5px]">
                  {(["cpa", "ctr", "conv"] as Sort[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSort(s)}
                      className={`rounded-full px-2.5 py-1 ${s === sort ? "bg-accent text-on-accent" : "text-fg-2"}`}
                    >
                      {s === "cpa"
                        ? label(ctx, "cpa")
                        : s === "ctr"
                          ? "CTR"
                          : label(ctx, "conversions")}
                    </button>
                  ))}
                </div>
                </div>
              }
            >
              <ol className="divide-y divide-line">
                {ranked.map((c, i) => {
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 transition-all duration-500"
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${i === 0 ? "bg-accent text-on-accent" : "bg-accent-soft text-fg"}`}
                      >
                        {i === 0 && (sort !== "cpa" || c.cpa !== null) ? <Trophy size={13} /> : i + 1}
                      </span>
                      {/* com dados reais, a imagem do anúncio ao lado do nome (a amostra não tem imagem) */}
                      {c.imageUrl && (
                        <CreativeImage
                          src={c.imageUrl}
                          video={isVideoFormat(c.format)}
                          compact
                          className="size-9 shrink-0 rounded-[8px]"
                          fallback={<span className="block size-full bg-accent-soft" />}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <button type="button" onClick={() => setDetail(c.id)} className="block max-w-full truncate text-left text-[12.5px] font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent" title={`${c.name}: ver todas as métricas`}>
                          {c.name}
                        </button>
                        <span className="block text-[11px] text-fg-2">
                          {c.format} · {platformName(c.platform)}
                        </span>
                      </span>
                      {/* as métricas escolhidas no botão "Métricas" (as mesmas dos cards de criativo do dashboard) */}
                      {cardsById.get(c.id) && <ChosenCells c={cardsById.get(c.id)!} />}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[11px] text-fg-2">
                Números do período. Sem {label(ctx, "conversions").toLowerCase()}, o custo fica em branco (—) e o criativo vai para o fim do ranking por custo.
              </p>
            </Panel>
          ),
          "s-duelo": (
            <Panel title="Duelo de criativos">
              <div className="grid grid-cols-2 gap-2">
                {[
                  [a, setA],
                  [b, setB],
                ].map(([c, set], k) => (
                  <select
                    key={k}
                    value={(c as typeof a)?.id}
                    onChange={(e) =>
                      (set as (v: string) => void)(e.target.value)
                    }
                    className="h-9 min-w-0 rounded-control border border-line bg-bg px-2 text-[12px]"
                    aria-label={k === 0 ? "Criativo A" : "Criativo B"}
                  >
                    {live.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              {pa && pb && (
                <div className="mt-4 space-y-3">
                  {[
                    {
                      l: "CTR",
                      va: pa.clicks / Math.max(1, pa.impressions),
                      vb: pb.clicks / Math.max(1, pb.impressions),
                      f: (v: number) => pct(v, 2),
                      up: true,
                    },
                    {
                      l: "CPC",
                      va: pa.spend / Math.max(1, pa.clicks),
                      vb: pb.spend / Math.max(1, pb.clicks),
                      f: (v: number) => money(ctx, v),
                      up: false,
                    },
                    {
                      l: label(ctx, "cpa"),
                      va: pa.conversions > 0 ? pa.spend / pa.conversions : Number.NaN,
                      vb: pb.conversions > 0 ? pb.spend / pb.conversions : Number.NaN,
                      f: (v: number) => (Number.isFinite(v) ? money(ctx, v) : "—"),
                      up: false,
                    },
                    {
                      l: "Taxa de conversão",
                      va: pa.conversions / Math.max(1, pa.clicks),
                      vb: pb.conversions / Math.max(1, pb.clicks),
                      f: (v: number) => pct(v, 1),
                      up: true,
                    },
                    {
                      l: "Frequência",
                      va: pa.frequency,
                      vb: pb.frequency,
                      f: (v: number) => decimal(v, 1),
                      up: false,
                    },
                  ].map((r) => {
                    const va = Number.isFinite(r.va) ? r.va : 0;
                    const vb = Number.isFinite(r.vb) ? r.vb : 0;
                    const max = Math.max(va, vb, 1e-9);
                    // custo sem resultado não ganha
                    const aWins = !Number.isFinite(r.va) ? false : !Number.isFinite(r.vb) ? true : r.up ? r.va >= r.vb : r.va <= r.vb;
                    return (
                      <div key={r.l}>
                        <p className="mb-1 flex justify-between text-[11px] text-fg-2">
                          <span
                            className={aWins ? "font-semibold text-fg" : ""}
                          >
                            {r.f(r.va)}
                          </span>
                          <span>{r.l}</span>
                          <span
                            className={!aWins ? "font-semibold text-fg" : ""}
                          >
                            {r.f(r.vb)}
                          </span>
                        </p>
                        <div className="flex gap-1">
                          <div className="flex h-2 flex-1 justify-end rounded-full bg-accent-soft/50">
                            <div
                              className="rounded-full"
                              style={{
                                width: `${(va / max) * 100}%`,
                                background: SERIES[0],
                              }}
                            />
                          </div>
                          <div className="flex h-2 flex-1 rounded-full bg-accent-soft/50">
                            <div
                              className="rounded-full"
                              style={{
                                width: `${(vb / max) * 100}%`,
                                background: SERIES[1],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="rounded-[10px] bg-accent-soft px-3 py-2 text-[12px]">
                    {pa.id === pb.id
                      ? "Escolha dois criativos diferentes."
                      : confidence >= 0.95
                        ? `${(pa.clicks / pa.impressions >= pb.clicks / pb.impressions ? pa : pb).name} tem CTR maior com ${pct(confidence, 0)} de confiança. Dá para concentrar verba nele.`
                        : `Diferença de CTR com ${pct(confidence, 0)} de confiança: ainda não dá para cravar um vencedor. Deixe rodar mais.`}
                  </p>
                </div>
              )}
            </Panel>
          ),
          "s-fadiga": (
            <Panel
              title="Fadiga de criativo"
              aside={<Flame size={15} className="text-error-fg" />}
            >
              {fatigued.length === 0 ? (
                <p className="text-[12px] text-fg-2">
                  Nenhum criativo com frequência acima de 2,8.
                </p>
              ) : (
                <ul className="space-y-2">
                  {fatigued.slice(0, 4).map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="min-w-0 truncate">{c.name}</span>
                      <span className="shrink-0 rounded-full bg-error-soft px-2 py-0.5 text-[11px] text-error-fg tnum">
                        freq. {decimal(c.frequency, 1)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-fg-2">
                Frequência alta costuma vir antes da queda de CTR. Hora de
                trocar a peça ou abrir público.
              </p>
            </Panel>
          ),
        }}
      />
    </div>
  );
}

/** As métricas escolhidas, em colunas na linha do ranking ("—" sem dado; as de vídeo só no vídeo). */
function ChosenCells({ c }: { c: CardCreative }) {
  const prefs = useCardPrefs();
  // no Padrão VYZ (sem a escolha), as colunas de antes: CTR, custo por resultado e resultado
  const list = metricsFor(prefs?.ids ?? ["linkCtr", "costPerResult", "result"], c);
  return (
    <span className="flex shrink-0 items-start gap-3" data-card-metricas={list.map((m) => m.id).join(",")}>
      {list.map((m) => (
        <span key={m.id} className="hidden w-[78px] text-right @[480px]:block">
          <span className="block truncate text-[10px] text-fg-2" title={`${cardLabel(m, c)}: ${m.help}`}>
            {cardShort(m, c)}
          </span>
          <span className="block text-[12px] font-semibold tnum">{cardValue(m, c, prefs?.hideSpend)}</span>
        </span>
      ))}
    </span>
  );
}
