"use client";

// Novo dashboard num popup, em 4 passos curtos:
//   1. objetivo e visual;
//   2. plataformas e, só delas, as contas (agrupadas e identificadas);
//   3. páginas: só as que as contas pedem, já marcadas;
//   4. nome e cliente.
// Criar leva direto ao dashboard novo (a ação redireciona).

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { LockBadge, Modal, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { isImportPlatform } from "@/features/accounts/connection-modes";
import { isCrmSyncPlatform } from "@/features/sync/crm";
import { availableIn, canUse, type Tier } from "@/features/pricing/entitlements";
import { composePages, FEATURES, featureFits, type FeatureId, type ObjectiveId } from "@/features/templates/dashboards/composed";
import { anyDashboardTemplate } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { createDashboard } from "@/server/dashboards/actions";
import { allowedPages, type SourceOption } from "./model";
import { ModelPicker } from "./ModelPicker";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { TemplateThumb } from "./TemplatePreview";
import { ColorField } from "@/components/ui/ColorField";
import { FileInput } from "@/components/ui/FileInput";
import { removeBrandLogo, updateWorkspace, uploadBrandLogo } from "@/server/workspace/actions";
import { BuildingDashboard } from "./BuildingDashboard";

/** Plataformas que os modelos novos leem, na ordem em que aparecem. */
const BASE_ORDER: PlatformId[] = ["meta", "google", "ga4", "instagram", "facebook"];
const HINT: Partial<Record<PlatformId, string>> = {
  meta: "Campanhas, criativos e público",
  google: "Campanhas e termos de pesquisa",
  ga4: "Site: sessões, conversões e canais",
  instagram: "Seguidores, alcance e posts",
  facebook: "Seguidores, alcance e posts da Página",
  rdstation: "CRM: leads, negócios e vendas ganhas",
  hubspot: "CRM: leads, negócios e vendas ganhas",
  pipedrive: "CRM: leads, negócios e vendas ganhas",
  kommo: "CRM: leads, negócios e vendas ganhas",
};

const STEPS = ["Objetivo", "Visual", "Plataformas", "Recursos", "Páginas", "Marca e nome"];

export function NewDashboardDialog({
  open,
  onClose,
  sources,
  tier,
  pagesTier,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  sources: SourceOption[];
  tier: Tier;
  pagesTier: Tier;
  /** Logo e cor da empresa (workspace): o dashboard se veste com elas. */
  brand: { color: string; logoUrl: string | null; canEdit: boolean };
}) {
  const [color, setColor] = useState(brand.color);
  const [logo, setLogo] = useState<string | null>(brand.logoUrl);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandBusy, startBrand] = useTransition();
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
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState<ObjectiveId | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PlatformId[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [off, setOff] = useState<PageId[]>([]);
  const [features, setFeatures] = useState<FeatureId[]>([]);
  const [hovered, setHovered] = useState<FeatureId | null>(null);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = templateId ? anyDashboardTemplate(templateId) : undefined;

  const byPlatform = useMemo(() => {
    const m = new Map<PlatformId, SourceOption[]>();
    for (const s of sources) if (BASE_ORDER.includes(s.platformId) || isImportPlatform(s.platformId) || isCrmSyncPlatform(s.platformId)) m.set(s.platformId, [...(m.get(s.platformId) ?? []), s]);
    return m;
  }, [sources]);

  // plataformas com conta marcada definem as páginas (as escolhidas sem conta ainda não contam)
  // as de sempre e, quando houver, as que entram por planilha (TikTok, LinkedIn...) e os CRMs
  const PLATFORM_ORDER = [...BASE_ORDER, ...[...byPlatform.keys()].filter((p) => !BASE_ORDER.includes(p))];
  const used = PLATFORM_ORDER.filter((p) => platforms.includes(p) && (byPlatform.get(p) ?? []).some((a) => accountIds.includes(a.id)));
  const suggested = t ? allowedPages(t, pagesTier, composePages(used, features)) : [];
  const pages = suggested.filter((p) => !off.includes(p));

  function reset() {
    setStep(0);
    setObjective(null);
    setTemplateId(null);
    setPlatforms([]);
    setAccountIds([]);
    setOff([]);
    setFeatures([]);
    setName("");
    setClient("");
    setError(null);
  }
  function close() {
    if (pending) return;
    reset();
    onClose();
  }
  function togglePlatform(p: PlatformId) {
    const on = !platforms.includes(p);
    setPlatforms(on ? [...platforms, p] : platforms.filter((x) => x !== p));
    const ids = (byPlatform.get(p) ?? []).map((a) => a.id);
    // ligou a plataforma com uma conta só: já marca; desligou: tira as contas dela
    if (on && ids.length === 1) setAccountIds((cur) => [...new Set([...cur, ids[0]])]);
    if (!on) setAccountIds((cur) => cur.filter((x) => !ids.includes(x)));
  }
  function create() {
    if (!t) return;
    setError(null);
    start(async () => {
      // a cor da empresa vai para o workspace (vale para este e os próximos dashboards)
      if (brand.canEdit && color.toLowerCase() !== brand.color.toLowerCase()) {
        const b = await updateWorkspace({ brandColor: color });
        if (!b.ok) return setError(b.error.message);
      }
      const r = await createDashboard({
        templateId: t.id,
        name: name.trim() || t.name,
        client: client.trim(),
        goal: 0,
        budget: 0,
        margin: null,
        period: "30d",
        customDays: 14,
        attribution: "7c1v",
        pages,
        accountIds,
        brandColor: null,
        hideVyz: false,
      });
      // sucesso redireciona para o dashboard novo; aqui só volta o erro
      if (r && !r.ok) setError(r.error.message);
    });
  }

  const canNext = step === 4 ? pages.length > 0 : true;

  return (
    <Modal open={open} onClose={close} title="Novo dashboard" wide>
      {pending ? (
        <BuildingDashboard />
      ) : (
        <div className="space-y-5">
          <ol className="grid grid-cols-6 gap-2" aria-label="Passos">
            {STEPS.map((s, i) => (
              <li key={s} className="space-y-1.5">
                <span className={`block h-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
                <span className={`flex items-center gap-1 text-[12px] ${i === step ? "font-semibold text-fg" : "text-fg-2"}`}>
                  {i < step && <Check size={12} aria-hidden className="text-accent" />}
                  {s}
                </span>
              </li>
            ))}
          </ol>

          {step === 0 && (
            <ModelPicker
              tier={tier}
              section="objective"
              objective={objective ?? undefined}
              onObjective={(o) => {
                setObjective(o);
                setStep(1);
              }}
              onUse={() => {}}
            />
          )}

          {step === 1 && objective && (
            <ModelPicker
              tier={tier}
              section="visual"
              objective={objective}
              onUse={(id) => {
                setTemplateId(id);
                setOff([]);
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="title text-[16px] text-fg">De onde vêm os dados?</h3>
                <p className="text-[13.5px] text-fg-2">Marque as plataformas; depois escolha as contas de cada uma. Cada plataforma vira uma página do dashboard.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLATFORM_ORDER.map((p) => {
                  const accounts = byPlatform.get(p) ?? [];
                  const on = platforms.includes(p);
                  if (!accounts.length)
                    return (
                      <div key={p} className="flex items-center gap-3 rounded-card border border-dashed border-line p-3 opacity-75">
                        <PlatformIcon id={p} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-fg">{PLATFORMS[p].name}</p>
                          <p className="text-[12.5px] text-fg-2">Nenhuma conta conectada</p>
                        </div>
                        <Link href="/painel/contas" className="text-[12.5px] text-accent underline-offset-2 hover:underline">
                          Conectar
                        </Link>
                      </div>
                    );
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePlatform(p)}
                      className={`flex items-center gap-3 rounded-card border p-3 text-left transition-colors ${on ? "border-accent bg-accent-soft/60" : "border-line bg-card hover:border-accent/60"}`}
                    >
                      <PlatformIcon id={p} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-fg">{PLATFORMS[p].name}</span>
                        <span className="block text-[12.5px] text-fg-2">
                          {HINT[p] ?? "Planilha (CSV ou Google Sheets)"} · {accounts.length} {accounts.length === 1 ? "conta" : "contas"}
                        </span>
                      </span>
                      <span className={`inline-flex size-5 items-center justify-center rounded-full border ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>
                        {on && <Check size={12} aria-hidden />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {PLATFORM_ORDER.filter((p) => platforms.includes(p)).map((p) => (
                <section key={p} className="rounded-card border border-line">
                  <header className="flex items-center gap-2 border-b border-line px-3 py-2">
                    <PlatformIcon id={p} size={22} />
                    <h4 className="text-[14px] font-semibold text-fg">Contas do {PLATFORMS[p].name}</h4>
                  </header>
                  <ul className="max-h-56 divide-y divide-line overflow-y-auto">
                    {(byPlatform.get(p) ?? []).map((a) => {
                      const checked = accountIds.includes(a.id);
                      return (
                        <li key={a.id}>
                          <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${a.isEnabled ? "" : "opacity-60"}`}>
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--accent)]"
                              checked={checked}
                              disabled={!a.isEnabled}
                              onChange={(e) => setAccountIds((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((x) => x !== a.id)))}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] text-fg">{a.name}</span>
                              <span className="block truncate text-[12px] text-fg-2">
                                {[a.businessName, a.isEnabled ? (a.lastSyncedAt ? "ativa" : "ativa · importando") : "desligada · ligue em Contas"].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {!used.length && <p className="text-[12.5px] text-fg-2">Sem conta marcada, o dashboard é criado com dados de exemplo (dá para ligar contas depois em Editar).</p>}
            </div>
          )}

          {step === 3 && t && (
            <div className="space-y-3">
              <div>
                <h3 className="title text-[16px] text-fg">Recursos do dashboard</h3>
                <p className="text-[13.5px] text-fg-2">Cada recurso vira uma página. Os do Avançado aparecem travados nos outros planos.</p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {FEATURES.map((f) => {
                  const fits = featureFits(f, used.length ? used : platforms);
                  const open = canUse(tier, f.tier);
                  const on = features.includes(f.id);
                  return (
                    <li key={f.id} className="relative" onMouseEnter={() => setHovered(f.id)} onMouseLeave={() => setHovered((h) => (h === f.id ? null : h))}>
                      {/* passar o mouse: a prévia da página do recurso, com dados de exemplo */}
                      {hovered === f.id && t && (
                        <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-[360px] overflow-hidden rounded-card border border-line bg-card shadow-xl md:block">
                          <TemplateThumb t={t} page={f.id} height={200} />
                          <p className="border-t border-line px-3 py-2 text-[12px] text-fg-2">Prévia com dados de exemplo</p>
                        </div>
                      )}
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={!open || !fits}
                        onClick={() => setFeatures((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                        className={`flex h-full w-full items-start gap-3 rounded-card border p-3 text-left transition-colors disabled:cursor-not-allowed ${on ? "border-accent bg-accent-soft/60" : "border-line bg-card hover:border-accent/60"} ${!open || !fits ? "opacity-60" : ""}`}
                      >
                        <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{on && <Check size={12} aria-hidden />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 font-medium text-fg">
                            {f.label}
                            <span className={`rounded-chip px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase ${f.tier === "avancado" ? "bg-accent text-on-accent" : "border border-line text-fg-2"}`}>{f.tier === "avancado" ? "Avançado" : "Padrão"}</span>
                            {!open && <LockBadge label={availableIn(f.tier)} />}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-fg-2">{fits ? f.hint : `Precisa de ${f.needs?.map((n) => PLATFORMS[n as PlatformId].name).join(" ou ")}.`}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {step === 4 && t && (
            <div className="space-y-3">
              <div>
                <h3 className="title text-[16px] text-fg">Páginas do dashboard</h3>
                <p className="text-[13.5px] text-fg-2">Montadas pelas plataformas que você escolheu. Desmarque o que não quiser.</p>
              </div>
              <ul className="space-y-2">
                {suggested.map((p, i) => {
                  const on = !off.includes(p);
                  return (
                    <li key={p}>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 ${on ? "border-accent/50 bg-card" : "border-line bg-card opacity-70"}`}>
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-[var(--accent)]"
                          checked={on}
                          onChange={(e) => setOff((cur) => (e.target.checked ? cur.filter((x) => x !== p) : [...cur, p]))}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-fg">
                            <span className="mr-2 text-fg-2 tabular-nums">{i + 1}</span>
                            {PAGES[p].name}
                          </span>
                          <span className="block text-[12.5px] text-fg-2">{PAGES[p].description}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {step === 5 && t && (
            <div className="space-y-4">
              <h3 className="title text-[16px] text-fg">Quase pronto</h3>
            {brand.canEdit && (
              <div className="grid gap-4 rounded-card border border-line p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex size-20 items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-bg" style={{ outline: `3px solid ${color}`, outlineOffset: 2 }}>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logo do próprio workspace
                    <img src={logo} alt="Logo da empresa" className="max-h-16 max-w-16 object-contain" />
                  ) : (
                    <span className="text-[11px] text-fg-2">sua logo</span>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-[13.5px] text-fg-2">A logo e a cor da sua empresa vestem o dashboard (e os próximos). Dá para trocar depois em Configurações.</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <FileInput label="Logo (PNG, JPG ou SVG)" accept="image/png,image/jpeg,image/svg+xml,image/webp" onFile={sendLogo} compact />
                    {logo && (
                      <button type="button" className="text-[12.5px] text-fg-2 underline-offset-2 hover:underline" onClick={() => startBrand(async () => { const r = await removeBrandLogo(); if (r.ok) setLogo(null); })}>
                        Tirar logo
                      </button>
                    )}
                    <div className="w-44">
                      <ColorField label="Cor da marca" value={color} onChange={setColor} />
                    </div>
                  </div>
                  {brandBusy && <p className="text-[12px] text-fg-2">Enviando…</p>}
                  {brandError && <p className="text-[12.5px] text-error">{brandError}</p>}
                </div>
              </div>
            )}
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nome do dashboard" value={name} onChange={setName} placeholder={t.name} />
                <TextField label="Cliente (opcional)" value={client} onChange={setClient} placeholder="Ex.: Loja Verde" />
              </div>
              <p className="text-[13px] text-fg-2">
                {t.name} · {pages.length} {pages.length === 1 ? "página" : "páginas"} ·{" "}
                {accountIds.length ? `${accountIds.length} ${accountIds.length === 1 ? "conta" : "contas"}` : "dados de exemplo"}. Metas, verba e margem você ajusta depois, em Editar.
              </p>
              {error && <p className="rounded-control bg-error/10 px-3 py-2 text-[13px] text-error">{error}</p>}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            {step > 0 ? (
              <button type="button" className={`${btn.ghost} h-10`} onClick={() => setStep(step - 1)} disabled={pending}>
                <ArrowLeft size={16} aria-hidden /> Voltar
              </button>
            ) : (
              <span />
            )}
            {step > 1 && step < 5 && (
              <button type="button" className={btn.small} onClick={() => setStep(step + 1)} disabled={!canNext}>
                Continuar <ArrowRight size={16} aria-hidden />
              </button>
            )}
            {step === 5 && (
              <button type="button" className={btn.small} onClick={create} disabled={pending || !pages.length}>
                {pending && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
                {pending ? "Criando…" : "Criar dashboard"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
