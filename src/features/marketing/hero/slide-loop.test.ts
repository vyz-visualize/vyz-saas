import { describe, expect, it } from "vitest";
import { SlideLoop } from "./slide-loop";

/** Quadros de mentira: o teste diz quando cada quadro acontece. */
function fakeFrames() {
  let clock = 0;
  let next = 1;
  const pending = new Map<number, (t: number) => void>();
  return {
    deps: {
      now: () => clock,
      requestFrame: (cb: (t: number) => void) => {
        pending.set(next, cb);
        return next++;
      },
      cancelFrame: (id: number) => void pending.delete(id),
    },
    /** Avança o relógio de quadro em quadro (16 ms), por `ms`. */
    run(ms: number) {
      const end = clock + ms;
      while (clock < end) {
        clock += 16;
        const due = [...pending.entries()];
        pending.clear();
        for (const [, cb] of due) cb(clock);
      }
    },
    /** Passa tempo sem quadros (aba oculta: o navegador não chama). */
    idle(ms: number) {
      clock += ms;
    },
    get scheduled() {
      return pending.size;
    },
  };
}

function setup() {
  const frames = fakeFrames();
  const changes: number[] = [];
  let progress = 0;
  const loop = new SlideLoop(4, 3000, { onChange: (i) => changes.push(i), onProgress: (p) => (progress = p) }, frames.deps);
  return { loop, frames, changes, progress: () => progress };
}

describe("o relógio dos slides do hero", () => {
  it("troca a cada 3 s e volta ao primeiro depois do último, sem parar", () => {
    const { loop, frames, changes } = setup();
    loop.setPlaying(true);
    frames.run(3000 * 9 + 100);
    expect(changes).toEqual([1, 2, 3, 0, 1, 2, 3, 0, 1]);
  });

  it("depois da primeira troca, o laço segue sozinho (não depende de um novo render)", () => {
    const { loop, frames, changes } = setup();
    loop.setPlaying(true);
    frames.run(3100);
    expect(changes).toEqual([1]);
    expect(frames.scheduled).toBe(1);
    frames.run(3000);
    expect(changes).toEqual([1, 2]);
  });

  it("o preenchimento acompanha os 3 s", () => {
    const { loop, frames, progress } = setup();
    loop.setPlaying(true);
    frames.run(1500);
    expect(progress()).toBeGreaterThan(0.45);
    expect(progress()).toBeLessThan(0.55);
  });

  it("aba oculta ou fora da tela: para, e o tempo parado não conta; ao voltar, retoma de onde estava", () => {
    const { loop, frames, changes, progress } = setup();
    loop.setPlaying(true);
    frames.run(1500);
    loop.setPlaying(false);
    expect(frames.scheduled).toBe(0);
    frames.idle(60_000);
    expect(changes).toEqual([]);
    loop.setPlaying(true);
    frames.run(16);
    expect(progress()).toBeLessThan(0.55);
    frames.run(1600);
    expect(changes).toEqual([1]);
  });

  it("ligar duas vezes não cria dois laços", () => {
    const { loop, frames, changes } = setup();
    loop.setPlaying(true);
    loop.setPlaying(true);
    expect(frames.scheduled).toBe(1);
    frames.run(3100);
    expect(changes).toEqual([1]);
  });

  it("clicar num ícone pula para o slide e o loop continua dali", () => {
    const { loop, frames, changes } = setup();
    loop.setPlaying(true);
    frames.run(2000);
    loop.goTo(3);
    expect(changes).toEqual([3]);
    frames.run(2900);
    expect(changes).toEqual([3]);
    frames.run(200);
    expect(changes).toEqual([3, 0]);
  });

  it("parado (reduzir movimento), o clique troca e nada anda sozinho", () => {
    const { loop, frames, changes } = setup();
    loop.goTo(2);
    frames.run(10_000);
    expect(changes).toEqual([2]);
    expect(loop.current).toBe(2);
  });
});
