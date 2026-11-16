"use client";

// Direção 1 · "Prompt × Pronto": lado a lado. À esquerda, a lista de tarefas com uma IA
// genérica vai se acumulando ao rolar e termina em "E amanhã, de novo."; à direita (fixa no
// computador), um login e o dashboard se montando. Abaixo, quem fez o VYZ e a frase final.
// No celular, a lista vira uma pilha que cresce e o lado VYZ vem em seguida.

import { RotateCcw } from "lucide-react";
import { CutReveal } from "@/components/motion/CutReveal";
import { GENERIC_END, GENERIC_STEPS } from "./copy";
import { Closing, Land, MadeBy, VyzSide } from "./parts";

export function DirecaoPrompt({ closing }: { closing: string }) {
  return (
    <section
      id="diferenciais"
      aria-labelledby="dif-title"
      className="relative"
      data-direcao="prompt"
    >
      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-24 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Prompt × Pronto</p>
        <CutReveal
          as="h2"
          id="dif-title"
          className="display mt-5 max-w-[16ch] text-[clamp(2.2rem,5.4vw,4.4rem)] text-fg"
          lines={[
            "Dá para fazer numa IA.",
            <span key="a" className="text-accent">
              Toda vez.
            </span>,
          ]}
        />
        <p className="mt-4 max-w-[38rem] text-[16px] leading-relaxed text-fg-2 sm:text-[17px]">
          Uma IA genérica responde o que você pergunta. O relatório do cliente
          pede o mesmo trabalho todo dia, e o VYZ faz esse trabalho sozinho.
        </p>

        <div className="mt-10 grid gap-12 sm:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          {/* lado A: a pilha de tarefas */}
          <div data-dif-generic>
            <p className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <span className="title text-[1.15rem] text-fg">
                Com uma IA genérica
              </span>
              <span className="text-[13px] text-fg-2 tnum">
                {GENERIC_STEPS.length} passos, toda vez
              </span>
            </p>
            <ol className="mt-1">
              {GENERIC_STEPS.map((s, i) => (
                <Land
                  key={s.title}
                  className="flex gap-4 border-b border-dashed border-line py-3.5 sm:py-4"
                >
                  <span className="w-7 shrink-0 pt-0.5 text-[13px] font-semibold text-fg-2 tnum">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16.5px] font-semibold text-fg sm:text-[18px]">
                      {s.title}
                    </span>
                    <span className="block text-[14px] text-fg-2">
                      {s.note}
                    </span>
                  </span>
                </Land>
              ))}
              <Land className="flex items-center gap-3 pt-5">
                <RotateCcw
                  size={20}
                  className="shrink-0 text-error"
                  aria-hidden
                />
                <span className="display text-[clamp(1.5rem,3vw,2.1rem)] text-fg">
                  {GENERIC_END}
                </span>
              </Land>
            </ol>
          </div>

          {/* lado B: um login e pronto (fixo no computador enquanto a pilha cresce) */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="flex items-baseline justify-between gap-3 border-b border-accent pb-3">
              <span className="title text-[1.15rem] text-accent">
                Com o VYZ
              </span>
              <span className="text-[13px] text-fg-2">1 login</span>
            </p>
            <div className="mt-5">
              <VyzSide />
            </div>
          </div>
        </div>

        <div className="mt-16 sm:mt-24">
          <MadeBy />
        </div>
        <div className="mt-14 sm:mt-20">
          <Closing text={closing} />
        </div>
      </div>
    </section>
  );
}
