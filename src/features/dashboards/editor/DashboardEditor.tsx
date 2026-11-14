"use client";

// Editor do dashboard: o próprio dashboard no centro (com o Personalizar de sempre:
// grade, métricas e "Alinhar grade") e um painel ao lado com Contas, Páginas,
// Recursos, Metas e Marca e ajustes. Tudo fica no rascunho até o Salvar; quem grava
// é o servidor (updateDashboard), que confere plano, páginas e contas de novo.

import { ArrowDown, GripVertical, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { ColorField } from "@/components/ui/ColorField";
import { FileInput } from "@/components/ui/FileInput";
import { Checkbox, LockBadge, SelectField, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { isImportPlatform } from "@/features/accounts/connection-modes";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import type { Dataset } from "@/features/metrics/source";
import type { MetricId } from "@/features/metrics/definitions";
import { availableIn, canUse, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { composePages, FEATURES, featureFits, type FeatureId } from "@/features/templates/dashboards/composed";
import { anyDashboardTemplate, REAL_DATA_PLATFORMS, usesAccounts } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { ATTRIBUTIONS, PERIODS, type PeriodId } from "@/features/workspace/types";
import { saveDashboardLayout, saveDashboardMetricPrefs, updateDashboard } from "@/server/dashboards/actions";
import { removeBrandLogo, updateWorkspace, uploadBrandLogo } from "@/server/workspace/actions";
import { DashboardBody } from "../DashboardBody";
import { pageLayout } from "../data";
import type { MetricGoal } from "../goals";
import { pageOptions, type DashboardDetail, type SourceOption } from "../model";
import type { DashboardFields } from "../schema";
import type { SourceExtras } from "../SourcePages";
import { featuresOf, recompose } from "./draft";
import { GoalsPanel } from "./GoalsPanel";

type TabId = "contas" | "paginas" | "recursos" | "metas" | "marca";
const TABS: { id: TabId; label: string }[] = [
  { id: "contas", label: "Contas" },
  { id: "paginas", label: "Páginas" },
  { id: "recursos", label: "Recursos" },
  { id: "metas", label: "Metas" },
  { id: "marca", label: "Marca e ajustes" },
];

type Draft = Omit<DashboardFields, "pages" | "metricGoals"> & { pages: PageId[]; metricGoals: MetricGoal[] };

export function draftFrom(d: DashboardDetail): Draft {
  return {
    name: d.name,
    client: d.client,
    goal: d.settings.goal,
    budget: d.settings.budget,
    margin: d.margin,
    period: d.settings.period,
    customDays: d.settings.customDays,
    attribution: d.settings.attribution,
    pages: d.pages,
    accountIds: d.sources.map((s) => s.id),
    brandColor: d.brand?.color || null,
    hideVyz: !!d.brand?.hideVyz,
    metricGoals: d.metricGoals,
  };
}

/** Plataformas das contas marcadas. */
const platformsOf = (ids: readonly string[], sources: readonly SourceOption[]) => [...new Set(sources.filter((s) => ids.includes(s.id)).map((s) => s.platformId))];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const reais = (cents: number) => (cents ? String(Math.round(cents / 100)) : "");
const cents = (v: string) => Math.round((Number(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
const roas = (margin: number) => (1 / margin).toFixed(1).replace(".", ",");

type Props = {
  dashboard: DashboardDetail;
  sources: SourceOption[];
  tier: Tier;
  pagesTier: Tier;
  whiteLabel: boolean;
  canArrange: boolean;
  /** Logo e cor da empresa (todos os planos). Trocar exige admin. */
  workspaceBrand: { color: string; logoUrl: string | null; hideVyz: boolean; canEdit: boolean };
  /** Números das contas já ligadas, para a prévia. */
  preview: { realData?: Dataset; linkedPlatforms?: PlatformId[]; sourceExtras?: SourceExtras };
  /** Logo do workspace (cliente) do dashboard: entra no lugar da logo da empresa; troca nos Ajustes dele. */
  clientLogo?: { url: string; workspace: string; href: string } | null;
};

export function DashboardEditor({ dashboard, sources, tier, pagesTier, whiteLabel, canArrange, workspaceBrand, preview, clientLogo = null }: Props) {
  const router = useRouter();
  const t = anyDashboardTemplate(dashboard.templateId);
  const initial = useMemo(() => draftFrom(dashboard), [dashboard]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [tab, setTab] = useState<TabId>(t && usesAccounts(t) ? "contas" : "paginas");
  const [color, setColor] = useState(workspaceBrand.color);
  const [logo, setLogo] = useState<string | null>(workspaceBrand.logoUrl);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandBusy, startBrand] = useTransition();
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [pending, start] = useTransition();
  const [dragging, setDragging] = useState<number | null>(null);
  const save = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || color.toLowerCase() !== workspaceBrand.color.toLowerCase();
  // sair com mudança não salva: o navegador pergunta
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  if (!t) return <p className="text-fg-2">Template não encontrado.</p>;
  const composed = !!t.composed;
  const pickAccounts = usesAccounts(t);
  const linkable = sources.filter((s) => t.sources.includes(s.platformId) || isImportPlatform(s.platformId)).filter((s) => (REAL_DATA_PLATFORMS as readonly string[]).includes(s.platformId) || isImportPlatform(s.platformId));
  const platforms = platformsOf(draft.accountIds, sources);
  const features = featuresOf(draft.pages);
  const profile = t.profile;
  const isLeadProfile = ["leads", "imob", "saude", "educacao", "infoproduto"].includes(profile);

  function setAccounts(accountIds: string[]) {
    save({ accountIds, ...(composed ? { pages: recompose(t!, pagesTier, draft.pages, platformsOf(accountIds, sources), features) } : {}) });
  }
  function setFeature(id: FeatureId, on: boolean) {
    const next = on ? [...features, id] : features.filter((f) => f !== id);
    save({ pages: recompose(t!, pagesTier, draft.pages, platforms, next) });
  }
  function move(i: number, j: number) {
    if (j < 0 || j >= draft.pages.length || i === j) return;
    const next = [...draft.pages];
    const [it] = next.splice(i, 1);
    next.splice(j, 0, it);
    save({ pages: next });
  }

  // páginas que valem para as contas e os recursos (modelos novos); recursos ficam na aba deles
  const fitting = composed ? new Set<string>([...composePages(platforms, features), ...draft.pages]) : null;
  const featureIds = new Set<string>(FEATURES.map((f) => f.id));
  const pageChoices = pageOptions(t, pagesTier).filter((o) => (!fitting || fitting.has(o.id)) && !(composed && featureIds.has(o.id)));

  // KPIs que aparecem nos cards das páginas escolhidas (as metas por métrica partem deles)
  const kpis = [...new Set(draft.pages.flatMap((p) => pageLayout(t, p).kpis.map((k) => k.metric)))] as MetricId[];

  function submit() {
    setError(null);
    const fields: DashboardFields = {
      name: draft.name.trim() || t!.name,
      client: draft.client.trim(),
      goal: draft.goal,
      budget: draft.budget,
      margin: draft.margin,
      period: draft.period,
      customDays: draft.customDays,
      attribution: draft.attribution,
      pages: draft.pages,
      accountIds: pickAccounts ? draft.accountIds : [],
      brandColor: whiteLabel ? draft.brandColor : null,
      hideVyz: whiteLabel ? draft.hideVyz : false,
      metricGoals: draft.metricGoals.filter((g) => g.value > 0),
    };
    start(async () => {
      if (workspaceBrand.canEdit && color.toLowerCase() !== workspaceBrand.color.toLowerCase()) {
        const b = await updateWorkspace({ brandColor: color });
        if (!b.ok) return setError(b.error);
      }
      const r = await updateDashboard(dashboard.id, fields);
      // sucesso redireciona para o dashboard; aqui só chegam os erros
      if (r && !r.ok) setError(r.error);
    });
  }

  function cancel() {
    if (dirty && !window.confirm("Sair sem salvar? As mudanças deste editor se perdem.")) return;
    router.push(`/painel/dashboards/${dashboard.id}`);
  }

  function sendLogo(file: File) {
    setBrandError(null);
    const fd = new FormData();
    fd.set("logo", file);
    startBrand(async () => {
      const r = await uploadBrandLogo(fd);
      if (r.ok) setLogo(r.data.url);
      else setBrandError(r.error.message);
    });
  }

  // a prévia: o rascunho desenhado com os números das contas salvas (contas trocadas mostram a amostra até salvar)
  const sameAccounts = sameSet(draft.accountIds, initial.accountIds);
  const previewColor = (whiteLabel && draft.brandColor) || color || "";
  const spec = {
    id: dashboard.id,
    templateId: dashboard.templateId,
    name: draft.name.trim() || t.name,
    client: draft.client,
    pages: draft.pages.length ? draft.pages : dashboard.pages,
    settings: { ...dashboard.settings, goal: draft.goal, budget: draft.budget, margin: draft.margin ?? 0, period: draft.period, customDays: draft.customDays, attribution: draft.attribution },
    metricPrefs: dashboard.metricPrefs,
    layout: dashboard.layout,
    metricGoals: draft.metricGoals.filter((g) => g.value > 0),
    brand: { color: previewColor, logo: clientLogo?.url ?? logo ?? undefined, hideVyz: whiteLabel && (workspaceBrand.hideVyz || draft.hideVyz) },
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-card/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[12px] text-fg-2">Editando dashboard</p>
          <h1 className="title truncate text-lg">{spec.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="hidden rounded-chip bg-warning/15 px-2 py-0.5 text-[12px] sm:inline">Mudanças não salvas</span>}
          <button type="button" onClick={cancel} className={`${btn.ghost} h-10`} disabled={pending}>
            Cancelar
          </button>
          <button type="button" onClick={submit} className={btn.small} disabled={pending || draft.pages.length === 0}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13.5px] text-error-fg">
          {error.message}
          {error.fields && Object.values(error.fields).length > 0 && ` ${Object.values(error.fields).join(" ")}`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 rounded-card border border-line bg-bg p-3 sm:p-4">
          <p className="mb-3 text-[12.5px] text-fg-2">Prévia ao vivo. No Personalizar, métricas e blocos da grade são salvos na hora; o resto só no Salvar.</p>
          <DashboardBody
            key={`${draft.period}:${draft.customDays}:${draft.pages.join()}`}
            spec={spec}
            dataset={sameAccounts ? preview.realData : undefined}
            sourceExtras={sameAccounts ? preview.sourceExtras : undefined}
            linkedPlatforms={sameAccounts ? preview.linkedPlatforms : (platforms as PlatformId[])}
            customizeId={dashboard.id}
            saveMetrics={saveDashboardMetricPrefs}
            saveLayout={saveDashboardLayout}
            canArrange={canArrange}
          />
        </div>

        <aside className="rounded-card border border-line bg-card lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-hidden lg:flex lg:flex-col" aria-label="Ajustes do dashboard">
          <div role="tablist" aria-label="Seções do editor" className="flex gap-1 overflow-x-auto border-b border-line p-2">
            {TABS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`tab-${x.id}`}
                aria-selected={tab === x.id}
                aria-controls={`panel-${x.id}`}
                onClick={() => setTab(x.id)}
                className={`shrink-0 rounded-control px-2.5 py-1.5 text-[13px] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${tab === x.id ? "bg-accent-soft font-semibold text-fg" : "text-fg-2 hover:text-fg"}`}
              >
                {x.label}
                {x.id === "metas" && draft.metricGoals.length > 0 && <span className="ml-1 tnum text-fg-2">{draft.metricGoals.length}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "contas" && (
              <Panel title="Contas" text={pickAccounts ? "Os números das contas marcadas são somados. Trocar as contas monta as páginas de novo." : "Este modelo usa dados de exemplo e não lê contas."}>
                {pickAccounts && (linkable.length === 0 ? (
                  <div className="space-y-2 rounded-control border border-dashed border-line p-3 text-[13.5px]">
                    <p className="text-fg-2">Nenhuma conta conectada ainda.</p>
                    <Link href="/painel/contas" className={btn.small}>
                      Conectar em Contas
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[...new Set(linkable.map((s) => s.platformId))].map((pid) => (
                      <section key={pid} className="space-y-2">
                        <h3 className="flex items-center gap-2 text-[13px] font-semibold">
                          <PlatformIcon id={pid} size={22} />
                          {PLATFORMS[pid].name}
                          <span className="font-normal text-fg-2 tnum">{linkable.filter((s) => s.platformId === pid && draft.accountIds.includes(s.id)).length || ""}</span>
                        </h3>
                        <ul className="space-y-1.5">
                          {linkable
                            .filter((s) => s.platformId === pid)
                            .map((a) => {
                              const linked = initial.accountIds.includes(a.id);
                              const off = !a.isEnabled && !linked;
                              return (
                                <li key={a.id} className={`rounded-control border border-line bg-bg p-2.5 ${off ? "opacity-70" : ""}`}>
                                  <Checkbox
                                    label={<span className="font-medium">{a.name}</span>}
                                    hint={[a.businessName, a.isEnabled ? (a.lastSyncedAt ? "ativa" : "ativa · importando") : linked ? "desativada · os dados já importados continuam" : "desativada · ative em Contas"].filter(Boolean).join(" · ")}
                                    checked={draft.accountIds.includes(a.id)}
                                    disabled={off}
                                    onChange={(on) => setAccounts(on ? [...draft.accountIds, a.id] : draft.accountIds.filter((x) => x !== a.id))}
                                  />
                                </li>
                              );
                            })}
                        </ul>
                      </section>
                    ))}
                    {draft.accountIds.length === 0 && <p className="text-[12.5px] text-fg-2">Sem conta marcada, o dashboard mostra dados de exemplo.</p>}
                  </div>
                ))}
              </Panel>
            )}

            {tab === "paginas" && (
              <Panel title="Páginas" text={composed ? "Só as páginas das plataformas ligadas. Arraste ou use as setas para mudar a ordem das abas." : "Arraste ou use as setas para mudar a ordem das abas."}>
                <ol className="space-y-1.5">
                  {draft.pages.map((p, i) => (
                    <li
                      key={p}
                      draggable
                      onDragStart={() => setDragging(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragging !== null) move(dragging, i);
                        setDragging(null);
                      }}
                      className="flex items-center gap-2 rounded-control border border-line bg-bg p-2 text-[13.5px]"
                    >
                      <GripVertical size={15} aria-hidden className="cursor-grab text-fg-2" />
                      <span className="w-5 text-fg-2 tnum">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{PAGES[p].name}</span>
                      <IconButton label={`Subir ${PAGES[p].name}`} onClick={() => move(i, i - 1)} disabled={i === 0}>
                        <ArrowDown size={14} aria-hidden className="rotate-180" />
                      </IconButton>
                      <IconButton label={`Descer ${PAGES[p].name}`} onClick={() => move(i, i + 1)} disabled={i === draft.pages.length - 1}>
                        <ArrowDown size={14} aria-hidden />
                      </IconButton>
                      <IconButton label={`Tirar ${PAGES[p].name}`} onClick={() => save({ pages: draft.pages.filter((x) => x !== p) })} disabled={draft.pages.length === 1}>
                        <X size={14} aria-hidden />
                      </IconButton>
                    </li>
                  ))}
                </ol>
                {pageChoices.some((o) => !draft.pages.includes(o.id)) && (
                  <div className="mt-4 space-y-1.5">
                    <h3 className="text-[13px] font-semibold">Adicionar página</h3>
                    {pageChoices
                      .filter((o) => !draft.pages.includes(o.id))
                      .map((o) => (
                        <div key={o.id} className={`rounded-control border border-line bg-bg p-2.5 ${o.locked ? "opacity-70" : ""}`}>
                          <Checkbox
                            label={
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{PAGES[o.id].name}</span>
                                {o.locked && <LockBadge label={availableIn(o.tier)} />}
                              </span>
                            }
                            hint={PAGES[o.id].description}
                            checked={false}
                            disabled={o.locked}
                            onChange={() => save({ pages: [...draft.pages, o.id] })}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </Panel>
            )}

            {tab === "recursos" && (
              <Panel title="Recursos" text={composed ? "Cada recurso vira uma aba do dashboard." : "Os recursos entram nos modelos novos (visual e objetivo)."}>
                {composed && (
                  <ul className="space-y-1.5">
                    {FEATURES.map((f) => {
                      const locked = !canUse(pagesTier, f.tier);
                      const fits = featureFits(f, platforms);
                      const on = features.includes(f.id);
                      return (
                        <li key={f.id} className={`rounded-control border border-line bg-bg p-2.5 ${locked || !fits ? "opacity-70" : ""}`}>
                          <Checkbox
                            label={
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{f.label}</span>
                                {locked ? <LockBadge label={availableIn(f.tier)} /> : <span className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-fg-2">{TIER_LABEL[f.tier]}</span>}
                              </span>
                            }
                            hint={!fits && f.needs ? `${f.hint} Precisa de uma conta ${f.needs.map((p) => PLATFORMS[p as PlatformId].name).join(" ou ")}.` : f.hint}
                            checked={on}
                            disabled={(locked || !fits) && !on}
                            onChange={(v) => setFeature(f.id, v)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {composed && FEATURES.some((f) => !canUse(pagesTier, f.tier)) && (
                  <p className="mt-3 text-[12.5px] text-fg-2">
                    Recursos com cadeado são de um plano acima do {TIER_LABEL[tier]}.{" "}
                    <Link href="/painel/plano" className="text-accent underline-offset-2 hover:underline">
                      Ver planos
                    </Link>
                  </p>
                )}
              </Panel>
            )}

            {tab === "metas" && (
              <Panel title="Metas" text="Toda métrica dos cards pode ter uma meta. O card mostra se está no alvo.">
                <GoalsPanel goals={draft.metricGoals} onGoals={(metricGoals) => save({ metricGoals })} kpis={kpis} profile={profile} cpaGoal={draft.goal} onCpaGoal={(goal) => save({ goal })} cpaLabel={isLeadProfile ? "Meta de CPL (linha nos gráficos)" : "Meta de CPA (linha nos gráficos)"} />
              </Panel>
            )}

            {tab === "marca" && (
              <div className="space-y-6">
                <Panel title="Ajustes">
                  <div className="space-y-3">
                    <TextField label="Nome do dashboard" value={draft.name} placeholder={t.name} error={error?.fields?.name} onChange={(name) => save({ name })} />
                    <TextField label="Cliente" value={draft.client} placeholder="Ex.: Loja Verde" error={error?.fields?.client} onChange={(client) => save({ client })} />
                    <TextField
                      label="Margem"
                      suffix="%"
                      inputMode="numeric"
                      value={draft.margin ? String(Math.round(draft.margin * 100)) : ""}
                      placeholder="sem margem"
                      hint={draft.margin ? `ROAS de equilíbrio = 1 ÷ margem = ${roas(draft.margin)}` : "Sem margem, o equilíbrio é ROAS 1."}
                      onChange={(v) => {
                        const n = Number(v.replace(/\D/g, ""));
                        save({ margin: n > 0 ? Math.min(100, n) / 100 : null });
                      }}
                    />
                    <TextField label="Verba mensal" prefix="R$" inputMode="numeric" value={reais(draft.budget)} placeholder="50000" hint="Usada no pacing e na projeção do mês." onChange={(v) => save({ budget: cents(v) })} />
                    <SelectField label="Período padrão" value={draft.period} onChange={(v) => save({ period: v as PeriodId })} options={PERIODS} />
                    {draft.period === "custom" && (
                      <TextField
                        label="Dias do período personalizado"
                        inputMode="numeric"
                        value={String(draft.customDays)}
                        hint="De 3 a 60 dias, terminando ontem."
                        onChange={(v) => save({ customDays: Math.min(60, Math.max(3, Number(v.replace(/\D/g, "")) || 3)) })}
                      />
                    )}
                    <SelectField label="Janela de atribuição exibida" value={draft.attribution} onChange={(v) => save({ attribution: v })} options={ATTRIBUTIONS} />
                  </div>
                </Panel>

                <Panel title="Marca" text="A logo e a cor da empresa vestem este dashboard e os próximos.">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-bg" style={{ outline: `3px solid ${color}`, outlineOffset: 2 }}>
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- logo do próprio workspace
                          <img src={logo} alt="Logo da empresa" className="max-h-12 max-w-12 object-contain" />
                        ) : (
                          <span className="text-[11px] text-fg-2">sua logo</span>
                        )}
                      </div>
                      {workspaceBrand.canEdit ? (
                        <div className="min-w-0 space-y-1">
                          <FileInput label="Logo (PNG, JPG ou SVG)" accept="image/png,image/jpeg,image/svg+xml,image/webp" onFile={sendLogo} compact />
                          {logo && (
                            <button type="button" disabled={brandBusy} className="text-[12.5px] text-fg-2 underline-offset-2 hover:underline" onClick={() => startBrand(async () => { const r = await removeBrandLogo(); if (r.ok) setLogo(null); else setBrandError(r.error.message); })}>
                              Tirar logo
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[12.5px] text-fg-2">Só quem administra a organização troca a logo e a cor.</p>
                      )}
                    </div>
                    {clientLogo && (
                      <p className="text-[12.5px] text-fg-2">
                        Este dashboard usa a logo de {clientLogo.workspace}.{" "}
                        <Link href={clientLogo.href} className="font-medium text-accent underline-offset-4 hover:underline">
                          Trocar nos Ajustes do workspace
                        </Link>
                      </p>
                    )}
                    {brandBusy && <p className="text-[12.5px] text-fg-2">Enviando…</p>}
                    {brandError && <p className="text-[12.5px] text-error-fg">{brandError}</p>}
                    {workspaceBrand.canEdit && <ColorField label="Cor da empresa" value={color} onChange={setColor} />}
                    <div className="space-y-2 border-t border-line pt-3">
                      <p className="flex items-center gap-2 text-[13px] font-semibold">
                        Cor própria deste dashboard {!whiteLabel && <LockBadge label={availableIn("personalizado")} />}
                      </p>
                      {whiteLabel ? (
                        <>
                          <ColorField label="Cor do dashboard" value={draft.brandColor ?? (color || "#4B5320")} onChange={(brandColor) => save({ brandColor })} />
                          <Checkbox label="Ocultar a marca VYZ (dashboard, link e PDF)" checked={draft.hideVyz} onChange={(hideVyz) => save({ hideVyz })} />
                          {draft.brandColor && (
                            <button type="button" className={`${btn.ghost} h-8 px-2 text-[13px]`} onClick={() => save({ brandColor: null })}>
                              Usar a cor da empresa
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-[12.5px] text-fg-2">Uma cor só para este dashboard e sem a marca VYZ no plano Personalizado.</p>
                      )}
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="title text-[15px]">{title}</h2>
      {text && <p className="mt-1 mb-3 text-[12.5px] text-fg-2">{text}</p>}
      {!text && <div className="mb-3" />}
      {children}
    </section>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="inline-flex size-7 shrink-0 items-center justify-center rounded-control border border-line disabled:opacity-30">
      {children}
    </button>
  );
}
