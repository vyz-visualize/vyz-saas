// Avatar de um workspace: a logo dele (num fundo claro, para qualquer logo aparecer) ou as
// iniciais na cor dele. Sem logo nem cor, a classe padrão de cada lugar (fallback).

import { initials, textOn } from "./identity";

type Props = {
  name: string;
  color?: string | null;
  logoUrl?: string | null;
  /** Lado em px. */
  size?: number;
  /** Classes de fundo e texto quando o workspace não tem cor. */
  fallback?: string;
  className?: string;
};

export function WorkspaceAvatar({ name, color, logoUrl, size = 36, fallback = "bg-accent text-on-accent", className = "" }: Props) {
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.28) };
  if (logoUrl) {
    return (
      <span aria-hidden className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/10 ${className}`} style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo do workspace (bucket público, tamanho pequeno) */}
        <img src={logoUrl} alt="" draggable={false} className="size-full object-contain" style={{ padding: Math.max(2, Math.round(size * 0.12)) }} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center font-bold ${color ? "" : fallback} ${className}`}
      style={{ ...box, fontSize: Math.max(9, Math.round(size * 0.34)), ...(color ? { background: color, color: textOn(color) } : {}) }}
    >
      {initials(name)}
    </span>
  );
}
