import { describe, expect, it } from "vitest";
import { autoPlays, HERO_SLIDES, nextSlide, prevSlide, SLIDE_MS, swipeDirection } from "./slides-logic";

const free = { reduced: false, ready: true, offscreen: false, hidden: false };

describe("slides do hero", () => {
  it("quatro slides, 3 s cada, e a ordem dá a volta", () => {
    expect(HERO_SLIDES.map((s) => s.label)).toEqual(["Visão geral", "Criativos", "Agente VYZ", "Link do cliente"]);
    expect(SLIDE_MS).toBe(3000);
    expect(nextSlide(3)).toBe(0);
    expect(prevSlide(0)).toBe(3);
  });

  it("o nome curto (celular) está dentro do nome do botão, para quem usa leitor de tela por voz", () => {
    for (const s of HERO_SLIDES) expect(s.label.toLowerCase()).toContain(s.short.toLowerCase());
  });

  it("deslizar: horizontal e longo troca; vertical ou curto, não", () => {
    expect(swipeDirection(-80, 5)).toBe(1);
    expect(swipeDirection(80, 5)).toBe(-1);
    expect(swipeDirection(-20, 0)).toBe(0);
    expect(swipeDirection(-60, 120)).toBe(0);
  });

  it("a troca automática só pausa fora da tela e com a aba oculta", () => {
    expect(autoPlays(free)).toBe(true);
    for (const k of ["offscreen", "hidden"] as const) expect(autoPlays({ ...free, [k]: true }), k).toBe(false);
  });

  it("mouse, foco e toque não pausam: nem fazem parte do estado", () => {
    expect(Object.keys(free).sort()).toEqual(["hidden", "offscreen", "ready", "reduced"]);
  });

  it("'reduzir movimento' não troca sozinho, e nada anda antes de carregar", () => {
    expect(autoPlays({ ...free, reduced: true })).toBe(false);
    expect(autoPlays({ ...free, ready: false })).toBe(false);
  });
});
