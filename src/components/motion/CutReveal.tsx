"use client";

import { useInView } from "motion/react";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { useIntro } from "@/features/marketing/intro";

type Trigger = "view" | "intro";

/** Estado da animação: "idle" (escondido, só com JS), "play" ou "static". */
export function useRevealState(trigger: Trigger, ref: React.RefObject<Element | null>) {
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const intro = useIntro();
  if (trigger === "intro") return intro.revealed ? "play" : "static";
  return inView ? "play" : "idle";
}

type CutRevealProps = {
  lines: ReactNode[];
  as?: "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  lineClassName?: (i: number) => string;
  trigger?: Trigger;
  /** Atraso da primeira linha, em ms. */
  delay?: number;
  stagger?: number;
  id?: string;
};

/**
 * Texto que se revela linha a linha: cada linha sobe de dentro de uma máscara
 * (overflow + translateY). Uma cópia só do texto, sem clip-path: igual no
 * Safari e no Chrome, e sem mexer no layout. Sem JS, o texto aparece inteiro.
 */
export function CutReveal({
  lines,
  as: Tag = "h2",
  className = "",
  lineClassName,
  trigger = "view",
  delay = 0,
  stagger = 110,
  id,
}: CutRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const state = useRevealState(trigger, ref);

  return (
    <Tag ref={ref as never} id={id} className={className} data-cut={state}>
      {lines.map((line, i) => (
        <span key={i} className={`cut-line ${lineClassName?.(i) ?? ""}`}>
          <span className="cut-in" style={{ "--d": `${delay + i * stagger}ms` } as CSSProperties}>
            {line}
          </span>{" "}
        </span>
      ))}
    </Tag>
  );
}
