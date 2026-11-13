"use client";

// O indicador do topo: uma trilha que se preenche entre os 4 passos, com o atual em
// destaque e, nos concluídos, o que foi feito ("Loja da Ana · E-commerce", "Meta Ads ✓ ·
// 2 contas"). No celular, uma barra compacta: "02 Conectar" e o resumo do passo anterior.

import { ACTION_STEPS, actionNumber, progressOf, STEP_LABEL, type ActiveStep } from "../steps";

export type TrailSummaries = Partial<Record<(typeof ACTION_STEPS)[number], string>>;

const pad = (n: number) => String(n).padStart(2, "0");
const N = ACTION_STEPS.length;
/** As colunas da trilha (classes fixas, para o Tailwind gerar). */
const COLS: Record<number, string> = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" };

export function Trail({ step, building, summaries }: { step: ActiveStep; building: boolean; summaries: TrailSummaries }) {
  const number = actionNumber(step);
  const current = building ? ACTION_STEPS.length + 1 : (number ?? 0);
  const progress = Math.round(progressOf(building ? "building" : step) * 100);
  const done = (i: number) => i + 1 < current;
  const prev = number && number > 1 ? ACTION_STEPS[number - 2] : null;
  const caption = building ? "Quase lá" : number ? `Passo ${number} de ${ACTION_STEPS.length} · ${STEP_LABEL[step]}` : `${STEP_LABEL[step]} · ${ACTION_STEPS.length} passos`;
  return (
    <nav aria-label="Passos do primeiro acesso" data-trail>
      {/* a frase para quem não vê a trilha; nas boas-vindas, também na tela */}
      <p className={number || building ? "sr-only" : "text-[13px] text-fg-2"} data-trail-caption>
        {caption}
      </p>
      {/* celular: barra compacta */}
      <div className="sm:hidden" data-trail-compact>
        {number || building ? (
          <p className="flex items-baseline gap-2 text-[14px]">
            <span className="text-[22px] leading-none font-black tracking-[-0.03em] text-accent tnum">{building ? "✓" : pad(number!)}</span>
            <span className="font-semibold text-fg">{building ? "Montando" : STEP_LABEL[step]}</span>
            {prev && summaries[prev] && <span className="min-w-0 truncate text-[12.5px] text-fg-2">· {summaries[prev]}</span>}
          </p>
        ) : null}
      </div>
      {/* a barra também é o progressbar (a trilha que preenche) */}
      <div role="progressbar" aria-label="Progresso do primeiro acesso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="relative mt-2 h-1 rounded-full bg-line sm:sr-only">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-brand motion-reduce:transition-none" style={{ width: `${progress}%` }} />
      </div>
      {/* telas maiores: a trilha conectada */}
      {/* a linha vai do centro do primeiro ao centro do último passo */}
      <ol className={`relative mt-1 hidden gap-3 sm:grid ${COLS[N]}`} aria-hidden={false}>
        <span aria-hidden className="absolute top-[15px] h-[3px] rounded-full bg-line" style={{ left: `calc(100% / ${2 * N})`, right: `calc(100% / ${2 * N})` }} />
        <span
          aria-hidden
          className="absolute top-[15px] h-[3px] rounded-full bg-accent transition-[width] duration-500 ease-brand motion-reduce:transition-none"
          style={{ left: `calc(100% / ${2 * N})`, width: `calc((100% * ${N - 1} / ${N}) * ${Math.min(1, Math.max(0, (current - 1) / (N - 1)))})` }}
        />
        {ACTION_STEPS.map((s, i) => {
          const on = i + 1 === current;
          const ok = done(i);
          return (
            <li key={s} className="relative flex flex-col items-center text-center" data-trail-step={s} data-state={on ? "current" : ok ? "done" : "next"} aria-current={on ? "step" : undefined}>
              <span
                className={`grid h-8 min-w-12 place-items-center rounded-full border-2 px-2 text-[15px] leading-none font-black tracking-[-0.03em] tnum transition-colors duration-300 ${on ? "border-accent bg-bg text-accent" : ok ? "border-accent bg-accent text-on-accent" : "border-line bg-bg text-fg-2"}`}
              >
                {pad(i + 1)}
              </span>
              <span className={`mt-1.5 text-[13px] ${on ? "font-semibold text-fg" : ok ? "text-fg" : "text-fg-2"}`}>{STEP_LABEL[s]}</span>
              {ok && summaries[s] && (
                <span className="mt-0.5 max-w-full truncate text-[12px] text-accent" data-trail-summary>
                  {summaries[s]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
