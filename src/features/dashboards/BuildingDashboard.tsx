"use client";

// "Gerando o dashboard": o VYZ animado, as etapas passando e a barra andando (para em 92%
// até a página nova abrir). E o esqueleto da tela do dashboard, alinhado com ela.

import { useEffect, useState } from "react";
import { Mascot } from "@/features/agent/Mascot";

const STEPS = ["Lendo o objetivo e o visual", "Ligando as contas escolhidas", "Montando as páginas", "Desenhando os gráficos", "Abrindo o dashboard"];

export function BuildingDashboard({ title = "Montando o seu dashboard", seconds = 6 }: { title?: string; seconds?: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((v) => v + 0.1), 100);
    return () => window.clearInterval(id);
  }, []);
  // anda rápido no começo e desacelera: nunca chega ao fim antes da página abrir
  const pct = Math.min(92, 100 * (1 - Math.exp(-t / (seconds / 2.2))));
  const step = Math.min(STEPS.length - 1, Math.floor((pct / 92) * STEPS.length));
  return (
    <div className="flex flex-col items-center gap-5 px-4 py-10 text-center" role="status" aria-live="polite">
      <div className="relative">
        <span aria-hidden className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/25 motion-reduce:hidden" />
        <Mascot state="thinking" size={88} />
      </div>
      <div className="space-y-1">
        <p className="title text-[19px] text-fg">{title}</p>
        <p className="text-[13.5px] text-fg-2">{STEPS[step]}…</p>
      </div>
      <div className="w-full max-w-sm space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[12px] text-fg-2 tabular-nums">{Math.round(pct)}%</p>
      </div>
    </div>
  );
}

/** Esqueleto da tela do dashboard: as mesmas faixas (topo, abas e controles, cards, blocos) na mesma grade. */
export function DashboardSkeleton() {
  const bar = "rounded-control bg-line/50";
  return (
    <div className="animate-pulse space-y-3 motion-reduce:animate-none" aria-busy="true" aria-label="Carregando o dashboard">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-9 shrink-0 rounded-[10px] bg-line/60" />
          <div className={`h-7 w-56 ${bar}`} />
          <div className="hidden gap-1.5 md:flex">
            <div className={`h-6 w-20 ${bar}`} />
            <div className={`h-6 w-24 ${bar}`} />
          </div>
        </div>
        <div className="hidden gap-2 md:flex">
          <div className={`h-9 w-24 ${bar}`} />
          <div className={`h-9 w-28 ${bar}`} />
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-1 gap-5 border-b border-line pb-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-5 w-24 ${bar}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <div className={`h-10 w-52 ${bar}`} />
          <div className={`h-10 w-32 ${bar}`} />
          <div className={`h-10 w-40 ${bar}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[112px] rounded-card bg-card" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3" style={{ height: "max(320px, calc(100dvh - 380px))" }}>
        <div className="rounded-card bg-card lg:col-span-2" />
        <div className="rounded-card bg-card" />
      </div>
    </div>
  );
}
