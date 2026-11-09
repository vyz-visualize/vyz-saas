// O relógio dos slides do hero, fora do React: um laço de quadros que anda enquanto pode
// rodar, troca de slide a cada `duration` ms e continua sozinho depois da troca (sem depender
// de um novo render para reagendar). Parar e voltar retoma do ponto em que estava; o tempo
// parado (aba oculta, fora da tela) não conta.

export type LoopDeps = {
  now: () => number;
  requestFrame: (cb: (t: number) => void) => number;
  cancelFrame: (id: number) => void;
};

export type LoopEvents = {
  /** Trocou de slide (sozinho ou por goTo). */
  onChange: (index: number) => void;
  /** Quanto do slide atual já passou, de 0 a 1, a cada quadro e a cada troca. */
  onProgress: (progress: number) => void;
};

export class SlideLoop {
  private index = 0;
  private elapsed = 0;
  private last = 0;
  private frame = 0;
  private playing = false;

  constructor(
    private readonly count: number,
    private readonly duration: number,
    private readonly events: LoopEvents,
    private readonly deps: LoopDeps,
  ) {}

  get current() {
    return this.index;
  }

  get running() {
    return this.playing;
  }

  /** Liga ou desliga. Ligar de novo não duplica o laço; o tempo parado não conta. */
  setPlaying(on: boolean) {
    if (on === this.playing) return;
    this.playing = on;
    if (on) {
      this.last = this.deps.now();
      this.frame = this.deps.requestFrame(this.tick);
    } else {
      this.deps.cancelFrame(this.frame);
      this.frame = 0;
    }
  }

  /** Pula para um slide (clique, toque, teclado); o tempo dele começa do zero e o laço segue. */
  goTo(index: number) {
    this.index = ((index % this.count) + this.count) % this.count;
    this.elapsed = 0;
    this.last = this.deps.now();
    this.events.onChange(this.index);
    this.events.onProgress(0);
  }

  dispose() {
    this.setPlaying(false);
  }

  private tick = (t: number) => {
    if (!this.playing) return;
    // o carimbo do quadro pode vir antes do "agora" de quando o laço ligou
    this.elapsed += Math.max(0, t - this.last);
    this.last = t;
    if (this.elapsed >= this.duration) {
      this.index = (this.index + 1) % this.count;
      this.elapsed = 0;
      this.events.onChange(this.index);
    }
    this.events.onProgress(Math.min(1, this.elapsed / this.duration));
    this.frame = this.deps.requestFrame(this.tick);
  };
}
