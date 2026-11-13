"use client";

// Medidores do visual Fachada, desenhados em SVG no tamanho que o bloco tiver: o arco
// (uma parte do todo), as cápsulas (o ritmo por dia), a pista (quanto da verba já foi) e
// o mostrador (o custo contra o alvo). Cada um mostra uma razão só, com o número escrito
// no meio: a cor acompanha, nunca carrega o valor sozinha.

import { FitChart } from "@/components/charts/FitChart";

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
/** Arco de `from` a `to` graus (0 = direita, sentido horário na tela). */
function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

const TRACK = "color-mix(in srgb, var(--fg) 11%, transparent)";
const FILL = "var(--accent)";

type Center = { label: string; value: string };

/** Rótulo pequeno em cima e o número embaixo, centralizados em (x, y). */
function CenterText({ x, y, label, value, size }: Center & { x: number; y: number; size: number }) {
  return (
    <>
      <text x={x} y={y - size * 0.72} textAnchor="middle" fontSize={Math.max(10, size * 0.5)} fill="var(--fg-2)">
        {label}
      </text>
      <text x={x} y={y + size * 0.36} textAnchor="middle" fontSize={size} fontWeight={500} fill="var(--fg)" style={{ letterSpacing: "-0.02em" }}>
        {value}
      </text>
    </>
  );
}

// ---- arco ------------------------------------------------------------------------------

export type ArcPart = { value: number; color: string };
type ArcMeterProps = Center & {
  /** As partes, na ordem em que entram no arco. Uma só: medidor (a parte contra o todo). */
  parts: ArcPart[];
  /** O todo. Sem isso, a soma das partes (o arco fecha). */
  total?: number;
  summary: string;
  className?: string;
};

/** Meia-lua: as partes de um todo (com um respiro entre elas) ou uma parte contra o todo. */
export function ArcMeter({ parts, total, label, value, summary, className = "" }: ArcMeterProps) {
  const shown = parts.filter((p) => p.value > 0);
  const sum = shown.reduce((a, p) => a + p.value, 0);
  const whole = Math.max(total ?? sum, sum, 1e-9);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={84}>
        {({ width, height }) => {
          const stroke = Math.max(6, Math.min(11, height / 11));
          const r = Math.max(20, Math.min(width / 2 - stroke, height - stroke - 2));
          const cx = width / 2;
          const cy = Math.min(height - stroke / 2 - 1, (height + r) / 2);
          const size = Math.max(14, Math.min(24, r * 0.3));
          // respiro de 2,5 px entre as partes, na cor do fundo (nada de contorno)
          const gap = shown.length > 1 ? (2.5 / r) * (180 / Math.PI) : 0;
          let acc = 0;
          const segs = shown.map((p, i) => {
            const from = 180 + (acc / whole) * 180 + (i > 0 ? gap / 2 : 0);
            acc += p.value;
            const to = 180 + (acc / whole) * 180 - (i < shown.length - 1 ? gap / 2 : 0);
            return { from, to, color: p.color };
          });
          const single = segs.length === 1;
          const [sx, sy] = polar(cx, cy, r, 180);
          const [ex, ey] = polar(cx, cy, r, 360);
          return (
            <svg width={width} height={height} aria-hidden>
              <path d={arc(cx, cy, r, 180, 360)} fill="none" stroke={TRACK} strokeWidth={stroke} strokeLinecap="round" />
              {segs.map((s, i) => s.to - s.from > 0.2 && <path key={i} d={arc(cx, cy, r, s.from, s.to)} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap={single ? "round" : "butt"} />)}
              {/* pontas de fora arredondadas (as de dentro ficam retas, com o respiro) */}
              {!single && segs.length > 0 && <circle cx={sx} cy={sy} r={stroke / 2} fill={segs[0].color} />}
              {!single && segs.length > 0 && acc / whole > 0.995 && <circle cx={ex} cy={ey} r={stroke / 2} fill={segs[segs.length - 1].color} />}
              {r >= 44 && <CenterText x={cx} y={cy - r * 0.2} label={label} value={value} size={size} />}
            </svg>
          );
        }}
      </FitChart>
    </div>
  );
}

// ---- cápsulas --------------------------------------------------------------------------

type CapsuleBarsProps = { values: number[]; /** Rótulo de cada cápsula (os do eixo saem do primeiro, do meio e do último). */ labels: string[]; format: (v: number) => string; what: string; summary: string; className?: string };

/** Uma haste por trecho do período: a parte preenchida sobe até o valor; a maior fica em destaque. */
export function CapsuleBars({ values, labels, format, what, summary, className = "" }: CapsuleBarsProps) {
  const max = Math.max(...values, 0);
  const peak = values.indexOf(max);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={84}>
        {({ width, height }) => {
          const n = Math.max(1, values.length);
          const axis = height >= 96 ? 18 : 0;
          const top = 6;
          const bottom = height - axis - 6;
          const span = Math.max(1, bottom - top);
          const step = width / n;
          const ticks = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0];
          return (
            <svg width={width} height={height} aria-hidden={false}>
              {values.map((v, i) => {
                const x = step * (i + 0.5);
                const y = bottom - (max > 0 ? v / max : 0) * span;
                const strong = i === peak && max > 0;
                return (
                  <g key={i}>
                    <title>{`${labels[i] ?? ""}: ${format(v)} ${what}`}</title>
                    {/* área de apontar maior que a haste */}
                    <rect x={x - step / 2} y={0} width={step} height={height - axis} fill="transparent" />
                    <line x1={x} x2={x} y1={top} y2={bottom} stroke={TRACK} strokeWidth={3} strokeLinecap="round" />
                    {v > 0 && <line x1={x} x2={x} y1={y} y2={bottom} stroke={FILL} strokeWidth={strong ? 4 : 3} strokeLinecap="round" opacity={strong ? 1 : 0.62} />}
                    <circle cx={x} cy={bottom} r={3.2} fill={v > 0 ? FILL : "var(--muted)"} opacity={strong || v === 0 ? 1 : 0.78} />
                    {v > 0 && <circle cx={x} cy={y} r={strong ? 4.2 : 3.2} fill={FILL} opacity={strong ? 1 : 0.78} />}
                  </g>
                );
              })}
              {axis > 0 &&
                ticks.map((i, k) => (
                  <text key={i} x={step * (i + 0.5)} y={height - 3} textAnchor={k === 0 ? "start" : k === ticks.length - 1 ? "end" : "middle"} dx={k === 0 ? -4 : k === ticks.length - 1 ? 4 : 0} fontSize={10} fill="var(--fg-2)">
                    {labels[i] ?? ""}
                  </text>
                ))}
            </svg>
          );
        }}
      </FitChart>
    </div>
  );
}

// ---- pista -----------------------------------------------------------------------------

type TrackMeterProps = Center & { /** 0 a 1 (acima de 1, a pista fecha a volta). */ share: number; summary: string; className?: string };

/** Pista em forma de cápsula: o traço cheio dá a volta conforme a verba é usada. */
export function TrackMeter({ share, label, value, summary, className = "" }: TrackMeterProps) {
  const v = clamp01(share);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={72}>
        {({ width, height }) => {
          const stroke = Math.max(6, Math.min(10, height / 10));
          const h = Math.max(40, Math.min(height - stroke - 2, 110));
          const w = Math.max(h + 20, Math.min(width - stroke - 2, 360));
          const x = (width - w) / 2;
          const y = (height - h) / 2;
          const r = h / 2;
          // começa embaixo, perto da ponta esquerda, e sobe pela curva (como um velocímetro deitado)
          const d = `M${x + w * 0.3},${y + h} L${x + r},${y + h} A${r},${r} 0 0 1 ${x + r},${y} L${x + w - r},${y} A${r},${r} 0 0 1 ${x + w - r},${y + h} Z`;
          const size = Math.max(13, Math.min(22, h * 0.3));
          return (
            <svg width={width} height={height} aria-hidden>
              <path d={d} fill="none" stroke={TRACK} strokeWidth={stroke} strokeLinejoin="round" />
              {v > 0 && <path d={d} fill="none" stroke={FILL} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${v} 1`} />}
              <CenterText x={width / 2} y={y + h / 2 + size * 0.2} label={label} value={value} size={size} />
            </svg>
          );
        }}
      </FitChart>
    </div>
  );
}

// ---- mostrador -------------------------------------------------------------------------

type DialMeterProps = Center & {
  /** Posição do ponteiro na escala, de 0 a 1. null = sem escala (sem alvo definido): só as marcas. */
  share: number | null;
  /** Rótulos da escala: começo, meio e fim. */
  scale?: [string, string, string];
  summary: string;
  className?: string;
};

const DIAL_FROM = 160;
const DIAL_TO = 380;

/** Mostrador: o traço cheio vai até o valor e o resto da escala fica em marcas. */
export function DialMeter({ share, label, value, scale, summary, className = "" }: DialMeterProps) {
  const v = share === null ? 0 : clamp01(share);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={84}>
        {({ width, height }) => {
          const pad = scale && height >= 104 && width >= 190 ? 15 : 4;
          const stroke = Math.max(7, Math.min(13, height / 9));
          // o arco passa um pouco da meia-volta: o centro fica acima do pé do bloco; dos lados sobra lugar para os rótulos da escala
          const r = Math.max(22, Math.min(width / 2 - stroke / 2 - (pad > 4 ? 40 : 4), (height - stroke - pad * 2) / 1.34));
          const cx = width / 2;
          const cy = pad + stroke / 2 + r;
          const sweep = DIAL_TO - DIAL_FROM;
          const end = DIAL_FROM + sweep * v;
          const n = Math.max(12, Math.round((r * (sweep * Math.PI)) / 180 / 7));
          const marks = Array.from({ length: n + 1 }, (_, i) => DIAL_FROM + (sweep * i) / n).filter((deg) => share === null || deg > end + 3);
          const size = Math.max(14, Math.min(24, r * 0.3));
          const at = (deg: number, text: string) => {
            const [x, y] = polar(cx, cy, r + stroke / 2 + 9, deg);
            const c = Math.cos((deg * Math.PI) / 180);
            return (
              <text key={deg} x={x} y={y + 3} textAnchor={c < -0.3 ? "end" : c > 0.3 ? "start" : "middle"} fontSize={10} fill="var(--fg-2)">
                {text}
              </text>
            );
          };
          return (
            <svg width={width} height={height} aria-hidden>
              {marks.map((deg) => {
                const [x0, y0] = polar(cx, cy, r - stroke / 2 + 1, deg);
                const [x1, y1] = polar(cx, cy, r + stroke / 2 - 1, deg);
                return <line key={deg} x1={x0} y1={y0} x2={x1} y2={y1} stroke="color-mix(in srgb, var(--fg) 22%, transparent)" strokeWidth={1.2} strokeLinecap="round" />;
              })}
              {share !== null && v > 0 && <path d={arc(cx, cy, r, DIAL_FROM, end)} fill="none" stroke={FILL} strokeWidth={stroke} strokeLinecap="round" />}
              {scale && pad > 4 && [at(DIAL_FROM + sweep * 0.25, scale[0]), at(DIAL_FROM + sweep * 0.5, scale[1]), at(DIAL_FROM + sweep * 0.75, scale[2])]}
              <CenterText x={cx} y={cy + size * 0.1} label={label} value={value} size={size} />
            </svg>
          );
        }}
      </FitChart>
    </div>
  );
}
