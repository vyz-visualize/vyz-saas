"use client";

// A prévia do dashboard se montando: os cards entram, a linha se desenha e o funil cresce.
// Sem números: no primeiro acesso nada de valor inventado aparece (os números reais chegam
// quando o dashboard abre). O nome do cliente vai no topo.

import { Wordmark } from "@/components/brand/Wordmark";

const KPIS = ["Investimento", "Receita", "ROAS", "Vendas"];
const LINE = "M0,70 C30,62 50,40 80,46 C110,52 130,30 160,26 C190,22 210,38 240,30 C270,22 290,12 320,10";

export function BuildPreview({ client, compact = false, delay = 0 }: { client: string; compact?: boolean; delay?: number }) {
  const at = (ms: number) => `${delay + ms}ms`;
  return (
    <div className={`fa-anim w-full rounded-[18px] border border-line bg-card shadow-[0_30px_70px_rgba(0,0,0,0.3)] ${compact ? "p-2.5" : "p-4 sm:p-5"}`} aria-hidden data-build-preview>
      <div className="flex items-center justify-between gap-2">
        <span className={`${compact ? "w-9" : "w-12"} shrink-0 text-accent`}>
          <Wordmark />
        </span>
        <span className="fa-pop truncate rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg" style={{ animationDelay: at(150) }} data-client-chip>
          {client} · Visão geral
        </span>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
        {KPIS.map((k, i) => (
          <div key={k} className={`fa-pop rounded-[10px] border p-2 ${i === 2 ? "border-transparent bg-accent text-on-accent" : "border-line bg-bg/50"}`} style={{ animationDelay: at(300 + i * 200) }}>
            <p className={`truncate text-[9px] tracking-[0.08em] uppercase ${i === 2 ? "" : "text-fg-2"}`}>{k}</p>
            <span className={`mt-1.5 block h-2.5 rounded-full ${i === 2 ? "bg-on-accent/50" : "bg-fg-2/30"}`} style={{ width: `${70 - i * 8}%` }} />
          </div>
        ))}
      </div>
      {!compact && (
        // o gráfico e o funil já aparecem em esqueleto (nada de bloco vazio) e se formam por cima
        <div className="mt-2 grid grid-cols-[2fr_1fr] gap-2">
          <div className="rounded-[10px] border border-line bg-bg/50 p-2.5" data-skeleton="linha">
            <p className="text-[10px] text-fg-2">Custo por venda · média móvel 7 dias</p>
            <svg viewBox="0 0 320 80" className="mt-1 h-[64px] w-full" preserveAspectRatio="none">
              <path d={LINE} fill="none" stroke="var(--line)" strokeWidth="2.5" strokeDasharray="5 6" />
              <path d={LINE} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="420" strokeDashoffset="420" style={{ animation: `fa-draw 1100ms ${at(900)} var(--ease) forwards` }} />
            </svg>
          </div>
          <div className="space-y-1.5 rounded-[10px] border border-line bg-bg/50 p-2.5" data-skeleton="funil">
            <p className="text-[10px] text-fg-2">Funil</p>
            {[100, 62, 38, 21].map((w, i) => (
              <span key={w} className="relative block h-2 rounded-full bg-line/70" style={{ width: `${w}%` }}>
                <span className="absolute inset-0 origin-left rounded-full bg-accent" style={{ opacity: 1 - i * 0.18, animation: `fa-growx 600ms ${at(1100 + i * 150)} var(--ease) both` }} />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
