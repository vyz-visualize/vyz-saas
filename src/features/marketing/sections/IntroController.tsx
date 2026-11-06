"use client";

import { useEffect } from "react";
import { getIntro, INTRO_KEY, setIntroPhase } from "@/features/marketing/intro";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Fim da fase 1 (letras sobem e o corte abre), contado da primeira pintura. As duas fases somam menos de 1 s. */
const PHASE1_MS = 480;
const PHASE2_MS = 340;
/** Altura do centro do corte no wordmark: (4,2 + 5,3) / 2 / 10. */
const CUT_CENTER = 0.475;

/**
 * Fase 2 da intro: a linha do corte se estende pela largura da tela e desce
 * até a meta do gráfico do mock, enquanto o wordmark encolhe para a navbar.
 * Rolar, clicar ou teclar termina na hora.
 */
export function IntroController() {
  useEffect(() => {
    const html = document.documentElement;
    // em dev, o remount do Strict Mode limpa o atributo: reaplica enquanto a intro roda
    if (getIntro().phase === "playing") html.setAttribute("data-intro", "");
    if (!html.hasAttribute("data-intro")) return;

    const mark = document.querySelector<HTMLElement>("[data-intro-mark]");
    const line = document.querySelector<HTMLElement>("[data-intro-line]");
    const bg = document.querySelector<HTMLElement>("[data-intro-bg]");
    const navMark = document.querySelector<HTMLElement>("[data-nav-mark]");
    const animations: Animation[] = [];
    let finished = false;
    let timer = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      animations.forEach((a) => a.cancel());
      html.removeAttribute("data-intro");
      try {
        // primeira visita só uma vez: depois, nunca mais
        localStorage.setItem(INTRO_KEY, "1");
      } catch {}
      setIntroPhase("done");
      removeSkip();
    };

    const skipEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const removeSkip = () => skipEvents.forEach((ev) => window.removeEventListener(ev, finish));
    skipEvents.forEach((ev) => window.addEventListener(ev, finish, { passive: true }));

    function phase2() {
      if (finished || !mark || !line || !bg) return finish();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = mark.getBoundingClientRect();
      const n = navMark?.getBoundingClientRect();
      const target = document.querySelector("[data-intro-target]")?.getBoundingClientRect();

      // o hero começa a se revelar enquanto o fundo da intro some
      setIntroPhase("reveal");

      // wordmark: do centro para a navbar (FLIP só com transform)
      mark.style.left = "0";
      mark.style.top = "0";
      mark.style.transform = `translate(${m.left}px, ${m.top}px)`;
      if (n && n.width > 0) {
        const s = n.width / m.width;
        animations.push(
          mark.animate(
            [
              { transform: `translate(${m.left}px, ${m.top}px) scale(1)` },
              { transform: `translate(${n.left}px, ${n.top}px) scale(${s})` },
            ],
            { duration: PHASE2_MS, easing: EASE, fill: "forwards" },
          ),
        );
      }

      // linha do corte: estende, desce e pousa na meta do gráfico
      const cutY = m.top + m.height * CUT_CENTER;
      const onScreen = target && target.width > 0 && target.top < vh && target.bottom > 0;
      const ty = onScreen ? target.top + target.height / 2 : vh + 8;
      const tx = onScreen ? target.left + target.width / 2 - vw / 2 : 0;
      const ts = onScreen ? target.width / vw : 1;
      animations.push(
        line.animate(
          [
            { transform: `translateY(${cutY}px) scaleX(${m.width / vw})`, opacity: 1 },
            { transform: `translateY(${cutY}px) scaleX(1)`, opacity: 1, offset: 0.3 },
            { transform: `translate(${tx}px, ${ty}px) scaleX(${ts})`, opacity: 1, offset: 0.85 },
            { transform: `translate(${tx}px, ${ty}px) scaleX(${ts})`, opacity: 0 },
          ],
          { duration: PHASE2_MS + 60, easing: EASE, fill: "forwards" },
        ),
      );

      animations.push(bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 60, easing: EASE, fill: "forwards" }));

      timer = window.setTimeout(finish, PHASE2_MS + 80);
    }

    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const wait = Math.max(0, fcp + PHASE1_MS - performance.now());
    timer = window.setTimeout(phase2, wait);

    return () => {
      window.clearTimeout(timer);
      removeSkip();
      animations.forEach((a) => a.cancel());
      if (mark) mark.style.cssText = "";
    };
  }, []);

  return null;
}
