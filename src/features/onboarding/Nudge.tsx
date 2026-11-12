"use client";

// Lembrete contextual de conexão ("Você ainda não conectou o Google Ads..."):
// no máximo um por sessão do navegador, "Agora não" adia 3 dias (no banco) e
// nunca aparece com um tour na tela. Aparece um instante depois da página.

import { PlugZap, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { btn } from "@/components/ui/styles";
import { connectHref, type ProviderId } from "@/features/integrations/providers";
import { track } from "@/lib/track";
import { snoozeNudge } from "@/server/guides/actions";
import type { ActionResult } from "@/server/supabase/errors";
import { NUDGE_SESSION_KEY, nudgeFor, nudgeText, TOUR_ACTIVE_ATTR, type GuidesState } from "./guides";

export const NUDGE_DELAY_MS = 1200;

const shownThisSession = () => {
  try {
    return sessionStorage.getItem(NUDGE_SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

type Props = {
  guides: GuidesState;
  connected: readonly ProviderId[];
  onboardingDone: boolean;
  /** Para onde "Conectar" leva (padrão: o login da plataforma, voltando para Contas). */
  href?: (provider: ProviderId) => string;
  /** "Agora não" (padrão: grava no banco). */
  snooze?: (provider: ProviderId) => Promise<ActionResult>;
};

export function ConnectNudge({ guides, connected, onboardingDone, href = (p) => connectHref(p), snooze = snoozeNudge }: Props) {
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const tourActive = document.documentElement.hasAttribute(TOUR_ACTIVE_ATTR);
      const p = nudgeFor({ guides, connected, onboardingDone, tourActive, shownThisSession: shownThisSession(), now: new Date() });
      if (!p) return;
      try {
        sessionStorage.setItem(NUDGE_SESSION_KEY, "1");
      } catch {}
      setProvider(p);
      track("nudge_view", { provider: p });
    }, NUDGE_DELAY_MS);
    return () => window.clearTimeout(t);
    // uma decisão por página: a lista de conectadas muda junto com a página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (provider) ref.current?.querySelector<HTMLElement>("a")?.focus();
  }, [provider]);

  if (!provider) return null;
  const later = () => {
    setProvider(null);
    void snooze(provider);
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby="lembrete-titulo"
      data-nudge={provider}
      onKeyDown={(e) => e.key === "Escape" && later()}
      className="fixed inset-x-3 bottom-3 z-50 rounded-card border border-line bg-bg p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)] motion-safe:animate-[rise_240ms_var(--ease)_both] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-fg">
          <PlugZap size={17} />
        </span>
        <p id="lembrete-titulo" className="min-w-0 flex-1 text-[14.5px] leading-snug text-fg">
          {nudgeText(provider)}
        </p>
        <button type="button" onClick={later} aria-label="Fechar" className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-fg-2 hover:text-fg">
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={later} className={`${btn.ghost} h-9`}>
          Agora não
        </button>
        <a href={href(provider)} onClick={() => track("nudge_click", { provider })} className={btn.small}>
          Conectar
        </a>
      </div>
    </div>
  );
}
