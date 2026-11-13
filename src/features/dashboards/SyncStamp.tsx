"use client";

// Selo de sincronização: "atualizado em 30/10 às 10:05". Com dados de mais de 6 h, ao abrir o
// dashboard ele pede a sincronização das contas em segundo plano, mostra "Atualizando…" e,
// quando ela termina, redesenha a página no lugar (router.refresh: sem recarregar, sem perder
// a aba, o filtro nem a rolagem). Uma chamada por dashboard enquanto a aba do navegador vive.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { needsRefresh, syncedAtLabel } from "@/features/sync/freshness";

type Outcome = { synced: number };

// a mesma página montada de novo (modo estrito, troca de período) não pede outra vez
const asked = new Map<string, Promise<Outcome>>();

function askRefresh(dashboardId: string): Promise<Outcome> {
  let p = asked.get(dashboardId);
  if (!p) {
    p = fetch(`/api/dashboards/${dashboardId}/atualizar`, { method: "POST", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { synced: 0 }))
      .then((j: { synced?: number }) => ({ synced: j.synced ?? 0 }))
      .catch(() => ({ synced: 0 }));
    asked.set(dashboardId, p);
  }
  return p;
}

type SyncStampProps = {
  dashboardId: string;
  /** A sincronização mais antiga entre as contas do dashboard (null: nenhuma ainda). */
  lastSyncedAt: string | null;
  timeZone: string;
  /** Dispara a atualização ao abrir (só no painel; nunca no link do cliente nem nas prévias). */
  autoRefresh?: boolean;
  /** "chip": etiqueta do cabeçalho dos modelos; "inline": no texto do período (ao vivo). */
  variant?: "chip" | "inline";
};

export function SyncStamp({ dashboardId, lastSyncedAt, timeZone, autoRefresh = false, variant = "chip" }: SyncStampProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    if (!autoRefresh || !needsRefresh(lastSyncedAt, Date.now())) return;
    let alive = true;
    const request = askRefresh(dashboardId);
    // o selo muda no próximo quadro (nada de estado síncrono dentro do efeito)
    const frame = requestAnimationFrame(() => alive && setSyncing(true));
    void request.then(({ synced }) => {
      if (!alive) return;
      cancelAnimationFrame(frame);
      // "Atualizando…" fica até os números novos chegarem
      startRefresh(() => {
        setSyncing(false);
        if (synced > 0) router.refresh();
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [autoRefresh, dashboardId, lastSyncedAt, router]);

  const busy = syncing || refreshing;
  if (!busy && !lastSyncedAt) return null;
  const when = lastSyncedAt ? syncedAtLabel(lastSyncedAt, timeZone) : "";
  const text = busy ? "Atualizando…" : `atualizado em ${when}`;

  if (variant === "inline")
    return (
      <span aria-live="polite" data-sync-stamp={busy ? "syncing" : "idle"} className="inline-flex items-center gap-1.5">
        · {busy && <Spinner />}
        {text}
      </span>
    );
  return (
    <span
      aria-live="polite"
      data-sync-stamp={busy ? "syncing" : "idle"}
      className="inline-flex items-center gap-1.5 rounded-chip border border-line px-2 py-0.5 text-[11.5px] whitespace-nowrap text-fg-2"
      title={busy ? "Buscando os números mais recentes nas plataformas" : undefined}
    >
      {busy && <Spinner />}
      {busy ? text : `Atualizado em ${when}`}
    </span>
  );
}

function Spinner() {
  return <span aria-hidden className="inline-block size-2.5 rounded-full border-[1.5px] border-current border-t-transparent motion-safe:animate-spin" />;
}
