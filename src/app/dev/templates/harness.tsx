"use client";

// Bancada dos modelos (só desenvolvimento). Tudo vem da URL, para dar para mandar o
// link de uma tela exata:
//
//   /dev/templates?visual=lavanda              visual (os rascunhos aparecem marcados)
//     &objetivo=ecommerce                      objetivo (números do topo e funil)
//     &contas=meta,google,ga4                  contas ligadas (decidem as abas)
//     &recursos=previsao,mmm                   recursos ligados (metas, comparativo, criativos-ao-vivo, previsao, mmm)
//     &plano=avancado                          base | pro | avancado (o Personalizar move blocos só no Avançado)
//     &pagina=visao-geral                      aba aberta
//     &ocultar=1                               investimento oculto (como no link compartilhado)
//     &barra=0                                 sem a barra da bancada (nem no hover)
//
// A tela é a do cliente: o dashboard de verdade (DashboardBody) dentro da mesma moldura
// da página real do painel (FocusShell), com as mesmas margens e o mesmo encaixe na
// altura da tela. A barra da bancada fica escondida e aparece com o mouse no topo.
// Salvar métricas e disposição fica só na memória da aba (recarregar volta ao padrão).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { sampleCreatives } from "@/features/analytics/creatives/sample";
import { DashboardBody } from "@/features/dashboards/DashboardBody";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { canArrangeLayout } from "@/features/dashboards/layout/model";
import { ENTITLEMENTS, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { FocusShell } from "@/features/workspace/AppShell";
import type { WorkspaceSession } from "@/features/workspace/session";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { composedId, composePages, FEATURES, OBJECTIVES, type FeatureId, type ObjectiveId, type VisualId } from "@/features/templates/dashboards/composed";
import { DRAFT_VISUALS, VISUAL_LIST } from "@/features/templates/dashboards/visuais";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";

const ok = async () => ({ ok: true as const, data: undefined });
const ACCOUNTS = ["meta", "google", "ga4", "instagram", "facebook"] as const;
const PLANS: Exclude<Tier, "personalizado">[] = ["base", "pro", "avancado"];
const list = (v: string | null, fallback: string) => (v ?? fallback).split(",").filter(Boolean);

export function TemplatesBench() {
  const router = useRouter();
  const pathname = usePathname();
  const q = useSearchParams();
  const visuals = [...VISUAL_LIST, ...DRAFT_VISUALS];
  const visual = (visuals.find((v) => v.id === q.get("visual"))?.id ?? "lavanda") as VisualId;
  const objective = (OBJECTIVES.find((o) => o.id === q.get("objetivo"))?.id ?? "ecommerce") as ObjectiveId;
  const accountsKey = q.get("contas") ?? "meta,google,ga4";
  const featuresKey = q.get("recursos") ?? "";
  const accounts = useMemo(() => list(accountsKey, ""), [accountsKey]);
  const features = useMemo(() => list(featuresKey, "") as FeatureId[], [featuresKey]);
  const plan = (PLANS.find((p) => p === q.get("plano")) ?? "avancado") as Exclude<Tier, "personalizado">;
  const hideSpend = q.get("ocultar") === "1";
  const showBar = q.get("barra") !== "0";
  const pages = useMemo(() => composePages(accounts, features), [accounts, features]);
  const page = (pages.includes(q.get("pagina") as PageId) ? q.get("pagina") : pages[0]) as PageId;
  const t = dashboardTemplate(composedId(visual, objective));

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(q.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "pagina") next.delete("pagina");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const toggle = (key: string, current: string[], item: string) => set(key, (current.includes(item) ? current.filter((x) => x !== item) : [...current, item]).join(","));

  const spec = { templateId: t?.id ?? "", name: t?.name ?? "", client: "Loja Verde", pages, settings: DEFAULT_SETTINGS };
  const creatives = useMemo(
    () => (t ? sampleCreatives(t, { name: spec.name, client: spec.client, settings: DEFAULT_SETTINGS }, pages, { tier: plan, tab: q.get("aba") === "comparativo" ? "comparativo" : "galeria" }, { period: "30d", customDays: 30, hideSpend }) : undefined),
    [t, spec.name, spec.client, pages, plan, q, hideSpend],
  );
  const isDraft = DRAFT_VISUALS.some((v) => v.id === visual);

  const bar = (
    <div className="border-b border-line bg-card/95 px-4 py-3 shadow-[0_12px_40px_-16px_rgba(0,0,0,.45)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
        <strong className="text-[13px]">Bancada de modelos</strong>
        <Group label="Visual">
          {visuals.map((v) => (
            <Chip key={v.id} on={v.id === visual} onClick={() => set("visual", v.id)}>
              {v.name}
              {v.draft && <span className="ml-1 rounded-full bg-[#d9a23b]/25 px-1.5 text-[10px] text-[#b07f1c]">rascunho</span>}
            </Chip>
          ))}
        </Group>
        <Group label="Objetivo">
          <select value={objective} onChange={(e) => set("objetivo", e.target.value)} className="h-7 rounded-control border border-line bg-bg px-2">
            {OBJECTIVES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Group>
        <Group label="Contas">
          {ACCOUNTS.map((a) => (
            <Chip key={a} on={accounts.includes(a)} onClick={() => toggle("contas", accounts, a)}>
              {a}
            </Chip>
          ))}
        </Group>
        <Group label="Recursos">
          {FEATURES.map((f) => (
            <Chip key={f.id} on={features.includes(f.id)} onClick={() => toggle("recursos", features, f.id)}>
              {f.label}
            </Chip>
          ))}
        </Group>
        <Group label="Plano">
          {PLANS.map((p) => (
            <Chip key={p} on={p === plan} onClick={() => set("plano", p)}>
              {TIER_LABEL[p]}
            </Chip>
          ))}
        </Group>
        <Group label="">
          <Chip on={hideSpend} onClick={() => set("ocultar", hideSpend ? null : "1")}>
            Investimento oculto
          </Chip>
          <ThemeToggle />
        </Group>
      </div>
      <p className="mt-1.5 text-[11.5px] text-fg-2">
        {t ? <code>{t.id}</code> : "modelo não encontrado"} · plano do modelo: {t ? TIER_LABEL[t.tier] : "?"}
        {isDraft ? " · RASCUNHO: não aparece na galeria nem no banco" : ""} · abas: {pages.map((p) => PAGES[p]?.name ?? p).join(", ")} · salvar fica só nesta aba do navegador
      </p>
    </div>
  );

  return (
    <WorkspaceProvider session={benchSession(plan)}>
      <TooltipProvider>
        {/* a barra da bancada flutua por cima e só aparece com o mouse no topo: a tela embaixo é a do cliente */}
        {showBar && (
          <div className="group fixed inset-x-0 top-0 z-[200] h-3 focus-within:h-auto hover:h-auto">
            <div className="-translate-y-full opacity-0 transition-[transform,opacity] duration-200 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">{bar}</div>
            <span className="pointer-events-none absolute top-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-b-full bg-accent/60 group-hover:opacity-0" aria-hidden />
          </div>
        )}
        {/* a mesma moldura da página real do dashboard (/painel/dashboards/[id]): margens, largura e encaixe na tela */}
        <FocusShell>
          {t ? (
            <DashboardBody
              // remonta ao trocar de modelo, contas ou plano: o estado do Personalizar começa do zero
              key={`${t.id}|${pages.join()}|${plan}|${hideSpend}`}
              spec={spec}
              hideSpend={hideSpend}
              initialPage={page}
              customizeId="00000000-0000-0000-0000-000000000000"
              saveMetrics={ok}
              saveLayout={ok}
              canArrange={canArrangeLayout(plan)}
              creatives={creatives}
              backHref="/dev/templates"
            />
          ) : (
            <p className="text-fg-2">Esse visual não tem modelo para o objetivo escolhido.</p>
          )}
        </FocusShell>
      </TooltipProvider>
    </WorkspaceProvider>
  );
}

/** Sessão de mentira, só para a moldura do painel (aviso da assinatura, papel, plano). */
function benchSession(tier: Exclude<Tier, "personalizado">): WorkspaceSession {
  return {
    user: { id: "u-bancada", email: "bancada@exemplo.com", fullName: "Bancada", avatarUrl: null },
    workspace: { id: "ws-bancada", name: "Loja Verde", slug: "loja-verde", businessTypeId: "ecommerce", brandColor: "#4B5320", brandLogoUrl: null, hideVyzBrand: false, onboardingStep: "done", onboardingCompletedAt: "2026-11-01T00:00:00.000Z", timezone: "America/Sao_Paulo", currency: "BRL", product: "dash" },
    role: "owner",
    access: { hasAccess: true, tier, status: "active", interval: "year", accountsQuantity: 5, currentPeriodEnd: "2027-11-01T00:00:00.000Z", cancelAtPeriodEnd: false, entitlements: ENTITLEMENTS[tier] },
    usage: { dashboards: 1, landingPages: 0, publishedLandingPages: 0, enabledAdAccounts: 3, billableAccounts: 3, activeConnections: 2, projects: 1 },
    memberships: [{ id: "ws-bancada", name: "Loja Verde", role: "owner" }],
  };
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {label && <span className="text-fg-2">{label}</span>}
      {children}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-7 items-center rounded-chip border px-2.5 ${on ? "border-accent bg-accent text-on-accent" : "border-line hover:border-accent"}`}>
      {children}
    </button>
  );
}
