"use client";

// Criativos ao vivo: ranking que se atualiza sozinho (hoje, hora a hora), duelo
// entre dois criativos com a confiança estatística da diferença de CTR e o
// alerta de fadiga (frequência alta com CTR caindo). Dados de exemplo.

import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
import { ArrowDown, ArrowUp, Flame, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  decimal,
  int,
  label,
  money,
  noise,
  normCdf,
  Panel,
  pct,
  platformName,
  SERIES,
  Stat,
  type SkinProps,
} from "./shared";
import { SkinGrid } from "./SkinGrid";

type Sort = "cpa" | "ctr" | "conv";
const TICK_MS = 4000;

export function CriativosAoVivoSkin({ ctx, periodLabel, grid }: SkinProps) {
  const base = useMemo(
    () => [...ctx.ds.creatives].sort((a, b) => b.spend - a.spend).slice(0, 8),
    [ctx.ds.creatives],
  );
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // "hoje": cerca de 1/30 do período, crescendo a cada atualização
  const live = useMemo(
    () =>
      base.map((c, i) => {
        const share = 1 / 30;
        const grow = (k: number) =>
          Array.from({ length: tick }, (_, t) => noise(i, t, k)).reduce(
            (a, b) => a + b,
            0,
          );
        const impressions = Math.round(
          c.impressions * share * 0.55 + grow(1) * c.impressions * share * 0.04,
        );
        const ctrNow =
          (c.clicks / Math.max(1, c.impressions)) *
          (0.9 + noise(i, tick, 2) * 0.2);
        const clicks = Math.round(impressions * ctrNow);
        const convRate = c.conversions / Math.max(1, c.clicks);
        const conversions = Math.round(clicks * convRate + grow(3) * 0.3);
        const spend = c.spend * share * 0.55 + grow(4) * c.spend * share * 0.04;
        const hours = Array.from(
          { length: 12 },
          (_, h) => ctrNow * (0.8 + noise(i, h, tick > h ? 1 : 0) * 0.4),
        );
        return {
          ...c,
          impressions,
          clicks,
          conversions,
          spend,
          ctr: clicks / Math.max(1, impressions),
          cpa: spend / Math.max(1, conversions),
          hours,
        };
      }),
    [base, tick],
  );
  const [sort, setSort] = useState<Sort>("cpa");
  const ranked = [...live].sort((a, b) =>
    sort === "cpa"
      ? a.cpa - b.cpa
      : sort === "ctr"
        ? b.ctr - a.ctr
        : b.conversions - a.conversions,
  );
  const prevRank = useMemo(
    () =>
      new Map(
        [...live]
          .sort(
            (a, b) => a.cpa - b.cpa + (noise(a.tone, tick) - 0.5) * a.cpa * 0.3,
          )
          .map((c, i) => [c.id, i]),
      ),
    [live, tick],
  );

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
  const today = live.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      clicks: acc.clicks + c.clicks,
      imp: acc.imp + c.impressions,
    }),
    { spend: 0, conv: 0, clicks: 0, imp: 0 },
  );

  return (
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 rounded-full bg-error-soft px-3 py-1 text-[12px] font-semibold text-error-fg">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-current" />
          </span>
          Ao vivo
        </span>
        <span className="text-[12.5px] text-fg-2">
          Hoje, atualizando a cada {TICK_MS / 1000} s · {tick} atualizações ·
          comparação com {periodLabel.toLowerCase()}
        </span>
      </div>

      <SkinGrid
        skin="criativos-ao-vivo"
        ctx={ctx}
        grid={grid}
        nodes={{
          "s-stat0": (
            <Stat
              title="Investimento hoje"
              v={money(ctx, today.spend, true)}
              sub={`${base.length} criativos rodando`}
            />
          ),
          "s-stat1": (
            <Stat
              title={`${label(ctx, "conversions")} hoje`}
              v={int(today.conv)}
              sub="desde 0h"
            />
          ),
          "s-stat2": (
            <Stat
              title="CTR hoje"
              v={pct(today.clicks / Math.max(1, today.imp), 2)}
              sub={`período: ${pct(ctx.cur.ctr, 2)}`}
              tone={
                today.clicks / Math.max(1, today.imp) >= ctx.cur.ctr
                  ? "good"
                  : "bad"
              }
            />
          ),
          "s-stat3": (
            <Stat
              title={`${label(ctx, "cpa")} hoje`}
              v={
                ctx.hideSpend
                  ? "•••"
                  : money(ctx, today.spend / Math.max(1, today.conv))
              }
              sub={`período: ${money(ctx, ctx.cur.cpa)}`}
              tone={
                today.spend / Math.max(1, today.conv) <= ctx.cur.cpa
                  ? "good"
                  : "bad"
              }
            />
          ),
          "s-ranking": (
            <Panel
              title="Ranking de criativos"
              aside={
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
              }
            >
              <ol className="divide-y divide-line">
                {ranked.map((c, i) => {
                  const was = prevRank.get(c.id) ?? i;
                  const moved = was - i;
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 transition-all duration-500"
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${i === 0 ? "bg-accent text-on-accent" : "bg-accent-soft text-fg"}`}
                      >
                        {i === 0 ? <Trophy size={13} /> : i + 1}
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
                        <span className="block truncate text-[12.5px] font-semibold">
                          {c.name}
                        </span>
                        <span className="block text-[11px] text-fg-2">
                          {c.format} · {platformName(c.platform)}
                        </span>
                      </span>
                      <HourBars values={c.hours} />
                      <span className="w-[74px] text-right text-[12px] tnum">
                        {pct(c.ctr, 2)}
                      </span>
                      <span className="hidden w-[84px] text-right text-[12px] tnum @[560px]:block">
                        {ctx.hideSpend ? "•••" : money(ctx, c.cpa)}
                      </span>
                      <span className="w-[40px] text-right text-[12px] font-semibold tnum">
                        {int(c.conversions)}
                      </span>
                      <span
                        className={`flex w-[30px] items-center justify-end text-[11px] ${moved > 0 ? "text-accent" : moved < 0 ? "text-error-fg" : "text-fg-2"}`}
                      >
                        {moved > 0 ? (
                          <ArrowUp size={12} />
                        ) : moved < 0 ? (
                          <ArrowDown size={12} />
                        ) : (
                          "·"
                        )}
                        {moved !== 0 ? Math.abs(moved) : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[11px] text-fg-2">
                Barras: CTR por hora nas últimas 12 horas. Setas: posição em
                relação à atualização anterior.
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
                      va: pa.spend / Math.max(1, pa.conversions),
                      vb: pb.spend / Math.max(1, pb.conversions),
                      f: (v: number) => money(ctx, v),
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
                    const max = Math.max(r.va, r.vb, 1e-9);
                    const aWins = r.up ? r.va >= r.vb : r.va <= r.vb;
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
                                width: `${(r.va / max) * 100}%`,
                                background: SERIES[0],
                              }}
                            />
                          </div>
                          <div className="flex h-2 flex-1 rounded-full bg-accent-soft/50">
                            <div
                              className="rounded-full"
                              style={{
                                width: `${(r.vb / max) * 100}%`,
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

function HourBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1e-9);
  return (
    <span
      className="hidden h-6 w-[72px] items-end gap-[2px] @[700px]:flex"
      aria-hidden
    >
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px] transition-all duration-500"
          style={{
            height: `${(v / max) * 100}%`,
            background:
              i === values.length - 1
                ? "var(--accent)"
                : "color-mix(in srgb, var(--accent) 45%, transparent)",
          }}
        />
      ))}
    </span>
  );
}
