"use client";

// O comparativo de criativos no site: só uma prévia. Os 2 anúncios e 4 métricas (com o
// troféu no melhor), com dados fixos de amostra. O resto da tabela fica desfocado e NÃO são
// dados: são linhas genéricas. Nada da lista de métricas, das fórmulas ou da tabela inteira
// vai para o site (nem no JS). Sem "Gerar análise".

import { Lock, Trophy } from "lucide-react";
import { Chip } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { TEASER_ADS as ads, TEASER_ROWS as rows } from "./compare-teaser-data";
import { FORMAT_LABEL, VyzCreative } from "./VyzCreatives";

const COLORS = ["var(--accent)", "#C2703D"] as const;

export function CompareTeaser() {
  return (
    <div className="@container space-y-3">
      <ul className="grid gap-2.5 @[560px]:grid-cols-2">
        {ads.map((ad, i) => (
          <li key={ad.id} className="flex min-w-0 items-stretch overflow-hidden rounded-card border border-line bg-card">
            <span className="w-1.5 shrink-0" style={{ background: COLORS[i] }} aria-hidden />
            <VyzCreative art={ad.art} label={ad.headline} className="w-[84px] shrink-0 self-stretch" />
            <div className="min-w-0 flex-1 space-y-1 p-3">
              <span className="flex flex-wrap gap-1">
                <Chip tone="accent">{ad.objective}</Chip>
                <Chip>{FORMAT_LABEL[ad.format] ?? ad.format}</Chip>
              </span>
              <p className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-fg">{ad.name}</p>
              <p className="truncate text-[11.5px] text-fg-2">{ad.campaign}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="overflow-hidden rounded-card border border-line bg-card">
        <table className="w-full table-fixed border-collapse text-[12.5px] tnum">
          <caption className="sr-only">Prévia do comparativo: 4 métricas dos 2 anúncios</caption>
          <colgroup>
            <col className="w-[34%]" />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-3 py-2 text-left text-[11px] font-medium text-fg-2">
                Métrica
              </th>
              {ads.map((ad, i) => (
                <th key={ad.id} scope="col" className="px-3 py-2 text-right text-[11.5px] font-semibold text-fg">
                  <span className="mb-1 ml-auto block h-1 w-8 rounded-full" style={{ background: COLORS[i] }} aria-hidden />
                  <span className="line-clamp-2 [overflow-wrap:anywhere]">{ad.short}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal text-fg-2">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={ads[i].id} className="px-3 py-2 text-right align-top">
                    <span className={c.best ? "font-semibold text-accent" : "text-fg"}>
                      {c.best && <Trophy size={12} aria-label="Melhor valor" className="mr-1 inline align-[-2px]" />}
                      {c.text}
                    </span>
                    {c.diff && <span className="block text-[10.5px] whitespace-nowrap text-fg-2">{c.diff}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* o resto do comparativo: linhas genéricas desfocadas, sem números de verdade */}
        <div className="relative border-t border-line">
          <div aria-hidden className="space-y-3 px-3 py-4 blur-[3px] select-none">
            {[62, 48, 70, 54].map((w, i) => (
              <div key={i} className="grid grid-cols-[34%_1fr_1fr] items-center gap-3">
                <span className="h-2.5 rounded-full bg-fg/15" style={{ width: `${w}%` }} />
                <span className="ml-auto h-2.5 w-14 rounded-full bg-fg/20" />
                <span className="ml-auto h-2.5 w-12 rounded-full bg-fg/20" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-card/40 p-3">
            <a
              href="#planos"
              onClick={() => track("demo_interacao", { local: "demonstracao", acao: "comparativo_planos" })}
              className="inline-flex items-center gap-2 rounded-chip border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-fg shadow-none outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Lock size={14} aria-hidden className="text-accent" />
              Comparativo completo no plano Avançado
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
