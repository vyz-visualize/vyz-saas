"use client";

// Aba "Perguntar ao VYZ": a pergunta sendo digitada e a resposta do mesmo motor do
// painel, com os dados de amostra. Sem servidor: nada sai do navegador.

import { Mic, Sparkles } from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentAnswer } from "@/features/agent/engine/types";
import { track } from "@/features/marketing/track";
import { SoonBadge } from "@/features/marketing/sections/SoonBadge";
import { DEMO_QUESTIONS, demoAnswer, demoContext } from "./vyz-context";
import { VyzFace, type VyzMood } from "./VyzFace";

/** Texto com **negrito**. */
function Rich({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]*\*\*)/g).map((p, i) =>
    p.startsWith("**") ? (
      <strong key={i} className="font-semibold text-fg tnum">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Answer({ answer }: { answer: AgentAnswer }) {
  const { card, chart } = answer;
  const max = chart ? Math.max(...chart.items.map((i) => i.value)) || 1 : 1;
  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-fg-2">
        <Rich text={answer.text} />
      </p>
      {card && (
        <div className="rounded-card border border-line bg-bg p-3">
          <p className="text-[11px] font-medium tracking-[0.06em] text-fg-2 uppercase">{card.label}</p>
          <p className="mt-1 text-[22px] leading-none font-bold tracking-[-0.02em] tnum">{card.value}</p>
          {card.delta && <p className={`mt-1.5 text-[12px] font-medium tnum ${card.delta.good === null ? "text-fg-2" : card.delta.good ? "text-accent" : "text-error-fg"}`}>{card.delta.text}</p>}
          {chart && (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3" aria-label={chart.title}>
              {chart.items.map((it, i) => (
                <li key={it.label} className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-2 text-[12px]">
                  <span className="truncate text-fg-2">{it.label}</span>
                  <span className="h-2.5" aria-hidden>
                    <span className="block h-full rounded-[2px]" style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, background: i === 0 ? "var(--accent)" : "var(--seq-c, var(--muted))" }} />
                  </span>
                  <span className="font-semibold tnum">{it.display}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const ALERTS = [
  { when: "Hoje, 8h", text: "O custo por venda da Loja Verde subiu 18% em 3 dias no Remarketing. A frequência passou de 4: vale trocar o criativo." },
  { when: "Ontem, 8h", text: "A Casa Norte vendeu mais de terça a quinta. Vale concentrar a verba nesses dias." },
];

type Phase = "idle" | "typing" | "thinking" | "answer";

export function VyzDemo({ active }: { active: boolean }) {
  const ctx = useMemo(() => demoContext(), []);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -20% 0px" });
  const [question, setQuestion] = useState<string | null>(null);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const timers = useRef<number[]>([]);
  const played = useRef(false);

  const stop = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const ask = useCallback(
    (q: string) => {
      stop();
      setQuestion(q);
      setAnswer(null);
      const result = demoAnswer(q, ctx);
      if (reduce) {
        setTyped(q.length);
        setAnswer(result);
        setPhase("answer");
        return;
      }
      setTyped(0);
      setPhase("typing");
      for (let i = 1; i <= q.length; i++) timers.current.push(window.setTimeout(() => setTyped(i), i * 34));
      const typedAt = q.length * 34;
      timers.current.push(window.setTimeout(() => setPhase("thinking"), typedAt + 120));
      timers.current.push(
        window.setTimeout(() => {
          setAnswer(result);
          setPhase("answer");
        }, typedAt + 820),
      );
    },
    [ctx, reduce],
  );

  // a primeira pergunta se faz sozinha, quando a aba aparece
  useEffect(() => {
    if (!active || !inView || played.current) return;
    played.current = true;
    ask(DEMO_QUESTIONS[0]);
  }, [active, ask, inView]);
  useEffect(() => stop, []);

  const mood: VyzMood = phase === "thinking" ? "thinking" : phase === "answer" ? "speaking" : "idle";
  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col gap-5 rounded-card bg-deep p-6 text-offwhite sm:p-7">
        <div className="flex items-center gap-4">
          <VyzFace mood={mood} />
          <div>
            <p className="label-caps text-sage">Seu assistente</p>
            <h3 className="display text-[clamp(1.9rem,3.6vw,2.6rem)] leading-none">VYZ</h3>
          </div>
        </div>
        <p className="text-[15.5px] leading-relaxed text-offwhite/85">Pergunte sobre os números dos seus clientes e ele responde na hora, com os dados do dashboard.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Perguntas de exemplo">
          {DEMO_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={question === q}
              disabled={phase === "typing" || phase === "thinking"}
              onClick={() => {
                ask(q);
                track("demo_interacao", { local: "demonstracao", acao: "pergunta", pergunta: q });
              }}
              className={`rounded-chip border px-3 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-60 ${question === q ? "border-sage bg-sage text-deep" : "border-offwhite/25 text-offwhite/90 hover:border-sage"}`}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3 rounded-full border border-offwhite/15 bg-offwhite/[0.06] py-2 pr-4 pl-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-deep">
            <Mic size={17} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-[13.5px] text-offwhite/80">Por texto em todos os planos · por voz no Avançado</span>
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col gap-4 rounded-card border border-line bg-card p-5 sm:p-6">
        <div aria-live="polite" className="flex flex-col gap-3">
          {question && (
            <p className="ml-auto max-w-[85%] rounded-[14px] rounded-br-[4px] bg-accent px-3.5 py-2 text-[14.5px] text-on-accent">
              {question.slice(0, typed)}
              {phase === "typing" && <span className="caret" aria-hidden />}
            </p>
          )}
          {phase === "thinking" && (
            <p className="flex items-center gap-1.5 text-[13px] text-fg-2" aria-label="VYZ pensando">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-fg-2 motion-safe:animate-pulse" style={{ animationDelay: `${i * 160}ms` }} aria-hidden />
              ))}
            </p>
          )}
          {answer && <Answer answer={answer} />}
        </div>
        <div className="mt-auto border-t border-line pt-4">
          <p className="flex items-center text-[13px] font-medium text-fg">
            Alerta diário
            <SoonBadge />
          </p>
          <ul className="mt-2.5 space-y-2" aria-label="Exemplos do alerta diário, em breve">
            {ALERTS.map((a) => (
              <li key={a.text} className="rounded-[12px] border border-line bg-bg px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[11.5px] text-fg-2">
                  <Sparkles size={12} aria-hidden /> {a.when}
                  <span className="ml-auto rounded-chip border border-line px-1.5 py-px text-[10.5px] font-medium">Exemplo</span>
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-fg">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
