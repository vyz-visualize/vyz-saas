"use client";

// Barra da importação em andamento: o tempo que costuma levar por plataforma, a barra
// andando com o relógio (nunca passa de 95% antes de terminar) e a página atualizando
// sozinha até a importação acabar.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdAccountDTO } from "./types";

/** Segundos típicos (90 dias na primeira vez; 7 dias nas seguintes). */
const TYPICAL: Record<string, [initial: number, incremental: number]> = {
  meta: [45, 15],
  google: [25, 10],
  ga4: [12, 6],
  instagram: [35, 15],
  facebook: [35, 15],
};

export function expectedSeconds(platformId: string, initial: boolean) {
  const t = TYPICAL[platformId] ?? [30, 10];
  return initial ? t[0] : t[1];
}

export function SyncProgress({ account }: { account: Pick<AdAccountDTO, "platformId" | "lastSync"> }) {
  const run = account.lastSync;
  const initial = run?.trigger === "initial";
  const total = expectedSeconds(account.platformId, initial);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, []);
  const start = Date.parse(run?.startedAt ?? run?.createdAt ?? "") || now || 0;
  const elapsed = now ? Math.max(0, (now - start) / 1000) : 0;
  const pct = Math.min(95, (elapsed / total) * 100);
  const left = Math.max(0, Math.ceil(total - elapsed));
  return (
    <div className="w-full min-w-[220px] space-y-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Importação dos dados">
      <div className="flex justify-between gap-3 text-[12px] text-fg-2">
        <span>{initial ? "Importando os últimos 90 dias" : "Sincronizando os últimos 7 dias"}</span>
        <span className="tabular-nums">{left > 0 ? `~${left} s` : "quase lá…"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Enquanto alguma importação roda, pede ao servidor a situação nova a cada poucos segundos. */
export function useRefreshWhile(active: boolean, everyMs = 4000) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(t);
  }, [active, everyMs, router]);
}
