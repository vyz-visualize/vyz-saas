"use client";

import { FitChart } from "./FitChart";

type TrendSparkProps = {
  /** Série diária; null = dia sem dado (a linha pula). */
  values: (number | null)[];
  /** Quantos pontos do fim estão em maturação (tracejados). */
  maturing?: number;
  /** "good"/"bad" colorem a linha pelo sentido da métrica; "neutral" fica no verde da marca. */
  tone?: "good" | "bad" | "neutral";
  /** Só a linha: sem a área preenchida e sem o ponto do último dia. */
  line?: boolean;
  className?: string;
};

const STROKE = { good: "var(--accent)", bad: "var(--error-fg)", neutral: "var(--accent)" };

/**
 * Sparkline com área suave (ou só a linha), em px reais. Os dias em maturação saem
 * tracejados (as conversões ainda chegam). Decorativa: o número vem ao lado.
 */
export function TrendSpark({ values, maturing = 0, tone = "neutral", line = false, className = "" }: TrendSparkProps) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length < 2) return <div className={className} aria-hidden />;
  return (
    <FitChart className={className} minHeight={28}>
      {({ width: W, height: H }) => {
        const min = Math.min(...finite);
        const max = Math.max(...finite);
        const p = 2;
        const n = values.length;
        const x = (i: number) => p + (i / Math.max(1, n - 1)) * (W - 2 * p);
        const y = (v: number) => p + (1 - (v - min) / (max - min || 1)) * (H - 2 * p);
        const cut = n - maturing;
        const seg = (from: number, to: number) => {
          let d = "";
          for (let i = from; i < to; i++) {
            const v = values[i];
            if (v == null) continue;
            d += `${d && values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          }
          return d;
        };
        const settled = seg(0, cut);
        const late = maturing ? seg(Math.max(0, cut - 1), n) : "";
        const firstIdx = values.findIndex((v) => v != null);
        const lastIdx = n - 1 - [...values].reverse().findIndex((v) => v != null);
        const area = settled ? `${settled}L${x(Math.min(cut, n) - 1).toFixed(1)},${H}L${x(firstIdx).toFixed(1)},${H}Z` : "";
        const color = STROKE[tone];
        return (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" aria-hidden>
            {!line && area && <path d={area} fill={color} opacity="0.1" />}
            <path d={settled} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
            {late && <path d={late} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.7" />}
            {!line && values[lastIdx] != null && <circle cx={x(lastIdx)} cy={y(values[lastIdx]!)} r="2.5" fill={color} />}
          </svg>
        );
      }}
    </FitChart>
  );
}
