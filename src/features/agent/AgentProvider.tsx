"use client";

// Estado do assistente VYZ: conversa (só na memória desta aba), abrir/fechar
// (botão, barra e ⌘K/Ctrl+K), pergunta → contexto do servidor → motor →
// ação, digitação simulada, voz (só nos planos com agentVoice) e o "Mostrar
// no painel".

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setTheme } from "@/components/ui/ThemeToggle";
import { hasFilters, parseFilters } from "@/features/analytics/filters";
import { useWorkspace } from "@/features/workspace/workspace";
import { getAgentContext } from "@/server/agent/actions";
import { createEngine, type AgentAnswer, type AgentContext, type AgentTarget, type VyzEngine } from "./engine";
import type { MascotState } from "./Mascot";
import { listen, speak, stripWakeWord } from "./voice";

export type Message = { id: number; role: "user" | "vyz"; text: string; answer?: AgentAnswer; shown: number };

type AgentState = {
  open: boolean;
  setOpen: (v: boolean) => void;
  messages: Message[];
  ask: (q: string) => void;
  clear: () => void;
  busy: boolean;
  mascot: MascotState;
  engineLabel: string;
  /** Plano libera voz (microfone e leitura em voz alta)? */
  voiceAllowed: boolean;
  speakerOn: boolean;
  setSpeakerOn: (v: boolean) => void;
  listening: boolean;
  toggleMic: () => void;
  interim: string;
  micError: string | null;
  caption: string | null;
  showOnPanel: (t: AgentTarget) => void;
};

const Ctx = createContext<AgentState | null>(null);
export function useAgent() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgent fora do AgentProvider");
  return v;
}

/** Pergunta feita num dashboard com filtros: lido na hora, da URL (é ela que guarda os filtros). */
function dashboardFocus() {
  const dashboardId = /^\/painel\/dashboards\/([0-9a-f-]{36})\/?$/.exec(window.location.pathname)?.[1];
  const { search } = window.location;
  return dashboardId && hasFilters(parseFilters(new URLSearchParams(search))) ? { dashboardId, search } : undefined;
}

/** Contexto do servidor (plano, uso e números dos dashboards) e a resposta do motor. */
async function answerFor(engine: VyzEngine, question: string): Promise<AgentAnswer> {
  let result: Awaited<ReturnType<typeof getAgentContext>>;
  try {
    result = await getAgentContext(dashboardFocus());
  } catch {
    result = { ok: false, error: { code: "unknown", message: "Não consegui falar com o servidor. Confira a conexão e tente de novo." } };
  }
  if (!result.ok) return { text: result.error.message, spoken: result.error.message, understood: false };
  const ctx: AgentContext = result.data;
  return engine.ask(question, ctx);
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Espera o alvo aparecer (depois de navegar), rola e destaca. */
function highlightWhenReady(metric: string, timeout = 4000) {
  const t0 = performance.now();
  const tick = () => {
    const el = document.querySelector<HTMLElement>(`[data-vyz-metric="${metric}"]`);
    if (el) {
      el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      el.classList.remove("vyz-highlight");
      void el.offsetWidth; // reinicia a animação
      el.classList.add("vyz-highlight");
      window.setTimeout(() => el.classList.remove("vyz-highlight"), 2200);
      return;
    }
    if (performance.now() - t0 < timeout) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ent } = useWorkspace();
  const engine = useMemo(() => createEngine(), []);
  const [open, setOpenState] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const nextId = useRef(1);
  const stopMic = useRef<() => void>(() => {});
  const stopVoice = useRef<() => void>(() => {});
  const typing = useRef<number>(0);
  const voiceAllowed = ent.agentVoice;

  const silence = useCallback(() => {
    stopVoice.current();
    setSpeaking(false);
    setCaption(null);
  }, []);

  const setOpen = useCallback(
    (v: boolean) => {
      setOpenState(v);
      if (!v) {
        // fechar o drawer desliga o microfone e a voz: nada escuta em segundo plano
        stopMic.current();
        setListening(false);
        setInterim("");
        silence();
      }
    },
    [silence],
  );

  // plano sem voz (ex.: trocou para um plano menor): corta na hora
  useEffect(() => {
    if (voiceAllowed) return;
    stopMic.current();
    stopVoice.current();
  }, [voiceAllowed]);

  // ⌘K / Ctrl+K (nenhum outro atalho do painel usa essa tecla)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenState((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => window.clearInterval(typing.current), []);

  const reveal = useCallback((id: number, length: number, done: () => void) => {
    if (reduced()) {
      setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, shown: length } : m)));
      done();
      return;
    }
    window.clearInterval(typing.current);
    const step = Math.max(2, Math.ceil(length / 60));
    typing.current = window.setInterval(() => {
      let finished = false;
      setMessages((ms) =>
        ms.map((m) => {
          if (m.id !== id) return m;
          const shown = Math.min(length, m.shown + step);
          finished = shown >= length;
          return { ...m, shown };
        }),
      );
      if (finished) {
        window.clearInterval(typing.current);
        done();
      }
    }, 16);
  }, []);

  const runAction = useCallback(
    (a: AgentAnswer) => {
      if (a.action?.type === "theme") setTheme(a.action.theme);
      // caminho lido na hora (usePathname exigiria Suspense em volta do painel todo)
      if (a.action?.type === "navigate" && a.action.href !== window.location.pathname) router.push(a.action.href);
    },
    [router],
  );

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      silence();
      setMicError(null);
      const userId = nextId.current++;
      setMessages((ms) => [...ms, { id: userId, role: "user", text: q, shown: q.length }]);
      setBusy(true);
      const t0 = performance.now();
      const answer = await answerFor(engine, q);
      // um respiro mínimo de "pensando" (o motor local responde na hora)
      const wait = reduced() ? 0 : Math.max(0, 350 - (performance.now() - t0));
      if (wait) await new Promise((r) => window.setTimeout(r, wait));
      const id = nextId.current++;
      setMessages((ms) => [...ms, { id, role: "vyz", text: answer.text, answer, shown: 0 }]);
      runAction(answer);
      if (voiceAllowed && speakerOn) {
        stopVoice.current = speak(answer.spoken, {
          start: () => {
            setSpeaking(true);
            setCaption(answer.spoken);
          },
          end: () => {
            setSpeaking(false);
            setCaption(null);
          },
        });
      }
      reveal(id, answer.text.length, () => setBusy(false));
    },
    [busy, engine, reveal, runAction, silence, speakerOn, voiceAllowed],
  );

  const toggleMic = useCallback(() => {
    if (!voiceAllowed) return;
    if (listening) {
      stopMic.current();
      setListening(false);
      return;
    }
    silence();
    setMicError(null);
    setInterim("");
    setListening(true);
    stopMic.current = listen({
      onInterim: setInterim,
      onFinal: (text) => {
        setInterim("");
        const { woke, rest } = stripWakeWord(text);
        if (rest) ask(rest);
        else if (woke) ask("oi");
      },
      onError: (msg) => setMicError(msg),
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
    });
  }, [ask, listening, silence, voiceAllowed]);

  const clear = useCallback(() => {
    window.clearInterval(typing.current);
    silence();
    setBusy(false);
    setMessages([]);
    setMicError(null);
  }, [silence]);

  const showOnPanel = useCallback(
    (t: AgentTarget) => {
      const href = `/painel/dashboards/${t.dashboardId}`;
      // no celular o drawer cobre a tela: fecha para mostrar o card
      if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
      if (window.location.pathname !== href) router.push(href);
      highlightWhenReady(t.metric);
    },
    [router, setOpen],
  );

  const mascot: MascotState = listening ? "listening" : speaking ? "speaking" : busy ? "thinking" : "idle";

  const value: AgentState = {
    open,
    setOpen,
    messages,
    ask,
    clear,
    busy,
    mascot,
    engineLabel: engine.label,
    voiceAllowed,
    speakerOn,
    setSpeakerOn: (v) => {
      setSpeakerOn(v);
      if (!v) silence();
    },
    listening,
    toggleMic,
    interim,
    micError,
    caption: voiceAllowed ? caption : null,
    showOnPanel,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
