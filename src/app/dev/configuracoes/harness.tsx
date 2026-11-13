"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChangeTemplateModal, type ChangeTemplateTarget } from "@/features/dashboards/ChangeTemplateModal";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { DashboardThumb } from "@/features/dashboards/DashboardsList";
import { activityLabel } from "@/features/workspace/history";
import type { SettingsData } from "@/features/workspace/dto";
import type { WorkspaceSession } from "@/features/workspace/session";
import { SettingsPage } from "@/features/workspace/SettingsPage";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";

const NOW = "2026-11-13T15:00:00.000Z";
const at = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();

const SESSION: WorkspaceSession = {
  user: { id: "u1", email: "pedro@exemplo.com", fullName: "Pedro Freitas", avatarUrl: null },
  workspace: { id: "ws1", name: "Agência Exemplo", slug: "agencia-exemplo", businessTypeId: "ecommerce", brandColor: "#4B5320", brandLogoUrl: null, hideVyzBrand: false, onboardingStep: "done", onboardingCompletedAt: NOW, timezone: "America/Sao_Paulo", currency: "BRL", product: "dash" },
  role: "owner",
  // sem marca própria no plano: o cartão "sob consulta" aparece
  access: { hasAccess: true, tier: "avancado", status: "active", interval: "year", accountsQuantity: 2, currentPeriodEnd: null, cancelAtPeriodEnd: false, entitlements: null },
  usage: { dashboards: 1, landingPages: 0, publishedLandingPages: 0, enabledAdAccounts: 2, billableAccounts: 2, activeConnections: 1, projects: 1 },
  memberships: [{ id: "ws1", name: "Agência Exemplo", role: "owner" }],
};

const EVENTS = ["dashboard.metrics_changed", "dashboard.viewed", "sync.finished", "dashboard.template_changed", "share_link.created", "dashboard.updated", "project.renamed", "integration.connected", "dashboard.created", "billing.checkout_completed", "onboarding.completed", "workspace.updated"];

const DATA: SettingsData = {
  now: NOW,
  profile: { fullName: "Pedro Freitas", email: "pedro@exemplo.com", phone: null },
  team: [{ userId: "u1", name: "Pedro Freitas", email: "pedro@exemplo.com", role: "owner", joinedAt: at(60 * 24 * 30), isYou: true }],
  invitations: [],
  access: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, at: at(i * 95 + 3), label: i % 4 === 3 ? "Saiu da conta" : "Entrou com e-mail e senha", tone: "neutral" as const, device: i % 2 ? "Safari no iPhone" : "Chrome no macOS", ip: `189.40.12.${10 + i}` })),
  activity: EVENTS.map((e, i) => ({ id: `a${i}`, at: at(i * 47 + 2), label: activityLabel(e, e.startsWith("integration.") ? { provider: "meta" } : {}), tone: "neutral" as const, actorName: i % 3 === 2 ? null : "Pedro Freitas" })),
};

export function SettingsHarness() {
  // ?modelo=1: o modal "Trocar modelo" da página Dashboards, aberto
  const params = useSearchParams();
  const modelo = params.get("modelo") === "1";
  const [target, setTarget] = useState<ChangeTemplateTarget | null>(modelo ? { id: "d1", name: "Vendas da loja", visual: "vyz", objective: "ecommerce" } : null);
  // ?miniatura=1: a miniatura da página Dashboards de um dashboard de amostra com verba pequena (o "Teste")
  if (params.get("miniatura") === "1")
    return (
      <div className="w-[360px] overflow-hidden rounded-card border border-line bg-card p-0" data-thumb-harness>
        <DashboardThumb d={{ templateId: "vyz-ecommerce", name: "Teste", client: "CAP", pages: ["visao-geral", "campanhas", "funil"], settings: { ...DEFAULT_SETTINGS, goal: 5000, margin: 0.4, budget: 100000 } }} />
      </div>
    );
  return (
    <WorkspaceProvider session={SESSION}>
      <ChangeTemplateModal dashboard={target} tier="pro" onClose={() => setTarget(null)} />
      <div className="mx-auto max-w-[1200px] bg-bg p-4 lg:p-8">
        <SettingsPage data={DATA} />
      </div>
    </WorkspaceProvider>
  );
}
