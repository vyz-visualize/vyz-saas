"use client";

import { AreaSparkline, LineSparkline } from "@/components/bklit/charts/sparkline";
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
 * Sparkline com área suave (ou só a linha), desenhada pela Bklit UI. Os dias em
 * maturação saem tracejados (as conversões ainda chegam): são um segundo traço,
 * na mesma escala, colado no fim do primeiro. Decorativa: o número vem ao lado.
 */
export function TrendSpark({ values, maturing = 0, tone = "neutral", line = false, className = "" }: TrendSparkProps) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length < 2) return <div className={className} aria-hidden />;
  const n = values.length;
  const cut = Math.max(2, n - Math.max(0, maturing));
  const row = (v: number | null) => ({ v: v != null && Number.isFinite(v) ? v : null });
  const settled = values.slice(0, cut).map(row);
  const late = cut < n ? values.slice(cut - 1).map(row) : [];
  // os dois traços dividem a mesma escala para emendar sem degrau
  const domain: [number, number] = [Math.min(...finite), Math.max(...finite)];
  const color = STROKE[tone];
  return (
    <FitChart className={className} minHeight={28}>
      {({ width: W, height: H }) => {
        const settledW = late.length ? Math.max(8, ((cut - 1) / Math.max(1, n - 1)) * W) : W;
        const Settled = line ? LineSparkline : AreaSparkline;
        return (
          <div className="flex h-full items-stretch" aria-hidden data-chart-theme>
            <Settled
              data={settled}
              dataKey="v"
              width={settledW}
              height={H}
              color={color}
              strokeWidth={1.75}
              yDomain={domain}
              padding={{ top: 3, bottom: 3, left: 2, right: late.length ? 0 : 4 }}
              endDot={!line && late.length === 0}
              interactive={false}
              animationDuration={700}
              {...(line ? {} : { fill: "gradient" as const, fillOpacity: 0.18 })}
            />
            {late.length > 1 && (
              <span className="[&_path]:[stroke-dasharray:2_3] opacity-70">
                <LineSparkline data={late} dataKey="v" width={Math.max(6, W - settledW)} height={H} color={color} strokeWidth={1.5} yDomain={domain} padding={{ top: 3, bottom: 3, left: 0, right: 4 }} endDot={!line} interactive={false} animationDuration={700} />
              </span>
            )}
          </div>
        );
      }}
    </FitChart>
  );
}
