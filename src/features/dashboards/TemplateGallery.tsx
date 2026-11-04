"use client";

import { ArrowRight, Lock, Radio, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LockBadge, Modal, Tabs } from "@/components/ui/kit";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { LiveDashboardPreview } from "@/features/analytics/LiveDashboardPreview";
import { availableIn, canUse, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { DASHBOARD_CATEGORIES, DASHBOARD_TEMPLATES } from "@/features/templates/dashboards";
import { LIVE_TEMPLATES } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { datasetFor, pageLayout } from "./data";
import { PageView } from "./widgets/PageView";
import { makeContext } from "./widgets/Widgets";

const SAMPLE_CLIENT: Record<string, string> = {
  "E-commerce": "Loja Verde",
  Leads: "Escola Aurora",
  Imobiliário: "Incorporadora Sul",
  "Negócio local": "Clínica Sol",
  Agência: "Minha agência",
  Mídia: "Pet Mais",
  Executivo: "Grupo Horizonte",
};

export function TemplatePreview({ t, page, variant = "full" }: { t: DashboardTemplate; page?: PageId; variant?: "full" | "compact" }) {
  const client = SAMPLE_CLIENT[t.category];
  const ds = datasetFor({ templateId: t.id, name: t.name, client }, 30);
  return (
    <div className="bg-bg p-3">
      <p className="mb-2 text-[14px] font-bold tracking-[-0.02em]">
        {client} · {PAGES[page ?? t.pages[0]].name}
      </p>
      <PageView layout={pageLayout(t, page ?? t.pages[0])} ctx={makeContext(ds)} variant={variant} />
    </div>
  );
}

function Card({ t, locked, live, note, onOpen }: { t: DashboardTemplate; locked: boolean; live?: boolean; note?: string; onOpen: () => void }) {
  return (
    <li>
      {/* a prévia real tem abas (botões): o cartão é uma área clicável, não um <button> */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onOpen();
        }}
        className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-card border border-line bg-card text-left transition-colors duration-200 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
      >
        <div className="relative border-b border-line">
          <ScaledPreview height={168} width={live ? 1100 : 760}>
            <div inert>
              {live ? (
                <div className="bg-bg p-4">
                  <LiveDashboardPreview templateId={t.id} pageIds={["visao-geral"]} />
                </div>
              ) : (
                <TemplatePreview t={t} variant="compact" />
              )}
            </div>
          </ScaledPreview>
          {locked && (
            <span className="absolute inset-0 flex items-center justify-center bg-bg/55">
              <span className="inline-flex items-center gap-1.5 rounded-chip bg-card px-3 py-1 text-[12.5px] font-semibold">
                <Lock size={13} aria-hidden /> {availableIn(t.tier)}
              </span>
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="leading-snug font-semibold">{t.name}</p>
            <span
              className={`shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold ${t.tier === "base" ? "border border-line text-fg-2" : "bg-accent-soft text-fg"}`}
            >
              {TIER_LABEL[t.tier]}
            </span>
          </div>
          <p className="line-clamp-2 text-[13px] text-fg-2">{t.description}</p>
          <p className="mt-auto flex flex-wrap gap-1 pt-1">
            {live && (
              <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg">
                <Radio size={11} aria-hidden /> Dados reais
              </span>
            )}
            {t.sources.map((s) => (
              <span key={s} className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-fg-2">
                {PLATFORMS[s].short}
              </span>
            ))}
          </p>
          {note && <p className="text-[12.5px] text-warning">{note}</p>}
        </div>
      </div>
    </li>
  );
}

type GalleryProps = {
  tier: Tier;
  /** Contas ativas por plataforma (templates com dados reais precisam de pelo menos uma). */
  enabledAccounts: Partial<Record<PlatformId, number>>;
  /** viewer não cria. */
  canCreate: boolean;
  onUse: (templateId: string) => void;
};

const missingAccount = (t: DashboardTemplate, enabled: GalleryProps["enabledAccounts"]) =>
  t.dataMode === "live" && !t.sources.some((s) => (enabled[s] ?? 0) > 0);

/**
 * Galeria de templates: primeiro os que leem as contas conectadas (prévia com
 * dados simulados), depois os de exemplo, com filtros, busca e cadeado do plano.
 */
export function TemplateGallery({ tier, enabledAccounts, canCreate, onUse }: GalleryProps) {
  const [category, setCategory] = useState<string>("Todos");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<DashboardTemplate | null>(null);
  const [page, setPage] = useState<PageId | null>(null);

  const match = (t: DashboardTemplate) => {
    const q = query.trim().toLowerCase();
    return (category === "Todos" || t.category === category) && (!q || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q));
  };
  const live = LIVE_TEMPLATES.filter(match);
  const samples = DASHBOARD_TEMPLATES.filter(match);

  const locked = open ? !canUse(tier, open.tier) : false;
  const isLive = open?.dataMode === "live";
  const noAccount = open ? missingAccount(open, enabledAccounts) : false;
  const show = (t: DashboardTemplate) => {
    setOpen(t);
    setPage(t.pages[0]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-1.5">
          {["Todos", ...DASHBOARD_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-chip px-3 py-1.5 text-[13px] transition-colors duration-150 ${category === c ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-control border border-line bg-field px-3 focus-within:border-accent lg:w-72">
          <Search size={16} aria-hidden className="text-fg-2" />
          <span className="sr-only">Buscar template</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar template"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          />
        </label>
      </div>

      {live.length > 0 && (
        <section aria-labelledby="h-live" className="space-y-3">
          <div>
            <h2 id="h-live" className="title text-lg">
              Com os dados das suas contas
            </h2>
            <p className="text-[13.5px] text-fg-2">Leem o que a sincronização traz do Meta Ads e do Google Ads. Na prévia, números simulados.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((t) => (
              <Card
                key={t.id}
                t={t}
                live
                locked={!canUse(tier, t.tier)}
                note={missingAccount(t, enabledAccounts) ? `Ative uma conta do ${t.sources.map((s) => PLATFORMS[s].name).join(" ou ")} para usar.` : undefined}
                onOpen={() => show(t)}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="h-sample" className="space-y-3">
        <div>
          <h2 id="h-sample" className="title text-lg">
            Modelos com dados de exemplo
          </h2>
          <p className="text-[13.5px] text-fg-2">Para apresentar a ideia ao cliente. Os números são fictícios.</p>
        </div>
        {samples.length === 0 ? (
          <p className="rounded-card border border-dashed border-line p-8 text-center text-fg-2">Nenhum template com esse filtro.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {samples.map((t) => (
              <Card key={t.id} t={t} locked={!canUse(tier, t.tier)} onOpen={() => show(t)} />
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""} full={!locked} wide={locked}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-[14px] text-fg-2">{open.description}</p>
              {locked ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LockBadge label={availableIn(open.tier)} />
                  <Link href="/painel/plano" className={btn.small}>
                    Ver planos
                  </Link>
                </div>
              ) : noAccount ? (
                <Link href="/painel/contas" className={`${btn.small} shrink-0`}>
                  Ativar uma conta <ArrowRight size={16} aria-hidden />
                </Link>
              ) : canCreate ? (
                <button type="button" onClick={() => onUse(open.id)} className={`${btn.small} shrink-0`}>
                  Usar este template <ArrowRight size={16} aria-hidden />
                </button>
              ) : (
                <p className="text-[13px] text-fg-2">Peça a um editor do workspace para criar.</p>
              )}
            </div>
            {isLive ? (
              <div className={`rounded-card border border-line bg-bg p-3 sm:p-4 ${locked ? "max-h-[420px] overflow-hidden" : ""}`}>
                <LiveDashboardPreview templateId={open.id} />
              </div>
            ) : (
              <>
                <Tabs
                  label="Páginas do template"
                  value={page ?? open.pages[0]}
                  onChange={setPage}
                  items={open.pages.map((p) => ({ value: p, label: PAGES[p].name }))}
                />
                <div className={`overflow-hidden rounded-card border border-line ${locked ? "max-h-[420px]" : ""}`}>
                  <TemplatePreview t={open} page={page ?? open.pages[0]} />
                </div>
                <p className="text-[12px] text-fg-2">Amostra · dados fictícios</p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
