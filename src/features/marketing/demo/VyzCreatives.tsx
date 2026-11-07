// Criativos fictícios da própria VYZ para a prévia do comparativo: SVG leve, na identidade
// visual (verde-exército, sálvia, off-white). As cores são fixas (um criativo não muda com o
// tema do site). Um vídeo com o mascote e um carrossel com o print do dashboard.

import { useId } from "react";

export type CreativeArt = "mascote" | "dashboard";

const DEEP = "#1f2612";
const SAGE = "#8a9a5b";
const ARMY = "#4b5320";
const OFFWHITE = "#e8ece1";
const OFFBLACK = "#1e1e1e";

/** Vídeo: a esfera do VYZ com o rosto e "Pergunte ao VYZ". */
function MascotArt() {
  const id = useId();
  return (
    <svg viewBox="0 0 84 100" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
      <defs>
        <radialGradient id={`${id}-esfera`} cx="0.32" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#c3cca5" />
          <stop offset="0.32" stopColor={SAGE} />
          <stop offset="1" stopColor="#3f4727" />
        </radialGradient>
      </defs>
      <rect width="84" height="100" fill={DEEP} />
      <circle cx="42" cy="38" r="21" fill={`url(#${id}-esfera)`} />
      {/* o rosto do logo, no mesmo desenho de 100 unidades do mascote do site */}
      <g transform="translate(21 17) scale(0.42)" fill={DEEP}>
        <polygon points="33,37.5 44,37.5 45.4,46.5 34.4,46.5" />
        <polygon points="67,37.5 56,37.5 54.6,46.5 65.6,46.5" />
        <path d="M37.5,55 Q50,61 62.5,55 L60.6,62 Q50,68 39.4,62 Z" />
        <ellipse cx="30" cy="24" rx="10" ry="6" fill="white" opacity="0.35" />
      </g>
      <text x="42" y="74" textAnchor="middle" fill={OFFWHITE} fontSize="9.5" fontWeight="800" letterSpacing="-0.3">
        Pergunte
      </text>
      <text x="42" y="85" textAnchor="middle" fill={SAGE} fontSize="9.5" fontWeight="800" letterSpacing="-0.3">
        ao VYZ
      </text>
      {/* play: é um vídeo */}
      <circle cx="12" cy="12" r="6" fill="white" opacity="0.18" />
      <path d="M10.3 9.2 L15 12 L10.3 14.8 Z" fill={OFFWHITE} />
    </svg>
  );
}

/** Carrossel: o print do dashboard e "Pare de montar relatório na mão." */
function DashboardArt() {
  const bars = [10, 15, 12, 18, 14, 20, 17];
  return (
    <svg viewBox="0 0 84 100" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden>
      <rect width="84" height="100" fill={OFFWHITE} />
      {/* o print do dashboard */}
      <rect x="7" y="8" width="70" height="44" rx="4" fill="white" stroke="#cfd3c6" strokeWidth="0.8" />
      <rect x="11" y="12" width="14" height="2.6" rx="1.3" fill={ARMY} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={11 + i * 21.5} y="18" width="19" height="9" rx="1.6" fill={i === 2 ? "#d7dcc3" : "#f3f5ee"} stroke="#cfd3c6" strokeWidth="0.5" />
          <rect x={13 + i * 21.5} y="20" width="7" height="1.4" rx="0.7" fill="#9a9d93" />
          <rect x={13 + i * 21.5} y="23" width="11" height="2.2" rx="1.1" fill={OFFBLACK} />
        </g>
      ))}
      {bars.map((h, i) => (
        <rect key={i} x={12 + i * 8.6} y={48 - h} width="5.6" height={h} rx="1" fill={i === 5 ? ARMY : SAGE} />
      ))}
      {/* a frase, com o marca-texto do site em "na mão." */}
      <text x="8" y="66" fill={OFFBLACK} fontSize="7.4" fontWeight="800" letterSpacing="-0.25">
        Pare de montar
      </text>
      <text x="8" y="75" fill={OFFBLACK} fontSize="7.4" fontWeight="800" letterSpacing="-0.25">
        relatório
      </text>
      <rect x="7" y="80.2" width="27" height="3.4" fill={SAGE} opacity="0.55" />
      <text x="8" y="84" fill={OFFBLACK} fontSize="7.4" fontWeight="800" letterSpacing="-0.25">
        na mão.
      </text>
      {/* os pontos do carrossel */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={36 + i * 6} cy="94" r="1.6" fill={i === 0 ? ARMY : "#b9bdae"} />
      ))}
    </svg>
  );
}

export const FORMAT_LABEL: Record<string, string> = { video: "Vídeo", carousel: "Carrossel" };

/** A miniatura do criativo (o formato vai num chip ao lado, para não cobrir a frase). */
export function VyzCreative({ art, label, className = "" }: { art: CreativeArt; label: string; className?: string }) {
  return (
    <span role="img" aria-label={`Criativo: ${label}`} className={`relative block overflow-hidden ${className}`}>
      {art === "mascote" ? <MascotArt /> : <DashboardArt />}
    </span>
  );
}
