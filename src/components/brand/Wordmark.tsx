import type { CSSProperties } from "react";
import { LETTER_STEP, V_BOTTOM, V_TOP, WORDMARK_WIDTH, Y_POLY, Z_BOTTOM, Z_TOP } from "./geometry";

type WordmarkProps = {
  /** "full" = assinatura principal com "vyzualize"; "reduced" = só o wordmark. */
  variant?: "full" | "reduced";
  /** Cor do wordmark (classe de texto). Padrão: destaque do modo atual. */
  className?: string;
  /** Cor do descritivo "vyzualize". Padrão: texto primário. */
  descriptorClassName?: string;
  title?: string;
  /** Sem rótulo acessível (quando o texto já está ao lado). */
  decorative?: boolean;
  style?: CSSProperties;
};

// "vyzualize": Inter 500, tracking +34%, centralizado abaixo da base.
const DESC_SIZE = 2.2;
const DESC_TRACKING = 0.34;
const DESC_BASELINE = 14.3;
const FULL_HEIGHT = 14.8;

const letterStyle = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Cada letra é um grupo `.wm-letter`; V e Z têm as metades `.wm-top` e
 * `.wm-bot` (acima e abaixo do corte), que o CSS anima para abrir o corte.
 */
export function Wordmark({
  variant = "reduced",
  className = "text-accent",
  descriptorClassName = "text-fg",
  title = "VYZ",
  decorative = false,
  style,
}: WordmarkProps) {
  const full = variant === "full";
  const height = full ? FULL_HEIGHT : 10;

  return (
    <svg
      viewBox={`0 0 ${WORDMARK_WIDTH} ${height}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : full ? `${title} · vyzualize` : title}
      className={className}
      style={{ display: "block", height: "auto", overflow: "visible", ...style }}
    >
      <g fill="currentColor">
        <g className="wm-letter" data-letter="v" style={letterStyle(0)}>
          <g className="wm-top">
            {V_TOP.map((p) => (
              <polygon key={p} points={p} />
            ))}
          </g>
          <g className="wm-bot">
            {V_BOTTOM.map((p) => (
              <polygon key={p} points={p} />
            ))}
          </g>
        </g>
        <g transform={`translate(${LETTER_STEP} 0)`}>
          <g className="wm-letter" data-letter="y" style={letterStyle(1)}>
            <polygon points={Y_POLY} />
          </g>
        </g>
        <g transform={`translate(${LETTER_STEP * 2} 0)`}>
          <g className="wm-letter" data-letter="z" style={letterStyle(2)}>
            <g className="wm-top">
              <polygon points={Z_TOP} />
            </g>
            <g className="wm-bot">
              <polygon points={Z_BOTTOM} />
            </g>
          </g>
        </g>
      </g>
      {full && (
        <text
          className={`wm-desc ${descriptorClassName}`}
          // o tracking também entra depois da última letra; compensa no centro
          x={WORDMARK_WIDTH / 2 + (DESC_SIZE * DESC_TRACKING) / 2}
          y={DESC_BASELINE}
          textAnchor="middle"
          fill="currentColor"
          style={{
            fontFamily: "var(--font-inter), Inter, sans-serif",
            fontWeight: 500,
            fontSize: DESC_SIZE,
            letterSpacing: `${DESC_TRACKING}em`,
          }}
        >
          vyzualize
        </text>
      )}
    </svg>
  );
}
