"use client";

import { Ban, Check } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useState } from "react";

/** ok = deu certo (✓); blocked = não dá para fazer isso (o porquê em uma frase). */
export type ToastTone = "ok" | "blocked";

/** Aviso curto no rodapé da tela (aria-live). */
export function useToast({ placement = "bottom" }: { placement?: "bottom" | "top" } = {}) {
  const [msg, setMsg] = useState<{ text: string; id: number; tone: ToastTone } | null>(null);
  const show = useCallback((text: string, tone: ToastTone = "ok") => setMsg({ text, id: Date.now(), tone }), []);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2600);
    return () => window.clearTimeout(t);
  }, [msg]);

  const node = (
    <div aria-live="polite" className={`pointer-events-none fixed inset-x-0 flex justify-center px-4 ${placement === "top" ? "top-[132px] z-[120]" : "bottom-24 z-[80] lg:bottom-8"}`}>
      <AnimatePresence>
        {msg && (
          <m.p
            key={msg.id}
            initial={{ opacity: 0, y: placement === "top" ? -12 : 16, clipPath: "inset(50% 0 50% 0 round 999px)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0% 0 0% 0 round 999px)" }}
            exit={{ opacity: 0, y: placement === "top" ? -8 : 8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex max-w-[min(560px,100%)] items-center gap-2 rounded-chip bg-fg px-4 py-2 text-sm font-medium text-bg shadow-[0_12px_32px_-12px_rgba(0,0,0,.5)]"
          >
            {msg.tone === "blocked" ? <Ban size={15} aria-hidden className="shrink-0" /> : <Check size={16} aria-hidden className="shrink-0" />}
            {msg.text}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
  return { show, node };
}

// ---- avisos de qualquer lugar da tela -------------------------------------------------
// Quem arrasta um bloco para onde não cabe está longe de quem desenha o toast:
// notify() dispara um evento e o <Notices /> da página mostra o aviso.

const NOTICE_EVENT = "vyz-notice";

/** Aviso curto que aparece e some. Por padrão, o de "não dá para fazer isso". */
export function notify(text: string, tone: ToastTone = "blocked") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: { text, tone } }));
}

/** Monte uma vez na página que usa notify(). "top" quando o rodapé está ocupado (a bandeja do Personalizar). */
export function Notices({ placement = "bottom" }: { placement?: "bottom" | "top" }) {
  const { show, node } = useToast({ placement });
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; tone: ToastTone }>).detail;
      if (d?.text) show(d.text, d.tone);
    };
    window.addEventListener(NOTICE_EVENT, on);
    return () => window.removeEventListener(NOTICE_EVENT, on);
  }, [show]);
  return node;
}
