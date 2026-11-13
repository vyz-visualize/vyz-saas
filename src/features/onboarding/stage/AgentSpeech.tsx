"use client";

// O agente VYZ apresenta o passo: o mascote e um balão de fala que se escreve letra a
// letra. O leitor de tela recebe o texto inteiro de uma vez (a digitação é só visual).

import { Mascot } from "@/features/agent/Mascot";
import { useReducedMotionPref, useTyped } from "./motion";

export function AgentSpeech({ text }: { text: string }) {
  const reduced = useReducedMotionPref();
  const typed = useTyped(text, reduced);
  return (
    <div className="mt-4 flex items-start gap-3" data-agent-speech>
      <span className="shrink-0 pt-0.5">
        <Mascot size={46} state={typed.done ? "idle" : "speaking"} />
      </span>
      <p key={text} className="fa-bubble relative min-h-[3.2em] flex-1 rounded-[18px] rounded-tl-[6px] border border-line bg-card px-4 py-2.5 text-[15px] leading-snug text-fg">
        <span aria-hidden>
          {typed.shown}
          {!typed.done && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-accent" style={{ animation: "fa-caret 800ms steps(1) infinite" }} />}
        </span>
        <span className="sr-only">{text}</span>
      </p>
    </div>
  );
}
