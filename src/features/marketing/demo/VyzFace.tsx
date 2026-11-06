"use client";

// O VYZ do site: a esfera com o rosto do logo. Pisca de vez em quando e o olhar segue o
// cursor. Parado com "reduzir movimento" e fora da tela.

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type VyzMood = "idle" | "thinking" | "speaking";

/** Quanto o rosto anda na direção do cursor (unidades do desenho de 100). */
const LOOK = 4;

export function VyzFace({ mood = "idle", size = 88 }: { mood?: VyzMood; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!inView || reduce) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 400);
        setLook({ x: (dx / d) * LOOK * k, y: (dy / d) * LOOK * k });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(frame);
    };
  }, [inView, reduce]);

  const blink = inView && !reduce;
  return (
    <span
      ref={ref}
      aria-hidden
      data-vyz-face
      className={`relative inline-block shrink-0 rounded-full transition-transform duration-500 ease-brand ${mood === "thinking" ? "motion-safe:animate-pulse" : ""}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--color-sage) 95%, white) 0%, var(--color-sage) 32%, color-mix(in srgb, var(--color-sage) 45%, black) 100%)",
        boxShadow: "inset -6px -8px 16px rgb(0 0 0 / 0.35)",
        transform: mood === "speaking" ? "scale(1.05)" : "scale(1)",
      }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: "transform 180ms ease-out" }}>
          <g className={blink ? "vyz-blink" : ""}>
            <polygon points="33,37.5 44,37.5 45.4,46.5 34.4,46.5" fill="var(--color-deep)" />
            <polygon points="67,37.5 56,37.5 54.6,46.5 65.6,46.5" fill="var(--color-deep)" />
          </g>
          <path
            d={mood === "speaking" ? "M37.5,55 Q50,61 62.5,55 L60.6,62 Q50,68 39.4,62 Z" : "M37.5,56 Q50,60.5 62.5,56 L60.6,60 Q50,64.2 39.4,60 Z"}
            fill="var(--color-deep)"
            className="transition-all duration-300"
          />
        </g>
        <ellipse cx={30 - look.x / 2} cy={24 - look.y / 2} rx="10" ry="6" fill="white" opacity="0.35" />
      </svg>
    </span>
  );
}
