"use client";

import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { useFinePointer } from "@/lib/hooks";

const MAX = 4; // graus

/** Moldura com tilt 3D sutil seguindo o mouse (sem sombra). */
export function TiltFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const enabled = fine && !reduce;
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [MAX, -MAX]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-MAX, MAX]), { stiffness: 160, damping: 18 });

  return (
    <div className="h-full [perspective:1400px]">
      <m.div
        className={className}
        style={enabled ? { rotateX: rx, rotateY: ry } : undefined}
        onPointerMove={(e) => {
          if (!enabled) return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
      >
        {children}
      </m.div>
    </div>
  );
}
