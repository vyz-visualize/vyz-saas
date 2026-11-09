// Regras dos slides do hero, sem tela: a ordem, o tempo, o deslizar e quando a troca pausa.

/** Cada slide fica 3 s; depois do último, volta ao primeiro. */
export const SLIDE_MS = 3000;

export const HERO_SLIDES = [
  { id: "visao-geral", label: "Visão geral", short: "Geral", hint: "Arraste no gráfico e o painel inteiro filtra." },
  { id: "criativos", label: "Criativos", short: "Criativos", hint: "Anúncios lado a lado, com o melhor de cada métrica." },
  { id: "agente", label: "Agente VYZ", short: "Agente", hint: "Pergunte sobre os números e ele responde na hora." },
  { id: "link", label: "Link do cliente", short: "Link", hint: "O cliente abre o link e filtra sozinho, sem login." },
] as const;

export const nextSlide = (i: number, n: number = HERO_SLIDES.length) => (i + 1) % n;
export const prevSlide = (i: number, n: number = HERO_SLIDES.length) => (i - 1 + n) % n;

/** Direção do deslizar: 1 = próximo, -1 = anterior, 0 = não foi um deslize na horizontal. */
export function swipeDirection(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export type PauseState = { reduced: boolean; ready: boolean; offscreen: boolean; hidden: boolean };

/**
 * A troca automática roda sempre: mouse, foco e toque não pausam. Só para fora da tela e com a
 * aba oculta (para não gastar processamento). "Reduzir movimento": só pelos botões.
 */
export const autoPlays = (s: PauseState) => !s.reduced && s.ready && !s.offscreen && !s.hidden;
