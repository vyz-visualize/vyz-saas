"use client";

import { ArrowRight, Lock, Radio, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/controls";
import { LockBadge, Modal, Tabs } from "@/components/ui/kit";
import { Select } from "@/components/ui/Select";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { PLATFORM_ORDER, PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { LiveDashboardPreview } from "@/features/analytics/LiveDashboardPreview";
import { availableIn, canUse, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { DASHBOARD_CATEGORIES, DASHBOARD_TEMPLATES } from "@/features/templates/dashboards";
import { ALL_DASHBOARD_TEMPLATES, LIVE_TEMPLATES } from "@/features/templates/live";
import { matchesSearch, plain } from "@/features/templates/recommend";
import { PAGES } from "@/features/templates/pages";
import type { DashboardCategory, DashboardTemplate, PageId, SkinId } from "@/features/templates/types";
import { datasetFor, pageLayout } from "./data";
import { SkinView } from "./skins";
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
  const p = page ?? t.pages[0];
  if (t.skin && p === t.pages[0]) {
    return <SkinView skin={t.skin} ctx={makeContext(ds)} name={t.name} client={client} pages={t.pages} active={p} periodLabel="Últimos 30 dias" />;
  }
  return (
    <div className="bg-bg p-3">
      <p className="mb-2 text-[14px] font-bold tracking-[-0.02em]">
        {client} · {PAGES[page ?? t.pages[0]].name}
      </p>
      <PageView layout={pageLayout(t, page ?? t.pages[0])} ctx={makeContext(ds)} variant={variant} />
    </div>
  );
}

/** Miniatura real do modelo (primeira aba), escalada para caber. */
export function TemplateThumb({ t, height = 168 }: { t: DashboardTemplate; height?: number }) {
  const live = t.dataMode === "live";
  return (
    <ScaledPreview height={height} width={live || t.skin ? 1100 : 760}>
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
          <TemplateThumb t={t} />
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
  /** Reabre o popup do assistente (só ao criar). */
  onAskAssistant?: () => void;
  /** Abre já na prévia deste modelo (vindo do assistente). */
  initialOpenId?: string | null;
};

const missingAccount = (t: DashboardTemplate, enabled: GalleryProps["enabledAccounts"]) =>
  t.dataMode === "live" && !t.sources.some((s) => (enabled[s] ?? 0) > 0);

/** Os três modelos com desenho próprio; os demais usam o visual padrão da VYZ. */
const SPECIAL: SkinId[] = ["lavanda", "pulso", "monocromo"];
const isSpecial = (t: DashboardTemplate) => !!t.skin && SPECIAL.includes(t.skin);

/** O que cada categoria resolve, para quem bate o olho na lista. */
const CATEGORY_TEXT: Record<DashboardCategory, string> = {
  "E-commerce": "Receita, ROAS e custo por venda de lojas virtuais e marketplaces.",
  Leads: "Custo por lead, qualidade e o caminho do lead até a venda.",
  Imobiliário: "Leads por empreendimento, visitas e propostas.",
  "Negócio local": "Conversas no WhatsApp, ligações e agendamentos de quem atende na região.",
  Agência: "A carteira de clientes e a saúde das contas num lugar só.",
  Mídia: "Uma plataforma ou um formato em detalhe: campanhas, criativos e vídeo.",
  Executivo: "Resumo para decidir: metas, previsão e comparação entre canais.",
};

/** Plataformas que aparecem em algum modelo, na ordem do produto. */
const PLATFORM_FILTERS = PLATFORM_ORDER.filter((p) => ALL_DASHBOARD_TEMPLATES.some((t) => t.sources.includes(p)));

function Group({ id, title, text, count, children }: { id: string; title: string; text: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="title flex items-baseline gap-2 text-lg">
          {title} <span className="text-[13px] font-normal text-fg-2 tnum">{count}</span>
        </h2>
        <p className="text-[13.5px] text-fg-2">{text}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}

/**
 * Galeria de modelos. Sem filtro, vem organizada em grupos: os que leem as
 * contas conectadas, os três visuais especiais e o padrão VYZ por tipo de
 * negócio. Com filtro (categoria, plataforma, plano ou busca), vira uma lista
 * só com o que combina. A busca ignora acento.
 */
export function TemplateGallery({ tier, enabledAccounts, canCreate, onUse, onAskAssistant, initialOpenId }: GalleryProps) {
  const [category, setCategory] = useState<string>("Todos");
  const [platform, setPlatform] = useState<string>("todas");
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<DashboardTemplate | null>(() => (initialOpenId ? (ALL_DASHBOARD_TEMPLATES.find((t) => t.id === initialOpenId) ?? null) : null));
  const [page, setPage] = useState<PageId | null>(() => open?.pages[0] ?? null);

  const q = plain(query);
  const matchRest = (t: DashboardTemplate) =>
    (platform === "todas" || t.sources.includes(platform as PlatformId)) &&
    (!mine || canUse(tier, t.tier)) &&
    matchesSearch(t, query);
  const match = (t: DashboardTemplate) => (category === "Todos" || t.category === category) && matchRest(t);
  const live = LIVE_TEMPLATES.filter(match);
  const samples = DASHBOARD_TEMPLATES.filter(match);
  const total = live.length + samples.length;
  const filtered = category !== "Todos" || platform !== "todas" || mine || !!q;
  // quantos modelos cada categoria tem com os outros filtros aplicados
  const countIn = (c: string) => ALL_DASHBOARD_TEMPLATES.filter((t) => (c === "Todos" || t.category === c) && matchRest(t)).length;

  const locked = open ? !canUse(tier, open.tier) : false;
  const isLive = open?.dataMode === "live";
  const noAccount = open ? missingAccount(open, enabledAccounts) : false;
  const show = (t: DashboardTemplate) => {
    setOpen(t);
    setPage(t.pages[0]);
  };
  const clear = () => {
    setCategory("Todos");
    setPlatform("todas");
    setMine(false);
    setQuery("");
  };
  const card = (t: DashboardTemplate) => (
    <Card
      key={t.id}
      t={t}
      live={t.dataMode === "live"}
      locked={!canUse(tier, t.tier)}
      note={missingAccount(t, enabledAccounts) ? `Ative uma conta do ${t.sources.map((s) => PLATFORMS[s].name).join(" ou ")} para usar.` : undefined}
      onOpen={() => show(t)}
    />
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-card border border-line bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-field px-3 focus-within:border-accent">
            <Search size={16} aria-hidden className="shrink-0 text-fg-2" />
            <span className="sr-only">Buscar modelo</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, negócio ou plataforma"
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:flex-nowrap">
            <div className="w-52 shrink-0">
              <Select
                ariaLabel="Plataforma"
                size="sm"
                value={platform}
                onChange={setPlatform}
                options={[{ value: "todas", label: "Todas as plataformas" }, ...PLATFORM_FILTERS.map((p) => ({ value: p, label: PLATFORMS[p].name }))]}
              />
            </div>
            <Checkbox label="Só os do meu plano" checked={mine} onChange={setMine} />
            {onAskAssistant && (
              <button type="button" onClick={onAskAssistant} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-accent px-3 text-[13px] font-semibold text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent">
                <Sparkles size={15} aria-hidden /> Pedir ao assistente
              </button>
            )}
          </div>
        </div>
        <div role="radiogroup" aria-label="Tipo de negócio" className="flex flex-wrap gap-1.5">
          {["Todos", ...DASHBOARD_CATEGORIES].map((c) => {
            const n = countIn(c);
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-[13px] transition-colors duration-150 ${category === c ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"} ${n === 0 && category !== c ? "opacity-50" : ""}`}
              >
                {c} <span className="text-[11.5px] tnum opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-fg-2">
          <p aria-live="polite">
            {total === 0 ? "Nenhum modelo com esses filtros." : `${total} ${total === 1 ? "modelo encontrado" : "modelos encontrados"}`}
            {category !== "Todos" && total > 0 ? ` em ${category}. ${CATEGORY_TEXT[category as DashboardCategory]}` : ""}
          </p>
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-control px-2 py-1 font-semibold text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent">
            <X size={14} aria-hidden /> Limpar filtros
          </button>
        </div>
      )}

      {filtered ? (
        total === 0 ? (
          <div className="rounded-card border border-dashed border-line p-8 text-center">
            <p className="text-fg-2">Tente outra palavra ou tire um filtro.</p>
            {onAskAssistant && (
              <button type="button" onClick={onAskAssistant} className={`${btn.small} mt-3`}>
                <Sparkles size={15} aria-hidden /> Pedir ao assistente
              </button>
            )}
          </div>
        ) : (
          // dados reais primeiro, depois os especiais e o padrão
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[...live, ...samples.filter(isSpecial), ...samples.filter((t) => !isSpecial(t))].map(card)}</ul>
        )
      ) : (
        <>
          {live.length > 0 && (
            <Group id="h-live" title="Com os dados das suas contas" count={live.length} text="Leem o que a sincronização traz do Meta Ads e do Google Ads. Na prévia, números simulados.">
              {live.map(card)}
            </Group>
          )}
          <Group id="h-special" title="Visuais especiais" count={samples.filter(isSpecial).length} text="Três modelos com desenho próprio: Lavanda, Pulso e Monocromo. Dados de exemplo.">
            {samples.filter(isSpecial).map(card)}
          </Group>
          {DASHBOARD_CATEGORIES.map((c) => {
            const items = samples.filter((t) => t.category === c && !isSpecial(t));
            if (items.length === 0) return null;
            return (
              <Group key={c} id={`h-${plain(c).replace(/[^a-z]+/g, "-")}`} title={`Padrão VYZ · ${c}`} count={items.length} text={`${CATEGORY_TEXT[c]} Dados de exemplo.`}>
                {items.map(card)}
              </Group>
            );
          })}
        </>
      )}

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
