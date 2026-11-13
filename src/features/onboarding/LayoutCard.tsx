"use client";

// Cartão de um modelo (visual) do dashboard: prévia que anima ao passar o
// mouse (as páginas passam sozinhas), nome, plano e páginas. Usado no passo
// "Contas e modelo" do primeiro acesso.

import { Check, Eye, Lock, Radio, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { LiveDashboardPreview } from "@/features/analytics/LiveDashboardPreview";
import { BUSINESS_TYPES, templateBusinessTypes } from "@/features/catalog/business-types";
import { TemplatePreview } from "@/features/dashboards/TemplatePreview";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { useDeferred } from "./stage/useDeferred";
import type { LayoutOption } from "./steps";

const CYCLE_MS = 1800;

/** Páginas que passam sozinhas enquanto `playing` (sem movimento se o sistema pede). */
function useCycle(pages: readonly PageId[], playing: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!playing || pages.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % pages.length), CYCLE_MS);
    return () => {
      window.clearInterval(id);
      setI(0);
    };
  }, [playing, pages.length]);
  return pages[playing ? i : 0];
}

function Preview({ t, live, page, width, client }: { t: DashboardTemplate; live: boolean; page: PageId; width: number; client?: string }) {
  return live ? (
    <div className="bg-bg p-4">
      <LiveDashboardPreview key={page} templateId={t.id} pageIds={[page]} />
    </div>
  ) : (
    <div style={{ width }}>
      <TemplatePreview key={page} t={t} page={page} variant={width > 900 ? "full" : "compact"} client={client} />
    </div>
  );
}

/** O lugar da prévia enquanto ela não entra: blocos no formato do dashboard, sem números. */
function PreviewSkeleton() {
  return (
    <div aria-hidden data-preview-skeleton className="h-[210px] space-y-2 bg-bg/40 p-3">
      <span className="block h-3 w-2/5 rounded-full bg-line/80" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`block h-12 rounded-[8px] ${i === 2 ? "bg-accent/35" : "bg-line/60"}`} />
        ))}
      </div>
      <span className="block h-[104px] rounded-[8px] bg-line/40" />
    </div>
  );
}

export function LayoutCard({
  option,
  selected,
  nicheName,
  onSelect,
  onOpen,
  client,
  defer,
}: {
  option: LayoutOption;
  selected: boolean;
  /** Nome do nicho da aba (sem: aba Todos). */
  nicheName: string | null;
  onSelect: () => void;
  /** Abre a prévia grande (sem: o cartão não mostra "Ver"). */
  onOpen?: () => void;
  /** Nome do cliente na prévia (primeiro acesso). */
  client?: string;
  /** Prévia adiada (primeiro acesso): o cartão aparece na hora com esqueleto e a prévia entra na ordem dada. */
  defer?: number;
}) {
  // sem defer: na hora; com defer, depois do primeiro desenho (o passo abre sem esperar as prévias)
  const deferred = useDeferred(defer ?? 0);
  const ready = defer === undefined || deferred;
  const { template: t, allowed, lockLabel, live } = option;
  const [hover, setHover] = useState(false);
  const page = useCycle(t.pages, hover);
  const width = live ? 1100 : 760;

  return (
    <li
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={`group relative flex flex-col overflow-hidden rounded-card border transition-[border-color,box-shadow,transform] duration-200 ease-brand ${
        allowed ? "bg-card" : "bg-card/70"
      } ${selected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : allowed ? "border-line hover:border-accent" : "border-line/70 hover:border-accent/70"} ${
        hover ? "motion-safe:-translate-y-0.5" : ""
      }`}
    >
      {/* a prévia tem botões próprios (abas): fica inerte dentro de uma área clicável que não é <button> */}
      <div
        role="button"
        tabIndex={0}
        aria-label={allowed ? `Escolher ${t.name}` : `Ver ${t.name}`}
        aria-pressed={allowed ? selected : undefined}
        onClick={allowed ? onSelect : () => onOpen?.()}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          if (allowed) onSelect();
          else onOpen?.();
        }}
        className="relative block cursor-pointer border-b border-line text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        {ready ? (
          <ScaledPreview height={210} width={width}>
            <div inert className={`transition-opacity duration-300 ${hover ? "opacity-100" : "opacity-95"}`}>
              <Preview t={t} live={live} page={page} width={width} client={client} />
            </div>
          </ScaledPreview>
        ) : (
          <PreviewSkeleton />
        )}
        {hover && t.pages.length > 1 && (
          <span className="absolute top-2 left-2 rounded-chip bg-bg/90 px-2 py-0.5 text-[11.5px] font-medium text-fg backdrop-blur">{PAGES[page].name}</span>
        )}
        {!allowed && (
          <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-bg/90 via-bg/30 to-transparent p-3">
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-card px-3 py-1 text-[12.5px] font-semibold text-fg shadow">
              <Lock size={13} aria-hidden /> {lockLabel}
            </span>
          </span>
        )}
        {selected && (
          <span className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
            <Check size={16} strokeWidth={3} aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="leading-snug font-semibold text-fg">{t.name}</p>
          <span
            className={`shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold ${t.tier === "base" ? "border border-line text-fg-2" : "bg-accent-soft text-fg"}`}
          >
            {TIER_LABEL[t.tier]}
          </span>
        </div>
        <p className="line-clamp-2 text-[13px] text-fg-2">{t.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {live && (
            <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg">
              <Radio size={11} aria-hidden /> Dados reais
            </span>
          )}
          {option.fits && nicheName && templateBusinessTypes(t.profile).length < BUSINESS_TYPES.length && (
            <span className="inline-flex items-center gap-1 rounded-chip border border-accent/50 px-2 py-0.5 text-[11px] font-medium text-fg">
              <Target size={11} aria-hidden /> Feito para {nicheName}
            </span>
          )}
          <span className="text-[12px] text-fg-2">
            {t.pages.length} {t.pages.length === 1 ? "página" : "páginas"}
          </span>
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline"
            >
              <Eye size={13} aria-hidden /> Ver
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
