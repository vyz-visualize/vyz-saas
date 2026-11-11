"use client";

// MMM (marketing mix modeling): receita de cada dia separada em base (o que
// viria sem mídia) e a parte de cada canal, com efeito residual (adstock) e
// saturação (curva de Hill). Daí saem o ROI e o ROI marginal por canal e o
// otimizador que redistribui a mesma verba. Modelo estimado sobre dados de exemplo.

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import {
  chrono,
  decimal,
  int,
  label,
  money,
  noise,
  Panel,
  pct,
  platformName,
  SERIES,
  Stat,
  type SkinProps,
} from "./shared";
import { SkinGrid } from "./SkinGrid";

type Channel = {
  id: PlatformId;
  color: string;
  decay: number;
  half: number;
  beta: number;
  spendDay: number;
  contrib: number[];
  spend: number;
  revenue: number;
};

const adstock = (xs: number[], decay: number) =>
  xs.reduce<number[]>(
    (acc, x, i) => [...acc, x + (i ? acc[i - 1] * decay : 0)],
    [],
  );
const hill = (x: number, half: number, shape = 1) =>
  x ** shape / (x ** shape + half ** shape);

export function MmmSkin({ ctx, grid }: SkinProps) {
  const current = ctx.ds.current;
  const days = useMemo(() => chrono(current), [current]);
  const kpi = ctx.cur.revenue > 0 ? "revenue" : "conversions";
  const outcome = useMemo(
    () => days.map((d) => (kpi === "revenue" ? d.revenue : d.conversions)),
    [days, kpi],
  );
  const total = outcome.reduce((a, b) => a + b, 0);

  const model = useMemo(() => {
    const ids = ctx.ds.adPlatforms;
    // base: 22–35% do resultado (marca, orgânico, recorrência)
    const baseShare = 0.22 + noise(ids.length, total) * 0.13;
    // parte de cada canal: atribuída pela plataforma, ajustada pelo efeito residual e pela saturação
    const raw = ids.map((id, k) => {
      const spend = days.map((d) => d.byPlatform[id]?.spend ?? 0);
      const decay = 0.25 + noise(k, 7) * 0.45;
      const ad = adstock(spend, decay);
      const avg = ad.reduce((a, b) => a + b, 0) / Math.max(1, ad.length);
      const half = avg * (0.8 + noise(k, 3) * 1.1);
      const resp = ad.map((x) => hill(x, half || 1));
      const conv = days.reduce((a, d) => a + (d.byPlatform[id]?.conv ?? 0), 0);
      return {
        id,
        decay,
        half,
        resp,
        spend,
        weight: conv * (0.7 + noise(k, 11) * 0.6),
      };
    });
    const wsum = raw.reduce((a, r) => a + r.weight, 0) || 1;
    const channels: Channel[] = raw.map((r, k) => {
      const target = total * (1 - baseShare) * (r.weight / wsum);
      const rsum = r.resp.reduce((a, b) => a + b, 0) || 1;
      const beta = target / rsum; // resultado por dia na saturação total
      const spendSum = r.spend.reduce((a, b) => a + b, 0);
      return {
        id: r.id,
        color: SERIES[(k + 1) % SERIES.length],
        decay: r.decay,
        half: r.half,
        beta,
        spendDay: spendSum / Math.max(1, days.length),
        contrib: r.resp.map((x) => x * beta),
        spend: spendSum,
        revenue: target,
      };
    });
    const media = days.map((_, i) =>
      channels.reduce((a, c) => a + c.contrib[i], 0),
    );
    const base = outcome.map((v, i) => Math.max(0, v - media[i]));
    return { channels, base, baseShare };
  }, [ctx.ds.adPlatforms, days, outcome, total]);

  // resposta diária no regime estável (adstock estável = gasto ÷ (1 − decay))
  const respond = (c: Channel, spendDay: number) =>
    c.beta * hill(spendDay / (1 - c.decay), c.half);
  const marginal = (c: Channel, s: number) =>
    (respond(c, s * 1.01 + 1) - respond(c, s)) / (s * 0.01 + 1);

  // otimizador: mesma verba diária, passos de 1% para o canal com maior retorno marginal
  const optimal = useMemo(() => {
    const totalDay = model.channels.reduce((a, c) => a + c.spendDay, 0);
    const alloc = model.channels.map((c) => c.spendDay * 0.4);
    let left = totalDay - alloc.reduce((a, b) => a + b, 0);
    const step = totalDay / 200;
    while (left > step / 2) {
      let best = 0;
      let bestGain = -Infinity;
      model.channels.forEach((c, k) => {
        const g = respond(c, alloc[k] + step) - respond(c, alloc[k]);
        if (g > bestGain) {
          bestGain = g;
          best = k;
        }
      });
      alloc[best] += step;
      left -= step;
    }
    const now = model.channels.reduce((a, c) => a + respond(c, c.spendDay), 0);
    const next = model.channels.reduce(
      (a, c, k) => a + respond(c, alloc[k]),
      0,
    );
    return {
      alloc,
      gain: next / Math.max(1e-9, now) - 1,
      extra: (next - now) * 30,
    };
  }, [model]);

  const [focus, setFocus] = useState<PlatformId | null>(null);
  const fmtOut = (v: number) =>
    kpi === "revenue" ? money(ctx, v, true) : int(v);
  const mediaShare = 1 - model.baseShare;

  return (
    <div className="@container space-y-4">
      <SkinGrid
        skin="mmm"
        ctx={ctx}
        grid={grid}
        nodes={{
          "s-stat0": (
            <Stat
              title={`${label(ctx, kpi)} vinda da mídia`}
              v={pct(mediaShare, 0)}
              sub={`base sem mídia: ${pct(model.baseShare, 0)}`}
            />
          ),
          "s-stat1": (
            <Stat
              title="Melhor ROI"
              v={(() => {
                const c = [...model.channels].sort(
                  (a, b) =>
                    b.revenue / Math.max(1, b.spend) -
                    a.revenue / Math.max(1, a.spend),
                )[0];
                return c ? platformName(c.id) : "sem canal";
              })()}
              sub="resultado incremental por real"
            />
          ),
          "s-stat2": (
            <Stat
              title="Ganho com a mesma verba"
              v={`+${pct(Math.max(0, optimal.gain), 1)}`}
              sub={`≈ ${fmtOut(Math.max(0, optimal.extra))} a mais em 30 dias`}
              tone="good"
            />
          ),
          "s-stat3": (
            <Stat
              title="Canais no modelo"
              v={String(model.channels.length)}
              sub={`${days.length} dias de histórico`}
            />
          ),
          "s-decomposicao": (
            <Panel
              fill
              title={`Decomposição de ${label(ctx, kpi).toLowerCase()} por dia`}
              aside={
                <Legend
                  channels={model.channels}
                  focus={focus}
                  onFocus={setFocus}
                />
              }
            >
              <Stacked
                base={model.base}
                channels={model.channels}
                focus={focus}
              />
              <p className="mt-2 shrink-0 text-[11px] text-fg-2">
                Base: o que viria sem mídia (marca, orgânico, recorrência). Cada
                faixa: o resultado incremental do canal, com o efeito que fica
                dos dias anteriores.
              </p>
            </Panel>
          ),
          "s-curvas": (
            <Panel fill title="Curvas de resposta">
              <Curves
                channels={model.channels}
                respond={respond}
                focus={focus}
              />
              <p className="mt-2 shrink-0 text-[11px] text-fg-2">
                Resultado por dia conforme o investimento diário. O ponto é onde
                cada canal está hoje: perto do platô, cada real a mais rende
                pouco.
              </p>
            </Panel>
          ),
          "s-tabela": (
            <Panel
              title="Contribuição, ROI e redistribuição sugerida"
              aside={<Sparkles size={15} className="text-accent" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-[11px] text-fg-2">
                    <tr>
                      <th className="pb-2 font-medium">Canal</th>
                      <th className="pb-2 text-right font-medium">
                        Contribuição
                      </th>
                      <th className="pb-2 text-right font-medium">ROI</th>
                      <th className="pb-2 text-right font-medium">
                        ROI marginal
                      </th>
                      <th className="pb-2 text-right font-medium">
                        Verba/dia hoje → sugerida
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {model.channels.map((c, k) => {
                      const diff =
                        optimal.alloc[k] / Math.max(1e-9, c.spendDay) - 1;
                      return (
                        <tr key={c.id}>
                          <td className="py-2">
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ background: c.color }}
                              />
                              {platformName(c.id)}
                            </span>
                          </td>
                          <td className="py-2 text-right tnum">
                            {pct(c.revenue / Math.max(1, total), 0)}
                          </td>
                          <td className="py-2 text-right tnum">
                            {ctx.hideSpend
                              ? "•••"
                              : kpi === "revenue"
                                ? decimal(c.revenue / Math.max(1, c.spend), 2)
                                : money(ctx, c.spend / Math.max(1, c.revenue))}
                          </td>
                          <td className="py-2 text-right tnum">
                            {ctx.hideSpend
                              ? "•••"
                              : kpi === "revenue"
                                ? decimal(marginal(c, c.spendDay), 2)
                                : money(
                                    ctx,
                                    1 / Math.max(1e-9, marginal(c, c.spendDay)),
                                  )}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap tnum">
                            {money(ctx, c.spendDay, true)} →{" "}
                            <b>{money(ctx, optimal.alloc[k], true)}</b>{" "}
                            <span
                              className={
                                diff >= 0 ? "text-accent" : "text-error-fg"
                              }
                            >
                              ({diff >= 0 ? "+" : ""}
                              {pct(diff, 0)})
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-fg-2">
                {kpi === "revenue"
                  ? "ROI: receita incremental por real investido."
                  : `ROI em ${label(ctx, "cpa")}: custo de cada resultado incremental.`}{" "}
                A sugestão mantém a verba total e move dinheiro para onde o
                próximo real rende mais. Modelo estimado sobre dados de exemplo.
              </p>
            </Panel>
          ),
        }}
      />
    </div>
  );
}

function Legend({
  channels,
  focus,
  onFocus,
}: {
  channels: Channel[];
  focus: PlatformId | null;
  onFocus: (id: PlatformId | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <span className="flex items-center gap-1.5 text-fg-2">
        <span className="size-2.5 rounded-sm bg-fg-2/30" /> Base
      </span>
      {channels.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onFocus(focus === c.id ? null : c.id)}
          className={`flex items-center gap-1.5 ${focus && focus !== c.id ? "opacity-40" : ""}`}
        >
          <span
            className="size-2.5 rounded-sm"
            style={{ background: c.color }}
          />
          {platformName(c.id)}
        </button>
      ))}
    </div>
  );
}

function Stacked({
  base,
  channels,
  focus,
}: {
  base: number[];
  channels: Channel[];
  focus: PlatformId | null;
}) {
  const w = 800;
  const h = 200;
  const n = base.length;
  const layers = [base, ...channels.map((c) => c.contrib)];
  const tops = base.map((_, i) => layers.reduce((a, l) => a + l[i], 0));
  const max = Math.max(...tops, 1) * 1.05;
  const x = (i: number) => (i / Math.max(1, n - 1)) * w;
  const y = (v: number) => h - (v / max) * h;
  let acc = base.map(() => 0);
  const paths = layers.map((l) => {
    const lo = acc;
    const hi = acc.map((v, i) => v + l[i]);
    acc = hi;
    return `M${hi.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L")} L${lo
      .map((v, i) => [x(i), y(v)] as const)
      .reverse()
      .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
      .join(" L")} Z`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="min-h-[96px] w-full flex-[1_1_200px]"
      aria-label="Resultado por dia separado em base e canais"
    >
      {paths.map((d, k) => (
        <path
          key={k}
          d={d}
          fill={k === 0 ? "var(--fg-2)" : channels[k - 1].color}
          opacity={
            k === 0 ? 0.22 : focus && channels[k - 1].id !== focus ? 0.25 : 0.9
          }
        />
      ))}
    </svg>
  );
}

function Curves({
  channels,
  respond,
  focus,
}: {
  channels: Channel[];
  respond: (c: Channel, s: number) => number;
  focus: PlatformId | null;
}) {
  const w = 400;
  const h = 200;
  const maxS = Math.max(...channels.map((c) => c.spendDay), 1) * 3;
  const maxR = Math.max(...channels.map((c) => respond(c, maxS)), 1) * 1.1;
  const x = (s: number) => (s / maxS) * w;
  const y = (r: number) => h - (r / maxR) * h;
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 22}`}
      className="h-auto min-h-[96px] w-full flex-[1_1_auto]"
      aria-label="Curvas de resposta por canal"
    >
      <line x1="0" x2={w} y1={h} y2={h} stroke="var(--line)" />
      {channels.map((c) => {
        const pts = Array.from({ length: 41 }, (_, i) => (i / 40) * maxS);
        const d = pts
          .map(
            (s, i) =>
              `${i ? "L" : "M"}${x(s).toFixed(1)},${y(respond(c, s)).toFixed(1)}`,
          )
          .join("");
        const dim = focus && focus !== c.id;
        return (
          <g key={c.id} opacity={dim ? 0.25 : 1}>
            <path d={d} fill="none" stroke={c.color} strokeWidth="2.2" />
            <circle
              cx={x(c.spendDay)}
              cy={y(respond(c, c.spendDay))}
              r="5"
              fill="var(--card)"
              stroke={c.color}
              strokeWidth="2.5"
            />
          </g>
        );
      })}
      <text x={w} y={h + 14} textAnchor="end" fontSize="10" fill="var(--fg-2)">
        investimento por dia →
      </text>
    </svg>
  );
}
