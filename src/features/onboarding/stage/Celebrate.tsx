"use client";

// Ao conectar: o check se desenha e um confete leve sai dele, uma vez.

import { useMemo, type CSSProperties } from "react";

export function CheckDraw({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="fa-anim">
      <circle cx="22" cy="22" r="20" fill="var(--accent)" className="fa-pop" />
      <path d="M13 22.5 19.5 29 31 16" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset="30" style={{ animation: "fa-draw 420ms 260ms var(--ease) forwards" }} />
    </svg>
  );
}

export function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 54 + (i % 3) * 20;
        return { dx: `${Math.cos(a) * d}px`, dy: `${Math.sin(a) * d - 18}px`, r: `${(i % 2 ? 1 : -1) * (120 + i * 17)}deg`, c: ["var(--accent)", "#d6e0aa", "#8a9a5b", "#f2f0e6"][i % 4], w: i % 3 ? 6 : 9 };
      }),
    [],
  );
  return (
    <span aria-hidden className="fa-confetti pointer-events-none absolute inset-0 grid place-items-center">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={{ width: b.w, height: 4, background: b.c, ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--r" as string]: b.r, animation: `fa-confetti 900ms ${i * 18}ms cubic-bezier(.2,.7,.3,1) both` } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** Check desenhado com confete em volta (a linha da plataforma que acabou de conectar). */
export function Celebrate() {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center" data-celebrate>
      <Confetti />
      <CheckDraw />
    </span>
  );
}
