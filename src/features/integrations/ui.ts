// Variações pequenas dos botões do painel (mesma base de components/ui/styles).
// Classes trocadas aqui, não somadas: no Tailwind, a ordem na string não decide
// qual cor vence.

import { btn } from "@/components/ui/styles";

/** Botão pequeno de contorno. */
export const btnSmallOutline = btn.secondary.replace("h-12 px-6", "h-9 px-3.5 text-[13.5px] bg-card");

/** Botão pequeno de ação destrutiva (desconectar, remover). */
export const btnSmallDanger = btn.small.replace("bg-accent text-on-accent", "bg-error text-white");

/** Botão fantasma pequeno (a ação secundária de uma linha ou de um rodapé). */
export const btnSmallGhost = btn.ghost.replace("h-10 px-3", "h-9 px-3 text-[13.5px]");

/** Botão só de ícone (sincronizar, remover): 40 px no toque, 36 px com mouse. Sempre com aria-label. */
export const iconBtn =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-control border border-line bg-card text-fg-2 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 sm:size-9";

/** O mesmo, para remover: o contorno avisa no hover. */
export const iconBtnDanger = `${iconBtn} hover:border-error hover:text-error-fg`;

/** Rodapé de modal: o botão principal vem por último no código; fica à direita no computador e, no celular, em cima e na largura toda. */
export const modalFooter = "flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end max-sm:[&>*]:w-full";

/** Título pequeno de bloco dentro de um modal ou cartão. */
export const subhead = "text-[12px] font-semibold tracking-[0.06em] text-fg-2 uppercase";

/** Aviso de erro dentro de formulário ou modal. */
export const errorBox = "rounded-control border border-error/40 bg-error-soft px-3 py-2.5 text-[13.5px] text-error-fg";
