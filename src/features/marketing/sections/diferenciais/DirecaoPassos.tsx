"use client";

// Direção 2 · "Passos até o cliente ver o número": editorial, numa faixa escura. Um contador
// grande conta os passos de um relatório com uma IA genérica (8, os da lista) contra 0 no VYZ;
// uma semana mostra a repetição (8 por dia útil contra 1 login e a sincronização sozinha).
// Abaixo, as quatro respostas numeradas, quem fez o VYZ e a frase final. Sem horas: só passos.

import { useEffect, useState } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { ANSWERS, GENERIC_STEPS } from "./copy";
import { Closing, Land, MadeBy, VyzSide, useLanded, useReduceMotion } from "./parts";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const N = GENERIC_STEPS.length;

/** Conta de 0 aos passos da lista quando entra na tela (parado: já no total). */
function useCount() {
  const [ref, on] = useLanded<HTMLDivElement>();
  const reduce = useReduceMotion();
  const [n, setN] = useState(0);
  // um passo a cada 280 ms, até o total
  useEffect(() => {
    if (!on || reduce || n >= N) return;
    const t = window.setTimeout(() => setN(n + 1), n === 0 ? 200 : 280);
    return () => window.clearTimeout(t);
  }, [on, reduce, n]);
  return [ref, reduce ? N : n] as const;
}

function Week() {
  const [ref, on] = useLanded<HTMLDivElement>();
  return (
    <div ref={ref} className="mt-12 sm:mt-16" data-dif-week>
      <p className="label-caps text-bg/70">
        Uma semana, se o cliente quer ver o número todo dia útil
      </p>
      <div className="mt-5 overflow-hidden">
        <div className="grid grid-cols-[2.6rem_minmax(0,1fr)_minmax(0,0.8fr)] items-center gap-x-3 gap-y-2.5 text-[12.5px] sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-6 sm:text-[13px]">
          <span />
          <span className="font-semibold text-bg/70">IA genérica</span>
          <span className="font-semibold text-accent">VYZ</span>
          {DAYS.map((d, di) => (
            <div key={d} className="contents">
              <span className="font-medium text-bg/70">{d}</span>
              {/* 8 passos por dia, todo dia */}
              <span
                className="flex flex-wrap gap-1 sm:gap-1.5"
                aria-label={`${N} passos`}
              >
                {GENERIC_STEPS.map((s, si) => (
                  <span
                    key={s.title}
                    className="size-2.5 rounded-full bg-bg transition-opacity duration-300 motion-reduce:transition-none sm:size-3"
                    style={{
                      opacity: on ? 0.85 : 0.15,
                      transitionDelay: on ? `${di * 160 + si * 30}ms` : "0ms",
                    }}
                  />
                ))}
              </span>
              {/* VYZ: um login no primeiro dia; depois, só a sincronização sozinha */}
              <span className="flex items-center gap-1.5 text-bg/70">
                {di === 0 ? (
                  <span className="rounded-chip bg-accent px-2 py-0.5 text-[11.5px] font-semibold text-on-accent">
                    1 login
                  </span>
                ) : (
                  <span className="text-[12px]">0 passos</span>
                )}
                <span aria-hidden className="hidden items-center gap-1 sm:flex">
                  {[0, 1, 2].map((k) => (
                    <span
                      key={k}
                      className="size-2 rounded-full border border-accent"
                    />
                  ))}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-bg/70">
          <span>
            <strong className="font-semibold text-bg tnum">
              {N} × {DAYS.length} = {N * DAYS.length} passos
            </strong>{" "}
            com uma IA genérica
          </span>
          <span>
            <strong className="font-semibold text-accent">1 login</strong> no
            VYZ ·{" "}
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full border border-accent"
              />{" "}
              sincronização sozinha, 3x por dia
            </span>
          </span>
        </p>
      </div>
    </div>
  );
}

export function DirecaoPassos({ closing }: { closing: string }) {
  const [countRef, n] = useCount();
  const current = n > 0 ? GENERIC_STEPS[Math.min(n, N) - 1].title : " ";
  return (
    <section
      id="diferenciais"
      aria-labelledby="dif-title"
      className="relative"
      data-direcao="passos"
    >
      {/* faixa escura: o contador e a semana */}
      <div className="bg-fg text-bg">
        <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:px-10 lg:pt-24">
          <p className="label-caps text-bg/70">Por que não numa IA?</p>
          <CutReveal
            as="h2"
            id="dif-title"
            className="display mt-5 max-w-[18ch] text-[clamp(2.2rem,5.4vw,4.4rem)]"
            lines={[
              "Quantos passos até",
              <span key="a" className="text-accent">
                o cliente ver o número?
              </span>,
            ]}
          />

          <div
            ref={countRef}
            className="mt-10 grid gap-10 sm:mt-14 sm:grid-cols-2 sm:gap-0"
            data-dif-count
          >
            <div className="sm:border-r sm:border-bg/20 sm:pr-10">
              <p className="text-[14px] font-semibold text-bg/70">
                Com uma IA genérica
              </p>
              <p
                className="display mt-2 text-[clamp(5.5rem,16vw,11rem)] leading-[0.85] tnum"
                data-count={n}
              >
                {n}
              </p>
              <p className="mt-3 text-[16px] text-bg/80">
                passos a cada relatório. E de novo no próximo.
              </p>
              <p
                className="mt-2 h-6 truncate text-[14px] text-bg/60"
                aria-hidden
              >
                {current}
              </p>
            </div>
            <div className="sm:pl-10">
              <p className="text-[14px] font-semibold text-accent">Com o VYZ</p>
              <p className="display mt-2 text-[clamp(5.5rem,16vw,11rem)] leading-[0.85] text-accent tnum">
                0
              </p>
              <p className="mt-3 text-[16px] text-bg/80">
                passos depois do primeiro login. O dashboard se atualiza
                sozinho.
              </p>
            </div>
          </div>

          <Week />
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-24 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          {/* as quatro respostas, numeradas, em linhas com fio */}
          <ol data-dif-answers>
            {ANSWERS.map((a, i) => (
              <Land
                key={a.title}
                className="grid grid-cols-[3.2rem_minmax(0,1fr)] gap-3 border-t border-line py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:py-6"
              >
                <span className="display text-[2rem] leading-none text-accent tnum sm:text-[2.6rem]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="title block text-[1.2rem] text-fg sm:text-[1.4rem]">
                    {a.title}
                  </span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-fg-2">
                    {a.text}
                  </span>
                </span>
              </Land>
            ))}
          </ol>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <VyzSide />
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
