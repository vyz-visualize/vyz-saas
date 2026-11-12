"use client";

// Passo 2: o layout do dashboard. Galeria com os layouts do nicho primeiro e
// os outros nichos nas abas. Passar o mouse anima a prévia (as páginas do
// dashboard passam sozinhas); no celular, "Ver" abre a prévia grande. Layout
// de plano acima aparece com cadeado e "Liberar no …" (upgrade em Plano).

import { Check, Eye, Lock, Radio, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/kit";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { LiveDashboardPreview } from "@/features/analytics/LiveDashboardPreview";
import { BUSINESS_TYPES, businessType, templateBusinessTypes } from "@/features/catalog/business-types";
import { TemplatePreview } from "@/features/dashboards/TemplatePreview";
import { TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { startingPrice } from "@/features/pricing/pricing";
import { brl } from "@/lib/format";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { chooseLayout } from "@/server/onboarding/actions";
import { FeatureShowcase } from "./FeatureShowcase";
import { layoutOptions, type LayoutOption } from "./steps";
import { StepFooter, StepHeader, useStepAction } from "./ui";

const CYCLE_MS = 1800;

const UPSELL_TIERS: Tier[] = ["pro", "avancado"];

const TIER_PITCH: Partial<Record<Tier, string>> = {
  pro: "Layouts por nicho, galeria de criativos com prévia e até 3 contas de cada plataforma por cliente.",
  avancado: "Todos os layouts e todas as páginas, comparativo de criativos, criativos ao vivo, previsão de KPIs, MMM e o VYZ por voz.",
};

const TIER_PERKS: Partial<Record<Tier, string[]>> = {
  pro: ["Metas e pacing", "Público", "Comparativo de períodos", "Galeria de criativos", "Até 3 contas por plataforma"],
  avancado: ["Todos os layouts", "Produtos e funil completo", "Comparativo de criativos", "Criativos ao vivo", "Previsão de KPIs", "MMM", "VYZ por voz"],
};

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
  nicheName,
  onSelect,
  onOpen,
}: {
  option: LayoutOption;
  selected: boolean;
  /** Nome do nicho da aba (sem: aba Todos). */
  nicheName: string | null;
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
          {option.fits && nicheName && templateBusinessTypes(t.profile).length < BUSINESS_TYPES.length && (
            <span className="inline-flex items-center gap-1 rounded-chip border border-accent/50 px-2 py-0.5 text-[11px] font-medium text-fg">
              <Target size={11} aria-hidden /> Feito para {nicheName}
            </span>
          )}
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
  const nicheName = niche === "todos" ? null : (businessType(niche)?.name ?? null);
  // no plano (em destaque) e, por plano acima, a vitrine do upgrade
  const mine = shown.filter((o) => o.allowed);
  const fitsMine = mine.filter((o) => o.fits).length;
  const upsells = UPSELL_TIERS.map((t) => ({
    tier: t,
    items: (niche === "todos" ? options : layoutOptions(niche, tier).filter((o) => o.fits)).filter((o) => !o.allowed && o.template.tier === t),
  })).filter((u) => u.items.length > 0);
  const [expanded, setExpanded] = useState<Partial<Record<Tier, boolean>>>({});
  const card = (o: LayoutOption) => (
    <LayoutCard
      key={o.template.id}
      option={o}
      selected={chosen === o.template.id}
      nicheName={nicheName}
      onSelect={() => setChosen(o.template.id)}
      onOpen={() => {
        setOpen(o);
        setOpenPage(o.template.pages[0]);
      }}
    />
  );
  const chosenName = options.find((o) => o.template.id === chosen)?.template.name ?? null;

  return (
    <section aria-labelledby="passo-titulo">
      <StepHeader
        eyebrow="Passo 2 · Visual"
        title="Escolha o visual do seu dashboard"
        text={
          <>
            {name ? `Já montamos para ${name}: ` : ""}os números e o funil seguem o seu objetivo. No próximo passo você conecta as contas e o dashboard ganha uma página para
            cada plataforma.
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

      {mine.length === 0 && upsells.length === 0 ? (
        <p className="mt-8 rounded-card border border-dashed border-line p-6 text-[14px] text-fg-2">
          Ainda não há layouts para este nicho. Veja os outros nas abas.
        </p>
      ) : null}

      {mine.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="title flex items-center gap-2 text-[19px] text-fg">
              <Check size={18} aria-hidden className="text-accent" /> No seu plano{tier ? ` · ${TIER_LABEL[tier]}` : ""}
            </h2>
            <p className="text-[13px] text-fg-2">
              {mine.length} {mine.length === 1 ? "layout liberado" : "layouts liberados"}
              {nicheName && fitsMine > 0 ? ` · ${fitsMine} feito${fitsMine === 1 ? "" : "s"} para ${nicheName}` : ""}
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{mine.map(card)}</ul>
        </div>
      )}

      {upsells.map(({ tier: next, items }) => {
        const all = expanded[next];
        const visible = all ? items : items.slice(0, 3);
        const delta = tier && tier !== "personalizado" && next !== "personalizado" ? startingPrice(next, "anual") - startingPrice(tier, "anual") : null;
        return (
          <div
            key={next}
            className="relative mt-10 overflow-hidden rounded-[22px] border border-accent/35 bg-[linear-gradient(140deg,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_55%)] p-5 sm:p-7"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-accent uppercase">
                  <Sparkles size={13} aria-hidden /> Próximo nível
                </p>
                <h2 className="title mt-1.5 text-[22px] text-fg">
                  Mais no {TIER_LABEL[next]}: {items.length} {items.length === 1 ? "layout" : "layouts"}
                  {nicheName ? ` para ${nicheName}` : ""}
                </h2>
                <p className="mt-1.5 text-[14px] text-fg-2">{TIER_PITCH[next]}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {(TIER_PERKS[next] ?? []).map((perk) => (
                    <li key={perk} className="inline-flex items-center gap-1.5 rounded-chip bg-bg/60 px-2.5 py-1 text-[12.5px] text-fg">
                      <Check size={12} aria-hidden className="text-accent" /> {perk}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                <Link href={`/painel/plano?liberar=${next}#h-trocar`} className={btn.primary}>
                  <Lock size={15} aria-hidden /> Liberar no {TIER_LABEL[next]}
                </Link>
                {delta !== null && delta > 0 && <p className="text-[12.5px] text-fg-2 tnum">+ {brl(delta)}/mês no anual</p>}
              </div>
            </div>
            <FeatureShowcase tier={next} />
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(card)}</ul>
            {items.length > 3 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [next]: !all }))}
                className="mt-4 text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline"
              >
                {all ? "Mostrar menos" : `Ver os ${items.length} layouts do ${TIER_LABEL[next]}`}
              </button>
            )}
          </div>
        );
      })}

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
