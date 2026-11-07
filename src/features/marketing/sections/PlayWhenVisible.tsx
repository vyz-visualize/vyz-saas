"use client";

// As animações contínuas do site só rodam com a dobra na tela: fora dela, ficam pausadas
// (CSS por data-play e SVG por pauseAnimations). Com "reduzir movimento", ficam paradas.

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

export function PlayWhenVisible({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "ul" }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "120px 0px" });
  const reduce = useReducedMotion();
  const play = inView && !reduce;
  useEffect(() => {
    ref.current?.querySelectorAll("svg").forEach((svg) => (play ? svg.unpauseAnimations() : svg.pauseAnimations()));
  }, [play]);
  return (
    <Tag ref={ref as never} data-play={play ? "on" : "off"} className={className}>
      {children}
    </Tag>
  );
}
