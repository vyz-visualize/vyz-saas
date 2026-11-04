// O voo dos cards (técnica FLIP): mede onde tudo está, aplica a mudança, mede de novo e
// anima a diferença. Com "Reduzir movimento", só aparece e some.

import { flushSync } from "react-dom";

const DURATION = 320;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const canAnimate = () => typeof window !== "undefined" && typeof Element.prototype.animate === "function" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-edit-metric]")];
const trayCard = (id: string) => document.querySelector<HTMLElement>(`[data-tray-metric="${CSS.escape(id)}"]`);

export function flipChange(change: () => void, opts: { added?: string; removed?: string } = {}) {
  if (!canAnimate()) return change();
  const before = new Map(cards().map((el) => [el.dataset.editMetric!, el.getBoundingClientRect()]));
  const from = opts.added ? trayCard(opts.added)?.getBoundingClientRect() : undefined;
  const leaving = opts.removed ? cards().find((el) => el.dataset.editMetric === opts.removed) : undefined;
  const ghost = leaving?.cloneNode(true) as HTMLElement | undefined;
  const ghostRect = leaving?.getBoundingClientRect();

  flushSync(change);

  for (const el of cards()) {
    const id = el.dataset.editMetric!;
    const now = el.getBoundingClientRect();
    const start = id === opts.added ? from : before.get(id);
    if (!start) continue;
    const dx = start.left - now.left;
    const dy = start.top - now.top;
    if (id !== opts.added && Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    const scale = id === opts.added && now.width ? `scale(${start.width / now.width})` : "";
    el.animate([{ transform: `translate(${dx}px, ${dy}px) ${scale}`, transformOrigin: "top left" }, { transform: "none", transformOrigin: "top left" }], { duration: DURATION, easing: EASE });
  }

  if (ghost && ghostRect && opts.removed) {
    const target = trayCard(opts.removed)?.getBoundingClientRect() ?? document.querySelector("[data-metric-tray]")?.getBoundingClientRect();
    Object.assign(ghost.style, { position: "fixed", left: `${ghostRect.left}px`, top: `${ghostRect.top}px`, width: `${ghostRect.width}px`, height: `${ghostRect.height}px`, margin: "0", zIndex: "120", pointerEvents: "none" });
    ghost.removeAttribute("data-edit-metric");
    ghost.removeAttribute("data-vyz-metric");
    ghost.setAttribute("aria-hidden", "true");
    document.body.append(ghost);
    const dx = target ? target.left - ghostRect.left : 0;
    const dy = target ? target.top - ghostRect.top : 80;
    const fly = ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0 }], { duration: DURATION, easing: EASE });
    fly.onfinish = fly.oncancel = () => ghost.remove();
  }
}
