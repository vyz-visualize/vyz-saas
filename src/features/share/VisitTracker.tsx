"use client";

// Conta a visita ao link público (/r/<token>) para a aba Acessos do workspace: um sinal ao abrir,
// ao trocar de tela, a cada 30 s com a aba visível e ao sair (sendBeacon, que sobrevive ao fechar
// a aba). O tempo só corre com a aba visível. Uma visita por aba: recarregar ou voltar em até
// 30 min continua a mesma; depois disso, é outra. Sem cookie: o id fica no sessionStorage.

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { PageWatchContext } from "./page-watch";

const ENDPOINT = "/api/links/visita";
const BEAT_MS = 30_000;
const IDLE_MS = 30 * 60_000;
const MAX_SECONDS = 120;

type Saved = { id: string; at: number };

function readSaved(key: string): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? "null") as Saved | null;
    return v && typeof v.id === "string" && typeof v.at === "number" ? v : null;
  } catch {
    return null;
  }
}

function save(key: string, v: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

// text/plain: tipo que o sendBeacon aceita em qualquer navegador (o servidor lê o JSON do texto)
function post(body: string) {
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }))) return;
  } catch {}
  void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain;charset=UTF-8" } }).catch(() => {});
}

export function VisitTracker({ token, children }: { token: string; children: ReactNode }) {
  const key = `vyz-visita:${token.slice(-6)}`;
  const s = useRef({ visit: "", page: null as string | null, since: 0, ms: 0, lastAt: 0 });

  const flush = useCallback(() => {
    const st = s.current;
    if (!st.visit) return;
    const now = Date.now();
    if (st.since) {
      st.ms += now - st.since;
      st.since = document.visibilityState === "visible" ? now : 0;
    }
    const seconds = Math.min(MAX_SECONDS, Math.floor(st.ms / 1000));
    st.ms = Math.max(0, st.ms - seconds * 1000);
    st.lastAt = now;
    save(key, { id: st.visit, at: now });
    post(JSON.stringify({ token, visit: st.visit, page: st.page, seconds }));
  }, [key, token]);

  const start = useCallback(() => {
    const st = s.current;
    const saved = readSaved(key);
    st.visit = saved && Date.now() - saved.at < IDLE_MS ? saved.id : crypto.randomUUID();
    st.since = document.visibilityState === "visible" ? Date.now() : 0;
    st.ms = 0;
    flush();
  }, [flush, key]);

  const watch = useCallback(
    (page: string) => {
      const st = s.current;
      if (st.page === page) return;
      st.page = page;
      // a primeira tela chega antes de a visita começar (efeito do filho roda primeiro)
      if (st.visit) flush();
    },
    [flush],
  );

  useEffect(() => {
    start();
    const beat = window.setInterval(() => {
      if (document.visibilityState === "visible") flush();
    }, BEAT_MS);
    const onVisibility = () => {
      const st = s.current;
      if (document.visibilityState === "hidden") return flush();
      // voltou depois de muito tempo: é outra visita
      if (Date.now() - st.lastAt > IDLE_MS) return start();
      st.since = Date.now();
    };
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush, start]);

  return <PageWatchContext value={watch}>{children}</PageWatchContext>;
}
