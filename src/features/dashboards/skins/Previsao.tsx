"use client";

// Previsão de KPIs: tendência linear + sazonalidade da semana sobre os dias do
// período, projetada até o fim do mês com faixa de 95%, chance de bater a meta,
// simulador de verba (retorno decrescente) e dias fora do padrão. Dados de exemplo.

import { AlertTriangle, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { MetricId } from "@/features/metrics/definitions";
import type { DayRow } from "@/features/metrics/source";
import {
  chrono,
  dayLabel,
  int,
  label,
  money,
  normCdf,
  Panel,
  pct,
  Stat,
  value,
  type SkinProps,
} from "./shared";
import { SkinGrid } from "./SkinGrid";

type Target = "revenue" | "conversions" | "spend";
/** Elasticidade das conversões à verba (retorno decrescente). */
const ELASTICITY = 0.72;

type Forecast = {
  hist: number[];
  fit: number[];
  future: number[];
  lo: number[];
  hi: number[];
  sd: number;
  anomalies: number[];
};

/** Regressão linear com efeito do dia da semana; resíduo dá a faixa. */
export function forecast(values: number[], horizon: number): Forecast {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const slope =
    xs.reduce((a, x, i) => a + (x - mx) * (values[i] - my), 0) / sxx;
  const trend = (x: number) => my + slope * (x - mx);
  const season = Array.from({ length: 7 }, (_, d) => {
    const r = values
      .map((v, i) => [i, v - trend(i)] as const)
      .filter(([i]) => i % 7 === d);
    return r.length ? r.reduce((a, [, v]) => a + v, 0) / r.length : 0;
  });
  const fit = xs.map((x) => trend(x) + season[x % 7]);
  const res = values.map((v, i) => v - fit[i]);
  const sd = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / Math.max(1, n - 2));
  const future = Array.from({ length: horizon }, (_, h) =>
    Math.max(0, trend(n + h) + season[(n + h) % 7]),
  );
  const band = (h: number) =>
    1.96 * sd * Math.sqrt(1 + 1 / n + (n + h - mx) ** 2 / sxx);
  return {
    hist: values,
    fit,
    future,
    lo: future.map((v, h) => Math.max(0, v - band(h))),
    hi: future.map((v, h) => v + band(h)),
    sd,
    anomalies: res
      .map((r, i) => (Math.abs(r) > 2 * sd ? i : -1))
      .filter((i) => i >= 0),
  };
}

export function PrevisaoSkin({ ctx, grid }: SkinProps) {
  const current = ctx.ds.current;
  const days = useMemo(() => chrono(current), [current]);
  const { budget } = ctx.ds;
  const horizon = Math.max(1, budget.daysInMonth - budget.day);
  const [target, setTarget] = useState<Target>(
    ctx.cur.revenue > 0 ? "revenue" : "conversions",
  );
  const [budgetChange, setBudgetChange] = useState(0);
  const pick = (d: DayRow, t: Target) =>
    t === "revenue" ? d.revenue : t === "spend" ? d.spend : d.conversions;
  const f = useMemo(
    () =>
      forecast(
        days.map((d) => pick(d, target)),
        horizon,
      ),
    [days, horizon, target],
  );
  const fConv = useMemo(
    () =>
      forecast(
        days.map((d) => d.conversions),
        horizon,
      ),
    [days, horizon],
  );
  const fSpend = useMemo(
    () =>
      forecast(
        days.map((d) => d.spend),
        horizon,
      ),
    [days, horizon],
  );

  // mês: o que já foi (proporcional aos dias do mês no período) + o previsto
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const doneConv = sum(days.slice(-budget.day).map((d) => d.conversions));
  const doneSpend = sum(days.slice(-budget.day).map((d) => d.spend));
  const scale = (1 + budgetChange / 100) ** ELASTICITY;
  const projConv = doneConv + sum(fConv.future) * scale;
  const projSpend = doneSpend + sum(fSpend.future) * (1 + budgetChange / 100);
  const projCpa = projSpend / Math.max(1, projConv);
  const goalCpa = ctx.ds.goal;
  // chance de o CPA do mês ficar abaixo da meta (variância somada dos dias que faltam)
  const convSd = fConv.sd * Math.sqrt(horizon) * scale;
  const convNeeded = goalCpa > 0 ? projSpend / goalCpa : 0;
  const chance =
    goalCpa > 0
      ? 1 - normCdf((convNeeded - projConv) / Math.max(1e-9, convSd))
      : null;
  const monthBudget = budget.monthly;

  const fmt = (v: number, t: Target = target) =>
    t === "conversions" ? int(v) : money(ctx, v, true);
  const metricId: MetricId = target;

  return (
    <div className="@container space-y-4">
      <SkinGrid
        skin="previsao"
        ctx={ctx}
        grid={grid}
        nodes={{
          "s-stat0": (
            <Stat
              title={`${label(ctx, "conversions")} previstas no mês`}
              v={int(projConv)}
              sub={`${int(doneConv)} até hoje · faltam ${horizon} dias`}
            />
          ),
          "s-stat1": (
            <Stat
              title={`${label(ctx, "cpa")} previsto`}
              v={ctx.hideSpend ? "•••" : money(ctx, projCpa)}
              sub={
                goalCpa > 0
                  ? `meta ${money(ctx, goalCpa)}`
                  : "sem meta definida"
              }
              tone={goalCpa > 0 ? (projCpa <= goalCpa ? "good" : "bad") : null}
            />
          ),
          "s-stat2": (
            <Stat
              title="Chance de bater a meta"
              v={
                chance == null
                  ? "sem meta"
                  : pct(Math.min(0.99, Math.max(0.01, chance)), 0)
              }
              sub="pela faixa de variação dos dias"
              tone={chance == null ? null : chance >= 0.6 ? "good" : "bad"}
            />
          ),
          "s-stat3": (
            <Stat
              title="Investimento previsto"
              v={money(ctx, projSpend, true)}
              sub={
                monthBudget > 0
                  ? `${pct(projSpend / monthBudget, 0)} da verba do mês`
                  : "sem verba definida"
              }
              tone={
                monthBudget > 0
                  ? projSpend <= monthBudget * 1.02
                    ? "good"
                    : "bad"
                  : null
              }
            />
          ),
          "s-projecao": (
            <Panel
              title="Projeção até o fim do mês"
              aside={
                <div className="flex gap-1 rounded-full border border-line p-0.5 text-[11.5px]">
                  {(["revenue", "conversions", "spend"] as Target[])
                    .filter((t) => t !== "revenue" || ctx.cur.revenue > 0)
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTarget(t)}
                        className={`rounded-full px-2.5 py-1 ${t === target ? "bg-accent text-on-accent" : "text-fg-2"}`}
                      >
                        {label(ctx, t)}
                      </button>
                    ))}
                </div>
              }
            >
              <ForecastChart f={f} />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-fg-2">
                <span>{dayLabel(days.length - 1, ctx.today)}</span>
                <span className="flex flex-wrap gap-3">
                  <span>━ realizado</span>
                  <span>┅ previsto</span>
                  <span>▒ faixa de 95%</span>
                  <span className="text-error-fg">● fora do padrão</span>
                </span>
                <span>fim do mês</span>
              </div>
              <p className="mt-3 text-[12.5px]">
                Fechamento previsto de {label(ctx, metricId).toLowerCase()}:{" "}
                <b className="tnum">
                  {fmt(
                    sum(days.slice(-budget.day).map((d) => pick(d, target))) +
                      sum(f.future),
                  )}
                </b>{" "}
                (entre{" "}
                <span className="tnum">
                  {fmt(
                    sum(days.slice(-budget.day).map((d) => pick(d, target))) +
                      sum(f.lo),
                  )}
                </span>{" "}
                e{" "}
                <span className="tnum">
                  {fmt(
                    sum(days.slice(-budget.day).map((d) => pick(d, target))) +
                      sum(f.hi),
                  )}
                </span>
                ).
              </p>
            </Panel>
          ),
          "s-simulador": (
            <Panel
              title="Simulador de verba"
              aside={<TrendingUp size={15} className="text-accent" />}
            >
              <label
                className="block text-[12px] text-fg-2"
                htmlFor="sim-budget"
              >
                Mudar a verba dos dias que faltam em{" "}
                <b className="text-fg tnum">
                  {budgetChange > 0 ? "+" : ""}
                  {budgetChange}%
                </b>
              </label>
              <input
                id="sim-budget"
                type="range"
                min={-50}
                max={100}
                step={5}
                value={budgetChange}
                onChange={(e) => setBudgetChange(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--accent)]"
              />
              <dl className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
                <div>
                  <dt className="text-fg-2">{label(ctx, "conversions")}</dt>
                  <dd className="text-[18px] font-bold tnum">
                    {int(projConv)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-2">{label(ctx, "cpa")}</dt>
                  <dd className="text-[18px] font-bold tnum">
                    {ctx.hideSpend ? "•••" : money(ctx, projCpa)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-2">Custo da próxima</dt>
                  <dd className="text-[18px] font-bold tnum">
                    {ctx.hideSpend
                      ? "•••"
                      : money(
                          ctx,
                          (sum(fSpend.future) * (1 + budgetChange / 100)) /
                            (ELASTICITY *
                              Math.max(1, sum(fConv.future) * scale)),
                        )}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-fg-2">
                Cada real a mais rende menos que o anterior (elasticidade{" "}
                {String(ELASTICITY).replace(".", ",")}). Use para decidir se
                vale acelerar ou segurar.
              </p>
            </Panel>
          ),
          "s-anomalias": (
            <Panel
              title="Dias fora do padrão"
              aside={<AlertTriangle size={15} className="text-error-fg" />}
            >
              {f.anomalies.length === 0 ? (
                <p className="text-[12px] text-fg-2">
                  Nenhum dia saiu da faixa esperada em{" "}
                  {label(ctx, metricId).toLowerCase()}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {f.anomalies.slice(-5).map((i) => {
                    const diff = f.hist[i] - f.fit[i];
                    return (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 text-[12px]"
                      >
                        <span>{dayLabel(days[i].ago, ctx.today)}</span>
                        <span className="text-fg-2 tnum">
                          esperado {fmt(f.fit[i])}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] tnum ${diff > 0 ? "bg-accent-soft" : "bg-error-soft text-error-fg"}`}
                        >
                          {diff > 0 ? "acima" : "abaixo"}{" "}
                          {pct(Math.abs(diff) / Math.max(1e-9, f.fit[i]), 0)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-fg-2">
                Mais de 2 desvios do esperado para o dia da semana. Vale olhar o
                que mudou nesses dias.
              </p>
              <p className="mt-3 text-[12px]">
                Período: <b className="tnum">{value(ctx, metricId)}</b> em{" "}
                {label(ctx, metricId).toLowerCase()}.
              </p>
            </Panel>
          ),
        }}
      />
    </div>
  );
}

function ForecastChart({ f }: { f: Forecast }) {
  const w = 800;
  const h = 220;
  const all = [...f.hist, ...f.hi];
  const max = Math.max(...all, 1) * 1.05;
  const n = f.hist.length + f.future.length;
  const x = (i: number) => (i / Math.max(1, n - 1)) * w;
  const y = (v: number) => h - (v / max) * h;
  const line = (vals: number[], off = 0) =>
    vals
      .map(
        (v, i) => `${i ? "L" : "M"}${x(i + off).toFixed(1)},${y(v).toFixed(1)}`,
      )
      .join("");
  const off = f.hist.length - 1;
  const last = f.hist[f.hist.length - 1];
  const band = `${line([last, ...f.hi], off)} ${[...f.lo]
    .reverse()
    .map((v, i) => `L${x(n - 1 - i).toFixed(1)},${y(v).toFixed(1)}`)
    .join("")} L${x(off)},${y(last)} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-[220px] w-full"
      aria-label="Realizado e previsão com faixa de confiança"
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="0"
          x2={w}
          y1={h * g}
          y2={h * g}
          stroke="var(--line)"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <rect
        x={x(off)}
        y="0"
        width={w - x(off)}
        height={h}
        fill="var(--accent-soft)"
        opacity="0.25"
      />
      <path d={band} fill="var(--accent)" opacity="0.15" />
      <path
        d={line(f.fit)}
        fill="none"
        stroke="var(--fg-2)"
        strokeWidth="1"
        opacity="0.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={line(f.hist)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={line([last, ...f.future], off)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeDasharray="6 5"
        vectorEffect="non-scaling-stroke"
      />
      {f.anomalies.map((i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(f.hist[i])}
          r="4"
          fill="var(--error-fg)"
        />
      ))}
    </svg>
  );
}
