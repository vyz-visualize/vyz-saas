// Botão "Ver post": abre o post original do criativo ou do conteúdo (Instagram, Facebook,
// YouTube, TikTok), numa aba nova. Só com endereço https de uma dessas redes; sem ele, nada.

import { ExternalLink } from "lucide-react";

const PLACES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/i, "Instagram"],
  // amostra: "instagram.<loja>.example" (domínio reservado, nunca um post real de ninguém)
  [/^instagram\.[a-z0-9-]+\.example$/i, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i, "Facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "YouTube"],
  [/(^|\.)tiktok\.com$/i, "TikTok"],
];

/** A rede do post pelo endereço (null: endereço que não é de post de rede social, ou não é https). */
export function postPlace(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return PLACES.find(([re]) => re.test(u.hostname))?.[1] ?? null;
  } catch {
    return null;
  }
}

export function PostLink({ url, compact = false, short = false, className = "" }: { url: string | null | undefined; /** Só o ícone (tabelas apertadas). */ compact?: boolean; /** "Ver post" (a rede vai no tooltip): cards estreitos. */ short?: boolean; className?: string }) {
  const place = postPlace(url);
  if (!place || !url) return null;
  const text = `Ver post no ${place}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`${text} (abre em outra aba)`}
      title={text}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-fg-2 outline-none transition-colors hover:border-fg-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      data-post-link
    >
      <ExternalLink size={12} aria-hidden />
      {!compact && <span className="whitespace-nowrap">{short ? "Ver post" : text}</span>}
    </a>
  );
}
