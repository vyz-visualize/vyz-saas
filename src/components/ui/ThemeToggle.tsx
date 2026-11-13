"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "vyz-theme";
type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Troca o tema (também usado pelo assistente VYZ). */
export function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

/** Troca o tema com a faixa do corte varrendo a tela de cima a baixo. */
function switchTheme(next: Theme) {
  const doc = document as ViewTransitionDoc;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) {
    setTheme(next);
    return;
  }
  let band: HTMLDivElement | null = null;
  const vt = doc.startViewTransition(() => {
    setTheme(next);
    band = document.createElement("div");
    band.className = "theme-band";
    band.setAttribute("aria-hidden", "true");
    document.body.appendChild(band);
  });
  const duration = 720;
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"] },
      { duration, easing, pseudoElement: "::view-transition-new(root)" },
    );
    band?.animate(
      { transform: ["translateY(-8px)", `translateY(${window.innerHeight}px)`] },
      { duration, easing, fill: "forwards" },
    );
  });
  vt.finished.finally(() => band?.remove());
}

/** Tema atual (acompanha a troca feita em qualquer lugar da tela). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
}

/** ghost = sem borda, para barras de ferramenta (painel). */
export function ThemeToggle({ className = "", ghost = false }: { className?: string; ghost?: boolean }) {
  const isDark = useTheme() === "dark";
  return (
    <button
      type="button"
      onClick={() => switchTheme(isDark ? "light" : "dark")}
      aria-pressed={isDark}
      aria-label="Modo escuro"
      title={isDark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      className={`inline-flex size-10 items-center justify-center rounded-control transition-colors duration-150 ${ghost ? "text-fg-2 hover:bg-surface-2 hover:text-fg" : "border border-line text-fg hover:border-accent hover:text-accent"} ${className}`}
    >
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
