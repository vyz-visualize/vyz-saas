// Dobra "Diferenciais": credibilidade. O VYZ foi feito por engenheiros de dados, cientistas de
// dados e gestores de tráfego; o "cérebro de dados" mostra as plataformas entrando, o dado
// tratado no meio e o dashboard saindo. A IA genérica aparece só no contraponto, curto.
// Desktop: título, linha de apoio e contraponto à esquerda, cérebro à direita (cabe numa tela).
// Celular: título, linha de apoio, cérebro e contraponto, nessa ordem.
// O cérebro (diferenciais/BrainSvg) só carrega perto da tela; textos em diferenciais/copy.ts.

import { CutReveal } from "@/components/motion/CutReveal";
import { COUNTERPOINT, EYEBROW, ROLES, SUPPORT_LEAD, TITLE } from "./diferenciais/copy";
import { LazyBrain } from "./diferenciais/LazyBrain";

export function Diferenciais() {
  return (
    <section id="diferenciais" aria-labelledby="dif-title" className="relative">
      <div className="mx-auto grid max-w-[1360px] gap-7 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto] lg:gap-x-14 lg:gap-y-8 lg:px-10 lg:py-24">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="label-caps text-fg-2">{EYEBROW}</p>
          <CutReveal
            as="h2"
            id="dif-title"
            className="display mt-4 text-[clamp(1.85rem,7.6vw,2.6rem)] leading-[1.04] text-fg sm:text-[clamp(2.2rem,3.4vw,2.95rem)]"
            lines={[TITLE[0], <span key="b" className="text-accent">{TITLE[1]}</span>]}
          />
          {/* os três papéis em destaque: "Feito por Engenheiros de Dados, Cientistas de Dados e Gestores de Tráfego." */}
          <p className="mt-4 max-w-[36rem] text-[16px] leading-relaxed text-fg-2 sm:mt-5 sm:text-[18px]" data-papeis>
            {SUPPORT_LEAD}{" "}
            {ROLES.map((r, i) => (
              <span key={r}>
                <strong className="font-bold text-accent" data-papel>{r}</strong>
                {i === ROLES.length - 2 ? " e " : i < ROLES.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </div>

        {/* no celular entra entre a linha de apoio e o contraponto; no desktop, à direita */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <LazyBrain className="mx-auto max-w-[520px] lg:max-w-none" />
        </div>

        <p className="max-w-[34rem] border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-fg-2 sm:text-[16px] lg:col-start-1 lg:row-start-2 lg:self-start" data-contraponto>
          {COUNTERPOINT}
        </p>
      </div>
    </section>
  );
}
