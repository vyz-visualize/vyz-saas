"use client";

// Vitrine no fim do dashboard: as páginas deste layout que o plano ainda não
// libera, com o gráfico de verdade (dados de exemplo) borrado e o caminho para
// liberar. Some quando o plano já tem todas.

import { Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { Paywall } from "@/components/ui/Paywall";
import { LiveDashboardPreview } from "@/features/analytics/LiveDashboardPreview";
import { canUse, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { anyDashboardTemplate } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { TemplatePreview } from "./TemplateGallery";

export function lockedPagesOf(templateId: string, pagesTier: Tier | null): PageId[] {
  const t = anyDashboardTemplate(templateId);
  if (!t) return [];
  return t.pages.filter((p) => !PAGES[p].soon && !(pagesTier && canUse(pagesTier, PAGES[p].tier)));
}

export function LockedPages({ templateId, tier, pagesTier }: { templateId: string; tier: Tier | null; pagesTier: Tier | null }) {
  const t = anyDashboardTemplate(templateId);
  const locked = lockedPagesOf(templateId, pagesTier);
  const [page, setPage] = useState<PageId | null>(locked[0] ?? null);
  if (!t || locked.length === 0 || !page) return null;
  const spec = PAGES[page];

  return (
    <section aria-labelledby="h-mais-paginas" className="mt-10 space-y-4 border-t border-line pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold tracking-wide text-accent uppercase">
            <Sparkles size={14} aria-hidden /> Mais neste dashboard
          </p>
          <h2 id="h-mais-paginas" className="title mt-1 text-xl text-fg">
            {locked.length === 1 ? "1 página" : `${locked.length} páginas`} esperando um upgrade
          </h2>
        </div>
        <div role="tablist" aria-label="Páginas de outros planos" className="flex flex-wrap gap-2">
          {locked.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === page}
              onClick={() => setPage(p)}
              className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-[13px] transition-colors ${p === page ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
            >
              <Lock size={12} aria-hidden />
              {PAGES[p].name}
              <span className={p === page ? "opacity-80" : "text-fg-2"}>· {TIER_LABEL[PAGES[p].tier]}</span>
            </button>
          ))}
        </div>
      </div>

      <Paywall current={tier} required={PAGES[page].tier} feature={spec.name} text={spec.description}>
        <div className="max-h-[520px] overflow-hidden rounded-card border border-line">
          {t.dataMode === "live" ? (
            <div className="bg-bg p-4">
              <LiveDashboardPreview key={page} templateId={t.id} pageIds={[page]} />
            </div>
          ) : (
            <TemplatePreview key={page} t={t} page={page} />
          )}
        </div>
      </Paywall>
    </section>
  );
}
