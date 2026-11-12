"use client";

// Criar e editar dashboard, em passos: template → contas → páginas → metas e
// ajustes → revisar. O estado vive na tela; quem grava é o servidor
// (createDashboard / updateDashboard), que confere plano, páginas e contas de novo.

import { ArrowDown, ArrowLeft, ArrowRight, Check, GripVertical, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { ColorField } from "@/components/ui/ColorField";
import { FileInput, readImage } from "@/components/ui/FileInput";
import { Checkbox, LockBadge, PendingChip, SelectField, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { PLATFORMS } from "@/features/accounts/platforms";
import { availableIn, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { anyDashboardTemplate, REAL_DATA_PLATFORMS, usesAccounts } from "@/features/templates/live";
import { composePages } from "@/features/templates/dashboards/composed";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { ATTRIBUTIONS, PERIODS, type PeriodId } from "@/features/workspace/types";
import { brl } from "@/lib/format";
import { createDashboard, updateDashboard } from "@/server/dashboards/actions";
import { allowedPages, defaultPages, pageOptions, type DashboardDetail, type SourceOption } from "./model";
import type { DashboardFields } from "./schema";
import { ModelPicker } from "./ModelPicker";

const STEPS = ["Template", "Contas", "Páginas", "Metas e ajustes", "Revisar"];
const DEFAULT_MARGIN = 0.4;

const reais = (cents: number) => (cents ? String(Math.round(cents / 100)) : "");
const cents = (v: string) => Math.round((Number(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
const roas = (margin: number) => (1 / margin).toFixed(1).replace(".", ",");

type Draft = Omit<DashboardFields, "pages"> & { templateId: string | null; pages: PageId[] };

function draftFrom(d: DashboardDetail): Draft {
  return {
    templateId: d.templateId,
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
  };
}

const EMPTY: Draft = {
  templateId: null,
  name: "",
  client: "",
  goal: 0,
  budget: 0,
  margin: DEFAULT_MARGIN,
  period: "30d",
  customDays: 14,
  attribution: "7c1v",
  pages: [],
  accountIds: [],
  brandColor: null,
  hideVyz: false,
};

function Stepper({ step, onGo, max, skip }: { step: number; onGo: (s: number) => void; max: number; skip: number[] }) {
  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Passos">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        const off = n > max || skip.includes(n);
        return (
          <li key={label} className={current ? "min-w-0 flex-[3] sm:flex-1" : "min-w-0 flex-1"}>
            <button
              type="button"
              disabled={off}
              onClick={() => onGo(n)}
              aria-current={current ? "step" : undefined}
              className="group flex w-full min-w-[2.5rem] flex-col gap-1.5 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default sm:min-w-[7.5rem]"
            >
              <span className={`h-[var(--cut)] w-full rounded-full ${done || current ? "bg-accent" : "bg-line"}`} />
              <span className={`flex items-center gap-1.5 text-[12.5px] ${current ? "font-semibold text-fg" : done ? "text-fg" : "text-fg-2"} ${skip.includes(n) ? "line-through opacity-60" : ""}`}>
                <span className="tnum">{String(n).padStart(2, "0")}</span> <span className={current ? "" : "hidden sm:inline"}>{label}</span>
                {done && !skip.includes(n) && <Check size={13} aria-hidden className="text-accent" />}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="title text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export type DashboardFlowProps = {
  /** Sem dashboard = criar; com = editar (o template não muda). */
  dashboard?: DashboardDetail;
  sources: SourceOption[];
  tier: Tier;
  /** Páginas liberadas até este plano. */
  pagesTier: Tier;
  whiteLabel: boolean;
  /** Dashboards em uso e o limite do plano (criar). */
  used: number;
  limit: number;
  /** ?template= abre direto nas contas. */
  initialTemplate?: string | null;
  /** O plano inclui voz no assistente (Avançado e Personalizado). */
  voice?: boolean;
};

export function NewDashboardFlow({ dashboard, sources, tier, pagesTier, whiteLabel, used, limit, initialTemplate }: DashboardFlowProps) {
  const editing = !!dashboard;
  const [draft, setDraft] = useState<Draft>(() => {
    if (dashboard) return draftFrom(dashboard);
    const t = initialTemplate ? anyDashboardTemplate(initialTemplate) : undefined;
    return t ? withTemplate(EMPTY, t, pagesTier, sources) : EMPTY;
  });
  const accountStep = (id: string) => {
    const tt = anyDashboardTemplate(id);
    return tt && usesAccounts(tt) ? 2 : 3;
  };
  const [step, setStep] = useState(() => (dashboard ? accountStep(dashboard.templateId) : draft.templateId ? accountStep(draft.templateId) : 1));
  const [dragging, setDragging] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [pending, start] = useTransition();

  const t = draft.templateId ? anyDashboardTemplate(draft.templateId) : undefined;
  // não há mais modelo "ao vivo" separado: todo modelo lê as contas marcadas
  const live = false;
  // modelo comum de Meta ou Google: escolhe as contas também (sem conta, fica a amostra)
  const pickAccounts = !!t && usesAccounts(t);
  const save = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const atLimit = !editing && used >= limit;
  const platformSources = t ? sources.filter((s) => t.sources.includes(s.platformId) && (live || (REAL_DATA_PLATFORMS as readonly string[]).includes(s.platformId))) : [];
  // modelo novo: só as páginas das plataformas com conta marcada (e as que o dashboard já tem)
  const fitting = t?.composed ? new Set<string>([...composePages([...new Set(sources.filter((s) => draft.accountIds.includes(s.id)).map((s) => s.platformId))]), ...draft.pages]) : null;
  const options = t ? pageOptions(t, pagesTier).filter((o) => !fitting || fitting.has(o.id)) : [];
  const isLeadProfile = t && ["leads", "imob", "saude", "educacao", "infoproduto"].includes(t.profile);
  // dashboards de exemplo não usam contas: o passo 2 fica de fora
  const skip = t && !pickAccounts ? [2] : [];
  const go = (s: number) => setStep(skip.includes(s) ? (s > step ? s + 1 : s - 1) : s);
  const accountsMissing = live && draft.accountIds.length === 0;
  // na edição o template não muda: o primeiro passo é o das contas (ou das páginas)
  const firstStep = editing ? (pickAccounts ? 2 : 3) : 1;

  function pickTemplate(id: string) {
    const tt = anyDashboardTemplate(id);
    if (!tt) return;
    setDraft((d) => withTemplate(d, tt, pagesTier, sources));
    setStep(usesAccounts(tt) ? 2 : 3);
  }

  function submit() {
    if (!t) return;
    setError(null);
    const fields: DashboardFields = {
      name: draft.name.trim() || t.name,
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
    };
    start(async () => {
      const r = dashboard ? await updateDashboard(dashboard.id, fields) : await createDashboard({ ...fields, templateId: t.id });
      // sucesso redireciona para o dashboard; aqui só chegam os erros
      if (r && !r.ok) setError(r.error);
    });
  }

  function move(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= draft.pages.length) return;
    const next = [...draft.pages];
    [next[i], next[j]] = [next[j], next[i]];
    save({ pages: next });
  }

  const canContinue = step === 2 ? !accountsMissing : step === 3 ? draft.pages.length > 0 : true;

  return (
    <div className="space-y-6">
      <Stepper step={step} max={t ? 5 : 1} onGo={go} skip={editing ? [1, ...skip] : skip} />

      {step === 1 && !editing && <ModelPicker tier={tier} onUse={pickTemplate} />}

      {t && step === 2 && pickAccounts && (
        <Section title={`Contas · ${t.name}`}>
          <p className="mb-4 text-[14px] text-fg-2">
            Escolha as contas do {(live ? t.sources : t.sources.filter((s) => (REAL_DATA_PLATFORMS as readonly string[]).includes(s))).map((s) => PLATFORMS[s].name).join(" e ")} que alimentam este dashboard. Os números de todas são somados.
            {!live && " Sem conta marcada, o modelo mostra dados de exemplo."}
          </p>
          {platformSources.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-control border border-dashed border-line p-4 text-[14px] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-fg-2">Nenhuma conta do {PLATFORMS[t.sources[0]].name} conectada ainda.</p>
              <Link href="/painel/contas" className={`${btn.small} shrink-0`}>
                Conectar em Contas
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {platformSources.map((a) => {
                const linked = !!dashboard?.sources.some((s) => s.id === a.id);
                const off = !a.isEnabled && !linked;
                return (
                  <li key={a.id} className={`rounded-control border border-line bg-bg p-3 ${off ? "opacity-70" : ""}`}>
                    <Checkbox
                      label={<span className="font-medium">{a.name}</span>}
                      hint={[a.businessName, a.isEnabled ? (a.lastSyncedAt ? "Ativa" : "Ativa · importando os dados") : linked ? "Desativada · os dados já importados continuam" : "Desativada · ative em Contas"].filter(Boolean).join(" · ")}
                      checked={draft.accountIds.includes(a.id)}
                      disabled={off}
                      onChange={(on) => {
                        const accountIds = on ? [...draft.accountIds, a.id] : draft.accountIds.filter((x) => x !== a.id);
                        save({ accountIds, ...(t.composed ? { pages: composedPagesFor(t, accountIds, sources, pagesTier) } : {}) });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {error?.fields?.accountIds && <p className="mt-2 text-[12.5px] text-error-fg">{error.fields.accountIds}</p>}
          <p className="mt-4 text-[12.5px] text-fg-2">
            Falta alguma conta? Ative em{" "}
            <Link href="/painel/contas" className="text-accent underline-offset-2 hover:underline">
              Contas
            </Link>
            , dentro do limite do plano.
          </p>
        </Section>
      )}

      {t && step === 3 && (
        <Section title="Páginas do dashboard">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-fg-2">{live ? "Páginas deste template" : "Biblioteca de páginas"}</p>
              <ul className="space-y-2">
                {options.map((o) => {
                  const def = PAGES[o.id];
                  return (
                    <li key={o.id} className={`rounded-control border border-line bg-bg p-3 ${o.locked ? "opacity-70" : ""}`}>
                      <Checkbox
                        label={
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{def.name}</span>
                            {o.locked && <LockBadge label={availableIn(o.tier)} />}
                            {o.soon && <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[11px]">em breve</span>}
                          </span>
                        }
                        hint={def.description}
                        checked={draft.pages.includes(o.id)}
                        disabled={o.locked && !draft.pages.includes(o.id)}
                        onChange={(on) => save({ pages: on ? [...draft.pages, o.id] : draft.pages.filter((x) => x !== o.id) })}
                      />
                    </li>
                  );
                })}
              </ul>
              {options.some((o) => o.locked) && (
                <p className="mt-3 text-[12.5px] text-fg-2">
                  Páginas com cadeado são de um plano acima do {TIER_LABEL[tier]}.{" "}
                  <Link href="/painel/plano" className="text-accent underline-offset-2 hover:underline">
                    Ver planos
                  </Link>
                </p>
              )}
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-fg-2">Ordem das abas (arraste ou use as setas)</p>
              {draft.pages.length === 0 ? (
                <p className="rounded-control border border-dashed border-line p-4 text-[14px] text-fg-2">Escolha pelo menos uma página.</p>
              ) : (
                <ol className="space-y-2">
                  {draft.pages.map((p, i) => (
                    <li
                      key={p}
                      draggable
                      onDragStart={() => setDragging(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragging === null || dragging === i) return;
                        const next = [...draft.pages];
                        const [it] = next.splice(dragging, 1);
                        next.splice(i, 0, it);
                        save({ pages: next });
                        setDragging(null);
                      }}
                      className="flex items-center gap-2 rounded-control border border-line bg-bg p-2.5 text-[14px]"
                    >
                      <GripVertical size={16} aria-hidden className="cursor-grab text-fg-2" />
                      <span className="w-6 text-fg-2 tnum">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{PAGES[p].name}</span>
                      <button type="button" aria-label={`Subir ${PAGES[p].name}`} onClick={() => move(i, -1)} disabled={i === 0} className="inline-flex size-8 items-center justify-center rounded-control border border-line disabled:opacity-30">
                        <ArrowDown size={14} aria-hidden className="rotate-180" />
                      </button>
                      <button type="button" aria-label={`Descer ${PAGES[p].name}`} onClick={() => move(i, 1)} disabled={i === draft.pages.length - 1} className="inline-flex size-8 items-center justify-center rounded-control border border-line disabled:opacity-30">
                        <ArrowDown size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </Section>
      )}

      {t && step === 4 && (
        <div className="space-y-4">
          <Section title="Metas e ajustes">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nome do dashboard" value={draft.name} placeholder={t.name} error={error?.fields?.name} onChange={(name) => save({ name })} />
              <TextField label="Cliente" value={draft.client} placeholder="Ex.: Loja Verde" error={error?.fields?.client} onChange={(client) => save({ client })} />
              <TextField
                label={isLeadProfile ? "Meta de CPL" : "Meta de CPA"}
                prefix="R$"
                inputMode="numeric"
                value={reais(draft.goal)}
                placeholder="60"
                hint="Vira a linha tracejada nos gráficos."
                onChange={(v) => save({ goal: cents(v) })}
              />
              <TextField
                label="Margem"
                suffix="%"
                inputMode="numeric"
                value={draft.margin ? String(Math.round(draft.margin * 100)) : ""}
                placeholder="sem margem"
                hint={draft.margin ? `ROAS de equilíbrio = 1 ÷ margem = ${roas(draft.margin)}` : "Sem margem, o equilíbrio é ROAS 1 (receita = investimento)."}
                onChange={(v) => {
                  const n = Number(v.replace(/\D/g, ""));
                  save({ margin: n > 0 ? Math.min(100, n) / 100 : null });
                }}
              />
              <TextField
                label="Verba mensal"
                prefix="R$"
                inputMode="numeric"
                value={reais(draft.budget)}
                placeholder="50000"
                hint="Usada no pacing e na projeção do mês."
                onChange={(v) => save({ budget: cents(v) })}
              />
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
          </Section>

          <Section title="Marca" aside={!whiteLabel ? <LockBadge label={availableIn("personalizado")} /> : undefined}>
            {whiteLabel ? (
              <div className="space-y-3">
                <ColorField label="Cor principal" value={draft.brandColor ?? "#4B5320"} onChange={(brandColor) => save({ brandColor })} />
                <Checkbox label="Ocultar a marca VYZ (dashboard, link e PDF)" checked={draft.hideVyz} onChange={(hideVyz) => save({ hideVyz })} />
                {draft.brandColor && (
                  <button type="button" className={`${btn.ghost} h-8 px-2 text-[13px]`} onClick={() => save({ brandColor: null })}>
                    Usar a cor do workspace
                  </button>
                )}
                <p className="text-[12.5px] text-fg-2">O logo é o do workspace (Configurações).</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-[14px] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-fg-2">Seu logo e suas cores no dashboard, no link e no PDF, sem a marca VYZ.</p>
                <Link href="/painel/plano" className={`${btn.small} shrink-0`}>
                  Ver planos
                </Link>
              </div>
            )}
          </Section>
        </div>
      )}

      {t && step === 5 && (
        <Section title={editing ? "Revisar e salvar" : "Revisar e gerar"}>
          <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
            <Info label="Template" value={t.name} />
            <Info label="Dashboard" value={[draft.name.trim() || t.name, draft.client.trim()].filter(Boolean).join(" · ")} />
            <Info
              label="Contas"
              value={pickAccounts ? platformSources.filter((s) => draft.accountIds.includes(s.id)).map((s) => s.name).join(", ") || (live ? "nenhuma" : "dados de exemplo") : "dados de exemplo"}
            />
            <Info label="Páginas" value={draft.pages.map((p) => PAGES[p].name).join(", ") || "nenhuma"} />
            <Info label={isLeadProfile ? "Meta de CPL" : "Meta de CPA"} value={draft.goal ? brl(draft.goal, { decimals: false }) : "automática"} />
            <Info label="Margem e equilíbrio" value={draft.margin ? `${Math.round(draft.margin * 100)}% · ROAS ${roas(draft.margin)}` : "sem margem · ROAS 1"} />
            <Info label="Verba mensal" value={draft.budget ? brl(draft.budget, { decimals: false }) : "automática"} />
            <Info label="Período e atribuição" value={`${PERIODS.find((p) => p.value === draft.period)?.label} · ${ATTRIBUTIONS.find((a) => a.value === draft.attribution)?.label}`} />
          </dl>
          {!live && draft.accountIds.length === 0 && (
            <div className="mt-4">
              <PendingChip label="Modelo com dados de exemplo" detail={pickAccounts ? "Nenhuma conta marcada: os números são fictícios. Volte ao passo Contas para ver os dados reais." : "Os números são fictícios: este modelo ainda não lê contas desta plataforma."} />
            </div>
          )}
          {atLimit ? (
            <div className="mt-5 flex flex-col gap-3 rounded-control border border-warning/60 bg-warning/10 p-4 text-[14px] sm:flex-row sm:items-center sm:justify-between">
              <p>
                O plano {TIER_LABEL[tier]} permite {limit} dashboards e você já tem {used}.
              </p>
              <Link href="/painel/plano" className={`${btn.small} shrink-0`}>
                Trocar de plano
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              <button type="button" onClick={submit} disabled={pending || accountsMissing || draft.pages.length === 0} className={`${btn.primary} w-full sm:w-auto`}>
                {pending ? (editing ? "Salvando…" : "Gerando…") : editing ? "Salvar e abrir" : "Gerar dashboard"}
              </button>
            </div>
          )}
          {pending && !editing && (
            <div className="relative mt-4 h-24 overflow-hidden rounded-card border border-line bg-bg" data-anim="on" aria-hidden>
              <div className="scanner" />
              <div className="m-unveil grid h-full grid-cols-4 gap-2 p-3">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="rounded-[8px] bg-card" />
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {error && (
        <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13.5px] text-error-fg">
          {error.message}
        </p>
      )}

      {t && step > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > firstStep ? (
            <button type="button" onClick={() => go(step - 1)} className={`${btn.ghost} h-10`}>
              <ArrowLeft size={16} aria-hidden /> Voltar
            </button>
          ) : editing ? (
            <Link href={`/painel/dashboards/${dashboard.id}`} className={`${btn.ghost} h-10`}>
              <ArrowLeft size={16} aria-hidden /> Cancelar
            </Link>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {editing && step < 5 && (
              <button type="button" onClick={submit} disabled={pending || accountsMissing || draft.pages.length === 0} className={`${btn.ghost} h-10`}>
                {pending ? "Salvando…" : "Salvar agora"}
              </button>
            )}
            {step < 5 && (
              <button type="button" onClick={() => go(step + 1)} disabled={!canContinue} className={btn.small}>
                Continuar <ArrowRight size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Modelo novo: as páginas que as contas marcadas pedem, dentro do que o plano libera. */
function composedPagesFor(t: DashboardTemplate, accountIds: readonly string[], sources: SourceOption[], pagesTier: Tier): PageId[] {
  const platforms = [...new Set(sources.filter((s) => accountIds.includes(s.id)).map((s) => s.platformId))];
  return allowedPages(t, pagesTier, composePages(platforms));
}

/** Template escolhido: páginas que o plano libera e, nos de dados reais, as contas ativas da plataforma. */
function withTemplate(d: Draft, t: DashboardTemplate, pagesTier: Tier, sources: SourceOption[]): Draft {
  // modelo novo: começa sem conta marcada (a pessoa escolhe) e com as páginas de exemplo
  if (t.composed) return { ...d, templateId: t.id, pages: composedPagesFor(t, [], sources, pagesTier), accountIds: [] };
  return {
    ...d,
    templateId: t.id,
    pages: defaultPages(t, pagesTier),
    accountIds: usesAccounts(t) ? sources.filter((s) => s.isEnabled && t.sources.includes(s.platformId) && (REAL_DATA_PLATFORMS as readonly string[]).includes(s.platformId)).map((s) => s.id) : [],
  };
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-fg-2">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** Logo (upload em memória, guardado como dataURL), cor principal e "ocultar VYZ". */
export function BrandFields({ value, onChange }: { value: { logo?: string; color: string; hideVyz: boolean }; onChange: (v: { logo?: string; color: string; hideVyz: boolean }) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-card border border-dashed border-line bg-bg">
        {value.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- dataURL local
          <img src={value.logo} alt="Logo atual" className="max-h-20 max-w-20 object-contain" />
        ) : (
          <Lock size={18} aria-hidden className="text-fg-2" />
        )}
      </div>
      <div className="space-y-3">
        <FileInput
          label="Logo"
          hint="PNG, JPG, SVG ou WebP, até 300 KB"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          error={error}
          onFile={(f) =>
            readImage(
              f,
              300_000,
              (logo) => {
                setError(null);
                onChange({ ...value, logo });
              },
              setError,
            )
          }
        />
        <ColorField label="Cor principal" value={value.color} onChange={(color) => onChange({ ...value, color })} />
        <Checkbox label="Ocultar a marca VYZ (dashboard, link e PDF)" checked={value.hideVyz} onChange={(hideVyz) => onChange({ ...value, hideVyz })} />
        {value.logo && (
          <button type="button" className={`${btn.ghost} h-8 px-2 text-[13px]`} onClick={() => onChange({ ...value, logo: undefined })}>
            Remover logo
          </button>
        )}
      </div>
    </div>
  );
}
