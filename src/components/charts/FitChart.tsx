"use client";

import type { ReactNode } from "react";
import { useElementSize, type Size } from "./useSize";

type FitChartProps = {
  children: (size: Size) => ReactNode;
  className?: string;
  /** Altura fixa em px (a largura vem do contêiner). Sem ela, a altura vem do CSS. */
  height?: number;
  minHeight?: number;
};

/**
 * Mede o espaço disponível e entrega largura e altura reais para o gráfico
 * desenhar em px (sem scale). Só desenha depois da primeira medida.
 * No encaixe da tela (--fit-cap, globals.css) a altura mínima cede: o gráfico encolhe
 * com o bloco em vez de estourar.
 */
export function FitChart({ children, className = "", height, minHeight = 140 }: FitChartProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref} className={`relative min-h-0 w-full overflow-hidden ${className}`} style={height ? { height } : { minHeight: `min(${minHeight}px, var(--fit-cap, ${minHeight}px))` }}>
      {size && size.width > 0 && size.height > 0 && <div className="absolute inset-0">{children(size)}</div>}
    </div>
  );
}
