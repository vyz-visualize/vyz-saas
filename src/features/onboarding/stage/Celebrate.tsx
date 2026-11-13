"use client";

// Ao conectar: um confete leve sai do selo "Conectado ✓", uma vez (some com "reduzir movimento").

import { useMemo, type CSSProperties } from "react";

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
