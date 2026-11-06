// Quando a intro do site toca. Fica em lib porque o script do <head> (layout raiz) usa o
// texto desta função antes de qualquer JS da página, e o layout raiz não importa do site.

export const INTRO_KEY = "vyz-intro";

export type IntroVisit = { pathname: string; search: string; hash: string; seen: boolean; reducedMotion: boolean };

/**
 * A intro só toca na primeira visita à home. Quem chega de campanha (utm_), com âncora
 * ou com "reduzir movimento" vai direto ao conteúdo. Autocontida de propósito: o script
 * do <head> usa o texto desta função.
 */
export function shouldPlayIntro(v: IntroVisit): boolean {
  return v.pathname === "/" && !v.seen && !v.hash && !v.reducedMotion && !/[?&]utm_[a-z]+=/i.test(v.search);
}
