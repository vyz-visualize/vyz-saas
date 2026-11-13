"use client";

// Sessão e dados de exemplo para ver o painel sem banco. ?tela= escolhe a página,
// ?papel=viewer troca o papel e ?plano=base|pro|avancado troca o plano.

import { useSearchParams } from "next/navigation";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import type { AdminReport, RevenueBlock } from "@/features/admin/types";
import type { AdminUserRow } from "@/features/admin/users";
import { UsersManager } from "@/features/admin/UsersManager";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { DashboardsList } from "@/features/dashboards/DashboardsList";
import type { DashboardListItem } from "@/features/dashboards/model";
import { ENTITLEMENTS, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import type { ProjectsState } from "@/features/projects/types";
import { AppShell } from "@/features/workspace/AppShell";
import type { HomeData, SettingsData } from "@/features/workspace/dto";
import { activityLabel } from "@/features/workspace/history";
import { HomePage } from "@/features/workspace/HomePage";
import type { MemberRole, WorkspaceSession } from "@/features/workspace/session";
import { SettingsPage } from "@/features/workspace/SettingsPage";
import { Upsell } from "@/features/workspace/Upsell";
import { PlanPage } from "@/features/workspace/PlanPage";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import type { BillingOverview } from "@/server/billing/queries";
import { DataHarness } from "../dados/harness";
import { SCREENS_DADOS } from "./screens-dados";
import { SCREENS_TAREFAS } from "./screens-tarefas";
import type { Screen } from "./types";

const NOW = "2026-11-13T15:00:00.000Z";
const at = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();
const day = (ago: number) => new Date(Date.parse(NOW) - ago * 86_400_000).toISOString();

function session(tier: Exclude<Tier, "personalizado">, role: MemberRole): WorkspaceSession {
  return {
    user: { id: "u1", email: "pedro@exemplo.com", fullName: "Pedro Freitas", avatarUrl: null },
    workspace: { id: "ws1", name: "Agência Exemplo", slug: "agencia-exemplo", businessTypeId: "ecommerce", brandColor: "#4B5320", brandLogoUrl: null, hideVyzBrand: false, onboardingStep: "done", onboardingCompletedAt: NOW, timezone: "America/Sao_Paulo", currency: "BRL", product: "dash" },
    role,
    access: { hasAccess: true, tier, status: "active", interval: "year", accountsQuantity: tier === "base" ? 5 : tier === "pro" ? 15 : 30, currentPeriodEnd: day(-200), cancelAtPeriodEnd: false, entitlements: ENTITLEMENTS[tier] },
    usage: { dashboards: 4, landingPages: 0, publishedLandingPages: 0, enabledAdAccounts: 5, billableAccounts: 5, activeConnections: 2, projects: 3 },
    memberships: [
      { id: "ws1", name: "Agência Exemplo", role },
      { id: "ws2", name: "Loja Aurora", role: "admin" },
    ],
  };
}

const HOME: HomeData = {
  now: NOW,
  recent: [
    { kind: "dashboard", id: "d1", title: "Loja Aurora · Vendas", sub: "Loja Aurora · VYZ · E-commerce", href: "/painel/dashboards/d1", updatedAt: at(12) },
    { kind: "dashboard", id: "d2", title: "Clínica Sol · Leads", sub: "Clínica Sol · Lavanda · Leads", href: "/painel/dashboards/d2", updatedAt: at(190) },
    { kind: "dashboard", id: "d3", title: "Imobiliária Vista · Captação", sub: "Imobiliária Vista · Pulso · Imobiliário", href: "/painel/dashboards/d3", updatedAt: at(60 * 26) },
    { kind: "dashboard", id: "d4", title: "Aurora · Black Friday", sub: "Loja Aurora · VYZ · E-commerce", href: "/painel/dashboards/d4", updatedAt: at(60 * 24 * 4) },
  ],
  connections: [
    { provider: "meta", name: "Meta Ads", connected: true, enabledCount: 3, accountsCount: 6, lastSyncedAt: at(42), syncFailed: false, syncing: false },
    { provider: "google", name: "Google Ads", connected: true, enabledCount: 2, accountsCount: 4, lastSyncedAt: at(180), syncFailed: true, syncing: false },
  ],
  activeShareLinks: 2,
  realDashboards: 3,
  firstRealDashboardHref: "/painel/dashboards/d1",
  guides: { available: false, rows: [] },
  tools: { reset: false, replay: false },
};

// conta nova: nada conectado, checklist aberto
const HOME_NEW: HomeData = {
  ...HOME,
  recent: [],
  connections: [
    { provider: "meta", name: "Meta Ads", connected: false, enabledCount: 0, accountsCount: 0, lastSyncedAt: null, syncFailed: false, syncing: false },
    { provider: "google", name: "Google Ads", connected: false, enabledCount: 0, accountsCount: 0, lastSyncedAt: null, syncFailed: false, syncing: false },
  ],
  activeShareLinks: 0,
  realDashboards: 0,
  firstRealDashboardHref: null,
};

const PROJECTS: ProjectsState = {
  projects: [
    { id: "p1", name: "Loja Aurora", createdAt: day(90), enabledAccounts: 3, dashboards: 2 },
    { id: "p2", name: "Clínica Sol", createdAt: day(40), enabledAccounts: 1, dashboards: 1 },
    { id: "p3", name: "Imobiliária Vista do Parque Empreendimentos", createdAt: day(8), enabledAccounts: 1, dashboards: 1 },
  ],
  quantity: 15,
  maxAccountsPerPlatform: 3,
  canEdit: true,
  canArchive: true,
};

const dash = (id: string, templateId: string, name: string, client: string, real: boolean): DashboardListItem => ({
  id,
  templateId,
  name,
  client,
  pages: ["visao-geral", "campanhas", "funil"],
  settings: { ...DEFAULT_SETTINGS, goal: 12_000_000, budget: 3_000_000 },
  live: false,
  sources: real ? [{ id: `${id}-a`, name: `${client} · Meta`, platformId: "meta", isEnabled: true }] : [],
  createdAt: day(30),
  updatedAt: day(1),
});

const DASHBOARDS: DashboardListItem[] = [
  dash("d1", "vyz-ecommerce", "Loja Aurora · Vendas", "Loja Aurora", true),
  dash("d2", "lavanda-leads", "Clínica Sol · Leads", "Clínica Sol", true),
  dash("d3", "pulso-imob", "Imobiliária Vista · Captação", "Imobiliária Vista", false),
  dash("d4", "vyz-ecommerce", "Aurora · Black Friday", "Loja Aurora", false),
];

const revenue = (mrr: number, subs: number): RevenueBlock => ({ mrr: { BRL: mrr }, subscribers: subs, revenue30: { BRL: Math.round(mrr * 1.08) }, churned30: Math.round(subs * 0.04), churnRate: 3.8, refunds30: { BRL: 219.9 }, refundCount30: 1, trials: 2 });

const REPORT: AdminReport = {
  generatedAt: NOW,
  users: {
    ok: true,
    data: {
      total: 482,
      new7: 37,
      new30: 141,
      newPrev7: 29,
      active7: 163,
      active30: 311,
      workspacesWithPlan: 96,
      signupsByDay: Array.from({ length: 30 }, (_, i) => ({ date: day(29 - i).slice(0, 10), n: (i * 7) % 11 })),
      cohorts: [0, 1, 2, 3, 4].map((w) => ({ week: day(7 * (w + 1)).slice(0, 10), size: 28 + w * 3, returned: 11 + w })),
    },
  },
  ga4: {
    ok: true,
    data: {
      active1: 84,
      active7: 402,
      active28: 1310,
      newUsers28: 921,
      sessions28: 3480,
      topSources: [
        { source: "google / organic", users: 412 },
        { source: "instagram / paid", users: 288 },
        { source: "(direct) / (none)", users: 201 },
        { source: "facebook / paid", users: 97 },
      ],
      cohorts: [0, 1, 2, 3].map((w) => ({ week: `Sem. ${46 - w}`, size: 180 + w * 12, weeks: [100, 38 - w, 27 - w, 21, 17] })),
    },
  },
  stripe: { ok: true, data: revenue(18_420.5, 71) },
  appStore: { ok: true, data: revenue(4_210, 19) },
  googlePlay: { ok: false, reason: "Sem credencial do Google Play (GOOGLE_SERVICE_ACCOUNT_PATH)." },
  revenueCat: { ok: true, data: { ...revenue(5_830, 25), note: "Soma App Store e Google Play, pela RevenueCat." } },
};

const USERS: AdminUserRow[] = [
  { id: "a1", email: "ana@lojaaurora.com.br", name: "Ana Prado", createdAt: day(120), lastSignInAt: day(0), signIns: 84, banned: false, workspace: { id: "w1", name: "Loja Aurora", role: "owner" }, plan: { id: "avancado", tier: "avancado", status: "active", provider: "stripe", periodEnd: day(-140), courtesy: false }, openCheckout: null },
  { id: "a2", email: "bruno@clinicasol.com", name: "Bruno Lima", createdAt: day(60), lastSignInAt: day(1), signIns: 31, banned: false, workspace: { id: "w2", name: "Clínica Sol", role: "owner" }, plan: { id: "pro", tier: "pro", status: "active", provider: "cortesia", periodEnd: day(-300), courtesy: true }, openCheckout: null },
  { id: "a3", email: "carla.souza.marketing@imobiliariavistadoparque.com.br", name: "Carla Souza", createdAt: day(14), lastSignInAt: day(6), signIns: 4, banned: false, workspace: null, plan: null, openCheckout: { id: "c1", planId: "pro", createdAt: day(13) } },
  { id: "a4", email: "diego@agencia.dev", name: null, createdAt: day(9), lastSignInAt: null, signIns: 0, banned: false, workspace: null, plan: null, openCheckout: null },
  { id: "a5", email: "eva@exemplo.com", name: "Eva Martins", createdAt: day(200), lastSignInAt: day(90), signIns: 12, banned: true, workspace: { id: "w5", name: "Estúdio Eva", role: "owner" }, plan: null, openCheckout: null },
  { id: "a6", email: "fabio@exemplo.com", name: "Fábio Reis", createdAt: day(33), lastSignInAt: day(2), signIns: 19, banned: false, workspace: { id: "w1", name: "Loja Aurora", role: "member" }, plan: { id: "avancado", tier: "avancado", status: "active", provider: "app_store", periodEnd: day(-20), courtesy: false }, openCheckout: null },
];

const EVENTS = ["dashboard.metrics_changed", "dashboard.viewed", "sync.finished", "dashboard.template_changed", "share_link.created", "dashboard.updated", "project.renamed", "integration.connected", "dashboard.created", "billing.checkout_completed"];

const SETTINGS: SettingsData = {
  now: NOW,
  profile: { fullName: "Pedro Freitas", email: "pedro@exemplo.com", phone: null },
  team: [
    { userId: "u1", name: "Pedro Freitas", email: "pedro@exemplo.com", role: "owner", joinedAt: day(30), isYou: true },
    { userId: "u2", name: "Marina Alves", email: "marina@exemplo.com", role: "member", joinedAt: day(12), isYou: false },
  ],
  invitations: [{ id: "i1", email: "novo@exemplo.com", role: "viewer", expiresAt: day(-5) }],
  access: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, at: at(i * 95 + 3), label: i % 4 === 3 ? "Saiu da conta" : "Entrou com e-mail e senha", tone: "neutral" as const, device: i % 2 ? "Safari no iPhone" : "Chrome no macOS", ip: `189.40.12.${10 + i}` })),
  activity: EVENTS.map((e, i) => ({ id: `a${i}`, at: at(i * 47 + 2), label: activityLabel(e, e.startsWith("integration.") ? { provider: "meta" } : {}), tone: "neutral" as const, actorName: i % 3 === 2 ? null : "Pedro Freitas" })),
};

const BILLING: BillingOverview = {
  workspaceId: "ws1",
  provider: "mock",
  canManage: true,
  subscription: {
    id: "s1",
    tier: "pro",
    product: "dash",
    status: "active",
    interval: "year",
    accountsQuantity: 15,
    currentPeriodStart: day(165),
    currentPeriodEnd: day(-200),
    cancelAtPeriodEnd: false,
    createdAt: day(165),
    items: [{ id: "i1", kind: "plan", label: "Plano Padrão · até 15 projetos", quantity: 1, monthlyCents: 18325 }],
    monthlyCents: 18325,
    extrasMonthlyCents: 0,
    recurringCents: 219900,
  },
  customer: { email: "pedro@exemplo.com", legalName: "Agência Exemplo Ltda", taxId: null, phone: null },
  invoices: [
    { id: "f1", status: "paid", description: null, totalCents: 219900, amountPaidCents: 219900, currency: "BRL", lines: [{ label: "Plano Padrão anual", quantity: 1, amountCents: 219900 }], periodStart: day(165), periodEnd: day(-200), paidAt: day(165), createdAt: day(165), hostedUrl: null, pdfUrl: null },
    { id: "f2", status: "paid", description: null, totalCents: 5990, amountPaidCents: 5990, currency: "BRL", lines: [{ label: "Plano Básico mensal", quantity: 1, amountCents: 5990 }], periodStart: day(196), periodEnd: day(165), paidAt: day(196), createdAt: day(196), hostedUrl: null, pdfUrl: null },
    { id: "f3", status: "open", description: null, totalCents: 190000, amountPaidCents: 0, currency: "BRL", lines: [{ label: "Dashboard sob medida", quantity: 1, amountCents: 190000 }], periodStart: null, periodEnd: null, paidAt: null, createdAt: day(3), hostedUrl: null, pdfUrl: null },
  ],
  transactions: [
    { id: "t1", kind: "charge", status: "succeeded", amountCents: 219900, currency: "BRL", method: "card", cardBrand: "visa", cardLast4: "4242", failureMessage: null, processedAt: day(165), createdAt: day(165) },
    { id: "t2", kind: "charge", status: "failed", amountCents: 219900, currency: "BRL", method: "card", cardBrand: "mastercard", cardLast4: "5100", failureMessage: "Cartão recusado pelo banco", processedAt: day(166), createdAt: day(166) },
    { id: "t3", kind: "charge", status: "succeeded", amountCents: 5990, currency: "BRL", method: "pix", cardBrand: null, cardLast4: null, failureMessage: null, processedAt: day(196), createdAt: day(196) },
  ],
  timeline: [
    { id: 3, change: "plan_changed" as BillingOverview["timeline"][number]["change"], label: "Plano trocado de Básico para Padrão", actorName: "Pedro Freitas", createdAt: day(165) },
    { id: 2, change: "plan_changed" as BillingOverview["timeline"][number]["change"], label: "Período trocado de mensal para anual", actorName: "Pedro Freitas", createdAt: day(165) },
    { id: 1, change: "plan_changed" as BillingOverview["timeline"][number]["change"], label: "Assinatura criada no Básico", actorName: null, createdAt: day(196) },
  ],
  serviceOrders: [{ id: "o1", itemId: "dash_custom", label: "Dashboard sob medida", quantity: 1, status: "in_progress", createdAt: day(3), deliveredAt: null }],
};
const PLAN_USAGE = { projects: 3, dashboards: 4, publishedLandingPages: 0, enabledPlatforms: ["meta", "google"] };

const SCREENS: Record<string, Screen> = {
  ...SCREENS_DADOS,
  ...SCREENS_TAREFAS,
  inicio: {
    path: "/painel",
    node: () => (
      <div className="space-y-10">
        <HomePage data={HOME} />
        <Upsell />
      </div>
    ),
  },
  "inicio-novo": { path: "/painel", node: () => <HomePage data={HOME_NEW} /> },
  projetos: { path: "/painel/projetos", node: () => <ProjectsPage state={PROJECTS} /> },
  "projetos-vazio": { path: "/painel/projetos", node: () => <ProjectsPage state={{ ...PROJECTS, projects: [] }} /> },
  dashboards: {
    path: "/painel/dashboards",
    node: (tier, role) => (
      <DashboardsList items={DASHBOARDS} limit={ENTITLEMENTS[tier].maxDashboards} planLabel={TIER_LABEL[tier]} canEdit={role !== "viewer"} sources={[]} tier={tier} pagesTier={ENTITLEMENTS[tier].pages} hasProject brand={{ color: "#4B5320", logoUrl: null, canEdit: true }} />
    ),
  },
  plano: { path: "/painel/plano", node: () => <PlanPage overview={BILLING} usage={PLAN_USAGE} now={NOW} /> },
  configuracoes: { path: "/painel/configuracoes", node: () => <SettingsPage data={SETTINGS} /> },
  // tela cheia do dashboard (FocusShell): o conteúdo é o da bancada /dev/dados
  dashboard: { path: "/painel/dashboards/d1", node: () => <DataHarness /> },
  interno: { path: "/painel/interno", node: () => <AdminDashboard report={REPORT} /> },
  usuarios: { path: "/painel/interno/usuarios", node: () => <UsersManager users={USERS} /> },
};

export function PanelHarness() {
  const params = useSearchParams();
  const key = params.get("tela") ?? "inicio";
  const screen = SCREENS[key];
  const plano = params.get("plano");
  const tier = plano === "base" || plano === "avancado" ? plano : "pro";
  const papel = params.get("papel");
  const role: MemberRole = papel === "viewer" || papel === "member" || papel === "admin" ? papel : "owner";
  if (!screen) return <p className="p-6">Tela &quot;{key}&quot; não existe. Opções: {Object.keys(SCREENS).join(", ")}.</p>;
  return (
    <WorkspaceProvider session={session(tier, role)}>
      <AppShell isAdmin previewPath={screen.path} simulatedBilling={params.get("simulado") === "1"}>
        {screen.node(tier, role)}
      </AppShell>
    </WorkspaceProvider>
  );
}
