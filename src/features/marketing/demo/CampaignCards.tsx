"use client";

// As campanhas da demonstração: um card por campanha (empilhados no celular, 3 lado a lado
// no desktop), com investimento, participação, ROAS e CPA, nenhuma coluna cortada. Clicar
// filtra os números, igual à tabela do produto. Só o site usa: a tabela do painel não muda.

import { filterAria, filterTone, useDashFilters } from "@/features/analytics/filter-context";
import { money } from "@/features/analytics/format";
import { CAMPAIGN_ROW_FILTER } from "@/features/analytics/shared";
import type { LiveDashboardData } from "@/features/analytics/types";
import { InlineBar, Panel, Roas } from "@/features/analytics/ui";
import { decimal } from "@/lib/format";

export function CampaignCards({ data, limit, kindLabel }: { data: LiveDashboardData; limit: number; kindLabel: (kind: string | null) => string }) {
  const { view, currency } = data;
  const filters = useDashFilters();
  // a campanha escolhida continua à vista, mesmo fora das primeiras (como na tabela)
  const chosen = filters?.filters.campaigns ?? [];
  const rows = [...view.campaigns.slice(0, limit), ...view.campaigns.slice(limit).filter((c) => chosen.includes(c.id))];
  const breakEven = view.breakEvenRoas;
  return (
    <Panel title="Campanhas que mais investem" subtitle={`Escolha uma campanha para filtrar. ROAS em vermelho fica abaixo do equilíbrio${breakEven ? ` (${decimal(breakEven, 1)})` : " (1,0)"}.`}>
      <ul className="grid gap-2 @[760px]:grid-cols-3" aria-label="Campanhas que mais investem no período">
        {rows.map((c) => {
          const tone = filterTone(filters, CAMPAIGN_ROW_FILTER.dim, c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={tone === "selected"}
                aria-label={filterAria(CAMPAIGN_ROW_FILTER.dim, c.name)}
                onClick={(e) => filters?.toggle(CAMPAIGN_ROW_FILTER.dim, c.id, c.name, e)}
                className={`block h-full w-full rounded-control border p-3 text-left outline-none transition-[border-color,opacity] focus-visible:ring-2 focus-visible:ring-accent ${tone === "selected" ? "border-accent bg-accent-soft/40" : "border-line"} ${tone === "dimmed" ? "opacity-45" : ""}`}
              >
                <span className="line-clamp-2 text-[14px] leading-snug font-medium text-fg">{c.name}</span>
                <span className="block text-[11.5px] text-fg-2">{kindLabel(c.kind)}</span>
                <span className="mt-2 block">
                  <InlineBar share={c.spendShare} label={`${Math.round(c.spendShare * 100)}%`} />
                </span>
                <span className="mt-2 grid grid-cols-[1.3fr_0.8fr_1fr] gap-3 text-[12.5px]">
                  <span>
                    <span className="block text-[10.5px] tracking-[0.04em] text-fg-2 uppercase">Investimento</span>
                    <span className="font-semibold text-fg tnum">{money(c.spend, currency, { decimals: false })}</span>
                  </span>
                  <span>
                    <span className="block text-[10.5px] tracking-[0.06em] text-fg-2 uppercase">ROAS</span>
                    <Roas value={c.roas} breakEven={breakEven} />
                  </span>
                  <span>
                    <span className="block text-[10.5px] tracking-[0.06em] text-fg-2 uppercase">CPA</span>
                    <span className="font-semibold text-fg tnum">{money(c.cpa, currency)}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
