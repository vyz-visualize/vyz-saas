"use client";

// Bancada da dobra Diferenciais (ver page.dev.tsx), dentro da área (marketing) para ter o
// mesmo layout do site (motion, rolagem suave, tom do texto). As direções moram em
// features/marketing/sections/diferenciais e, escolhida uma, entram no lugar da atual.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Diferenciais } from "@/features/marketing/sections/Diferenciais";
import { CLOSINGS } from "@/features/marketing/sections/diferenciais/copy";
import { DirecaoPassos } from "@/features/marketing/sections/diferenciais/DirecaoPassos";
import { DirecaoPrompt } from "@/features/marketing/sections/diferenciais/DirecaoPrompt";

const DIRS = [
  { id: "1", label: "1 · Prompt × Pronto" },
  { id: "2", label: "2 · Passos" },
  { id: "atual", label: "Atual" },
];

export function Bench() {
  const q = useSearchParams();
  const dir = q.get("direcao") ?? "1";
  const fi = Math.min(CLOSINGS.length, Math.max(1, Number(q.get("frase")) || 1));
  const closing = CLOSINGS[fi - 1];
  const href = (d: string, f: number) => `/dev/diferenciais?direcao=${d}&frase=${f}` as const;
  return (
    <div className="min-h-dvh bg-bg text-fg">
        <nav data-bench-nav className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-4 py-2 text-[13px] backdrop-blur">
          <span className="font-semibold">Diferenciais</span>
          {DIRS.map((d) => (
            <Link key={d.id} href={href(d.id, fi) as never} className={`rounded-chip border px-2.5 py-1 ${dir === d.id ? "border-accent bg-accent text-on-accent" : "border-line"}`}>
              {d.label}
            </Link>
          ))}
          <span className="ml-2 text-fg-2">Frase:</span>
          {CLOSINGS.map((c, i) => (
            <Link key={c} href={href(dir, i + 1) as never} title={c} className={`rounded-chip border px-2.5 py-1 ${fi === i + 1 ? "border-accent bg-accent text-on-accent" : "border-line"}`}>
              {i + 1}
            </Link>
          ))}
        </nav>
        {/* a dobra de cima, só para dar o contexto da rolagem */}
        <div className="flex h-[40vh] items-end border-b border-line px-6 pb-6 text-fg-2">↓ Dobra anterior (Por dentro)</div>
        {dir === "2" ? <DirecaoPassos closing={closing} /> : dir === "atual" ? <Diferenciais /> : <DirecaoPrompt closing={closing} />}
        <div className="flex h-[50vh] items-start border-t border-line px-6 pt-6 text-fg-2">↓ Próxima dobra (Como funciona)</div>
    </div>
  );
}
