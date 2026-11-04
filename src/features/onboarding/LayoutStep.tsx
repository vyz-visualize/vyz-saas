"use client";

// Passo 2: o layout do dashboard. Galeria com os layouts do nicho primeiro e
// os outros nichos nas abas. Passar o mouse anima a prévia (as páginas do
// dashboard passam sozinhas); no celular, "Ver" abre a prévia grande. Layout
// de plano acima aparece com cadeado e "Liberar no …" (upgrade em Plano).

import { Check, Eye, Lock, Radio, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/kit";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { LiveDashboardPreview } from "@/features/analytics/LiveDashboardPreview";
import { BUSINESS_TYPES, businessType } from "@/features/catalog/business-types";
import { TemplatePreview } from "@/features/dashboards/TemplateGallery";
import { TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { chooseLayout } from "@/server/onboarding/actions";
import { layoutOptions, type LayoutOption } from "./steps";
import { StepFooter, StepHeader, useStepAction } from "./ui";

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

function Preview({ t, live, page, width }: { t: DashboardTemplate; live: boolean; page: PageId; width: number }) {
  return live ? (
    <div className="bg-bg p-4">
      <LiveDashboardPreview key={page} templateId={t.id} pageIds={[page]} />
    </div>
  ) : (
    <div style={{ width }}>
      <TemplatePreview key={page} t={t} page={page} variant={width > 900 ? "full" : "compact"} />
    </div>
  );
}

function LayoutCard({
  option,
  selected,
  fitsNiche,
  onSelect,
  onOpen,
}: {
  option: LayoutOption;
  selected: boolean;
  fitsNiche: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { template: t, allowed, lockLabel, live } = option;
  const [hover, setHover] = useState(false);
  const page = useCycle(t.pages, hover);
  const width = live ? 1100 : 760;

  return (
    <li
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={`group relative flex flex-col overflow-hidden rounded-card border bg-card transition-[border-color,box-shadow,transform] duration-200 ease-brand ${
        selected ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-line hover:border-accent"
      } ${hover ? "motion-safe:-translate-y-0.5" : ""}`}
    >
      {/* a prévia tem botões próprios (abas): fica inerte dentro de uma área clicável que não é <button> */}
      <div
        role="button"
        tabIndex={0}
        aria-label={allowed ? `Escolher ${t.name}` : `Ver ${t.name}`}
        aria-pressed={allowed ? selected : undefined}
        onClick={allowed ? onSelect : onOpen}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          (allowed ? onSelect : onOpen)();
        }}
        className="relative block cursor-pointer border-b border-line text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <ScaledPreview height={210} width={width}>
          <div inert className={`transition-opacity duration-300 ${hover ? "opacity-100" : "opacity-95"}`}>
            <Preview t={t} live={live} page={page} width={width} />
          </div>
        </ScaledPreview>
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
          {!option.fits && fitsNiche && <span className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-fg-2">Outro nicho</span>}
          <span className="text-[12px] text-fg-2">
            {t.pages.length} {t.pages.length === 1 ? "página" : "páginas"}
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent underline-offset-4 hover:underline"
          >
            <Eye size={13} aria-hidden /> Ver
          </button>
        </div>
      </div>
    </li>
  );
}

export function LayoutStep({ businessTypeId, tier }: { businessTypeId: string | null; tier: Tier | null }) {
  const options = useMemo(() => layoutOptions(businessTypeId, tier), [businessTypeId, tier]);
  const [niche, setNiche] = useState<string>(businessTypeId ?? "todos");
  // no nicho: os dele e, para nunca ficar sem saída, os liberados no plano
  const shown = useMemo(() => (niche === "todos" ? options : layoutOptions(niche, tier).filter((o) => o.fits || o.allowed)), [niche, options, tier]);
  const [chosen, setChosen] = useState<string | null>(
    () => options.find((o) => o.fits && o.allowed)?.template.id ?? options.find((o) => o.allowed)?.template.id ?? null,
  );
  const [open, setOpen] = useState<LayoutOption | null>(null);
  const [openPage, setOpenPage] = useState<PageId | null>(null);
  const { pending, error, run } = useStepAction();
  const name = businessType(businessTypeId)?.name;
  const lockedCount = shown.filter((o) => !o.allowed).length;
  const chosenName = options.find((o) => o.template.id === chosen)?.template.name ?? null;

  return (
    <section aria-labelledby="passo-titulo">
      <StepHeader
        eyebrow="Passo 2 · Layout"
        title="Escolha o layout do seu dashboard"
        text={
          <>
            Passe o mouse para ver o dashboard funcionando. {name ? `Os de ${name} vêm primeiro; ` : ""}troque de nicho nas abas. Depois você cria outros em
            Dashboards.
          </>
        }
      />

      <div role="tablist" aria-label="Nicho" className="mt-6 flex flex-wrap gap-2">
        {[{ id: "todos", name: "Todos" }, ...BUSINESS_TYPES].map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={niche === b.id}
            onClick={() => setNiche(b.id)}
            className={`rounded-chip px-3 py-1.5 text-[13px] transition-colors duration-150 ${niche === b.id ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-card border border-dashed border-line p-6 text-[14px] text-fg-2">
          Ainda não há layouts para este nicho. Veja os outros nas abas.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((o) => (
            <LayoutCard
              key={o.template.id}
              option={o}
              selected={chosen === o.template.id}
              fitsNiche={niche !== "todos"}
              onSelect={() => setChosen(o.template.id)}
              onOpen={() => {
                setOpen(o);
                setOpenPage(o.template.pages[0]);
              }}
            />
          ))}
        </ul>
      )}

      {lockedCount > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-card border border-accent/40 bg-accent-soft/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[14px] text-fg">
            <Sparkles size={17} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            {lockedCount === 1 ? "1 layout é" : `${lockedCount} layouts são`} de um plano acima: páginas de criativos, funil, metas e comparativos.
          </p>
          <Link href="/painel/plano?liberar=pro#h-trocar" className={`${btn.secondary} shrink-0`}>
            Ver planos
          </Link>
        </div>
      )}

      <StepFooter
        back="business"
        pending={pending}
        error={error}
        disabled={!chosen}
        continueLabel="Usar este layout"
        aside={
          chosenName ? (
            <span className="hidden text-[13px] text-fg-2 sm:inline">
              Escolhido: <strong className="font-semibold text-fg">{chosenName}</strong>
            </span>
          ) : null
        }
        pendingLabel="Montando o dashboard…"
        onContinue={() => chosen && run(() => chooseLayout(chosen))}
      />

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.template.name ?? "Layout"} full>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {open.template.pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOpenPage(p)}
                  className={`rounded-chip px-3 py-1 text-[13px] ${openPage === p ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
                >
                  {PAGES[p].name}
                </button>
              ))}
              <span className="ml-auto">
                {open.allowed ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(open.template.id);
                      setOpen(null);
                    }}
                    className={btn.small}
                  >
                    Escolher este layout
                  </button>
                ) : (
                  <Link href={`/painel/plano?liberar=${open.template.tier}#h-trocar`} className={btn.small}>
                    <Lock size={14} aria-hidden /> Liberar no {TIER_LABEL[open.template.tier]}
                  </Link>
                )}
              </span>
            </div>
            <div className="overflow-hidden rounded-card border border-line">
              <Preview t={open.template} live={open.live} page={openPage ?? open.template.pages[0]} width={1200} />
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
