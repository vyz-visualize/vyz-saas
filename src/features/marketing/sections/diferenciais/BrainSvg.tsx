"use client";

// O "cérebro de dados" da dobra Diferenciais, em SVG puro. Pontos e conexões formam o cérebro;
// os logos das plataformas entram pela esquerda, pulsos de luz percorrem as conexões e saem à
// direita num mini dashboard.
// Movimento só com SMIL (animateMotion e animate): sem JS por quadro, e o PlayWhenVisible pausa
// fora da tela. Parado ("reduzir movimento" ou aparelho fraco): os pulsos ficam no meio do caminho.

import { siGoogleads, siGoogleanalytics, siInstagram, siMeta } from "simple-icons";
import { BRAIN, type Region } from "./brain-model";

const REGIONS: Region[] = [0, 1, 2];

const OX = 100; // deslocamento do cérebro no desenho
const OY = 22;
const LOGO_X = 30;
const LOGO_Y = [80, 132, 184, 236];
const DASH = { x: 512, y: 104, w: 84, h: 122 };

const C = {
  node: "#b9c78a",
  edge: "#8a9a5b",
  spark: "#f1f4e8",
};

const px = (i: number) => BRAIN.nodes[i].x + OX;
const py = (i: number) => BRAIN.nodes[i].y + OY;

/** O caminho de cada pulso: logo → entrada → cérebro → saída → dashboard. */
const SPARK_PATHS = BRAIN.paths.map((path, k) => {
  const pts = [[LOGO_X + 16, LOGO_Y[k]], ...path.map((i) => [px(i), py(i)]), [DASH.x, DASH.y + DASH.h / 2]];
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const len = pts.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);
  return { d, dur: Math.max(2.4, len / 120), mid: pts[Math.floor(pts.length / 2)] };
});

/** Nós que piscam devagar (um a cada sete), cada um no seu tempo. */
const TWINKLE = BRAIN.nodes.map((_, i) => i).filter((i) => i % 7 === 3);

function Logo({ k, y }: { k: number; y: number }) {
  // só as plataformas que já funcionam (AVAILABLE_PLATFORMS)
  const icon = [siMeta, siGoogleads, siGoogleanalytics, siInstagram][k];
  return (
    <g>
      <circle cx={LOGO_X} cy={y} r={15} fill="#fff" />
      <svg x={LOGO_X - 9} y={y - 9} width={18} height={18} viewBox="0 0 24 24">
        <path d={icon.path} fill={`#${icon.hex}`} />
      </svg>
    </g>
  );
}

export function BrainSvg({ animate = true }: { animate?: boolean }) {
  return (
    <svg viewBox="0 0 610 330" className="h-auto w-full" role="img" aria-label="Um cérebro feito de pontos e conexões: os dados de Meta Ads, Google Ads, GA4 e Instagram entram, passam pelo cérebro e saem num dashboard." data-brain="svg">
      {/* entradas: logo → nó de entrada */}
      <g>
        {BRAIN.entries.map((e, k) => (
          <line key={e} x1={LOGO_X + 15} y1={LOGO_Y[k]} x2={px(e)} y2={py(e)} stroke={C.edge} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
        ))}
        {LOGO_Y.map((y, k) => (
          <Logo key={k} k={k} y={y} />
        ))}
      </g>

      {/* silhueta: contorno suave e sulcos recortados por dentro (a leitura de "cérebro") */}
      <g transform={`translate(${OX},${OY})`} aria-hidden>
        <defs>
          <clipPath id="brain-clip">
            <path d={BRAIN.outline} />
          </clipPath>
        </defs>
        <path d={BRAIN.outline} fill={C.edge} fillOpacity={0.07} stroke={C.edge} strokeOpacity={0.35} strokeWidth={1.2} />
        <g clipPath="url(#brain-clip)" fill="none" stroke={C.edge} strokeOpacity={0.16} strokeWidth={1.4} strokeLinecap="round">
          {BRAIN.gyri.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>

      {/* conexões e pontos, por região */}
      {REGIONS.map((r) => (
        <g key={r} data-region={r}>
          {BRAIN.edges
            .filter(([a]) => BRAIN.nodes[a].region === r)
            .map(([a, b]) => (
              <line key={`${a}-${b}`} x1={px(a)} y1={py(a)} x2={px(b)} y2={py(b)} stroke={C.edge} strokeWidth={0.8} opacity={0.45} />
            ))}
          {BRAIN.nodes.map((n, i) =>
            n.region === r ? (
              <circle key={i} cx={px(i)} cy={py(i)} r={n.r} fill={C.node} opacity={0.55 + (n.z / 110) * 0.35 + 0.1}>
                {animate && TWINKLE.includes(i) && <animate attributeName="opacity" values="0.5;1;0.5" dur={`${3 + (i % 5)}s`} begin={`${(i % 9) * 0.4}s`} repeatCount="indefinite" />}
              </circle>
            ) : null,
          )}
        </g>
      ))}

      {/* saída: nó → mini dashboard (o mesmo desenho da prévia do primeiro acesso) */}
      <g>
        <line x1={px(BRAIN.exit)} y1={py(BRAIN.exit)} x2={DASH.x} y2={DASH.y + DASH.h / 2} stroke={C.edge} strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
        <rect x={DASH.x} y={DASH.y} width={DASH.w} height={DASH.h} rx={9} fill="#1c2111" stroke={C.edge} strokeOpacity={0.6} />
        <rect x={DASH.x + 8} y={DASH.y + 9} width={22} height={5} rx={2.5} fill={C.node} />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={DASH.x + 8 + i * 23.5} y={DASH.y + 22} width={20} height={18} rx={3.5} fill={i === 2 ? C.edge : "#2a3119"} />
        ))}
        <polyline points={`${DASH.x + 8},${DASH.y + 74} ${DASH.x + 24},${DASH.y + 66} ${DASH.x + 38},${DASH.y + 69} ${DASH.x + 54},${DASH.y + 56} ${DASH.x + 76},${DASH.y + 50}`} fill="none" stroke={C.node} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        {[62, 46, 32, 20].map((w, i) => (
          <rect key={w} x={DASH.x + 8} y={DASH.y + 86 + i * 8} width={w} height={4.5} rx={2.2} fill={C.edge} opacity={1 - i * 0.18} />
        ))}
      </g>

      {/* pulsos de luz: entram pelos logos, cruzam o cérebro e chegam ao dashboard */}
      {SPARK_PATHS.map((s, k) =>
        animate ? (
          <g key={k} opacity={0}>
            <circle r={6} fill={C.spark} opacity={0.18} />
            <circle r={2.4} fill={C.spark} />
            <animateMotion dur={`${s.dur.toFixed(2)}s`} begin={`${(k * 0.9).toFixed(1)}s`} repeatCount="indefinite" path={s.d} />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.9;1" dur={`${s.dur.toFixed(2)}s`} begin={`${(k * 0.9).toFixed(1)}s`} repeatCount="indefinite" />
          </g>
        ) : (
          <g key={k} transform={`translate(${s.mid[0]},${s.mid[1]})`}>
            <circle r={6} fill={C.spark} opacity={0.18} />
            <circle r={2.4} fill={C.spark} />
          </g>
        ),
      )}

    </svg>
  );
}
