"use client";

// Bancada do primeiro acesso, só em desenvolvimento (page.dev.tsx não vira rota
// no build de produção: ver pageExtensions no next.config.ts). Os componentes
// são os de verdade; o servidor é uma imitação em memória (sessionStorage), para
// o Playwright testar o fluxo sem banco e sem conta de teste.
//
//   ?tela=fluxo (padrão)       boas-vindas → projeto → conectar → contas e modelo → montando
//   ?tela=fluxo&conectado=meta volta do login (simulada): o modal reabre no conectar com "Conectado ✓"
//   ?tela=inicio&caso=pulou|meta|pronto
//   ?tela=dashboard            dashboard de exemplo com o aviso e o tour
//   ?reset=1                   começa de novo

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sampleCreatives } from "@/features/analytics/creatives/sample";
import { datasetFor, DEFAULT_SETTINGS } from "@/features/dashboards/data";
import type { Dataset } from "@/features/metrics/source";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import { SampleNotice } from "@/features/dashboards/SampleNotice";
import type { PlatformId } from "@/features/accounts/platforms";
import type { AdAccountDTO, ConnectState, PlatformConnectState } from "@/features/integrations/types";
import { CORE_PROVIDER_IDS, isProviderId, PROVIDER_IDS, type ProviderId } from "@/features/integrations/providers";
import { connectResult } from "@/features/integrations/results";
import type { AccountsPanelProps, FlowApi } from "@/features/onboarding/api";
import { DashboardTour } from "@/features/onboarding/DashboardTour";
import type { GuidesState } from "@/features/onboarding/guides";
import { suggestObjective } from "@/features/onboarding/objective";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import { stepIndex, type ActiveStep } from "@/features/onboarding/steps";
import type { OnboardingState } from "@/features/onboarding/types";
import { dashboardTemplate } from "@/features/templates/dashboards";
import type { HomeData } from "@/features/workspace/dto";
import { HomePage } from "@/features/workspace/HomePage";
import type { WorkspaceSession } from "@/features/workspace/session";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import type { ActionResult } from "@/server/supabase/errors";

const KEY = "vyz-dev:primeiro-acesso";
const BASE = "/dev/primeiro-acesso";
const NOW = "2026-11-12T15:00:00.000Z";
const TEMPLATE = "vyz-ecommerce";
const OK: ActionResult = { ok: true, data: undefined };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Mock = { step: ActiveStep; project: { id: string; name: string; named: boolean } | null; businessTypeId: string | null; connected: ProviderId[]; enabled: Record<string, string[]> };
const START: Mock = { step: "welcome", project: null, businessTypeId: null, connected: [], enabled: {} };

function load(): Mock {
  try {
    return { ...START, ...JSON.parse(sessionStorage.getItem(KEY) ?? "{}") };
  } catch {
    return START;
  }
}
function save(m: Mock) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

const NAMES: Record<string, string[]> = {
  meta: ["Loja da Ana · Vendas", "Loja da Ana · Remarketing"],
  google: ["Loja da Ana · Pesquisa", "Loja da Ana · Shopping"],
  instagram: ["@lojadaana"],
  facebook: ["Loja da Ana"],
};

function account(provider: ProviderId, n: number, enabled: boolean, platformId: PlatformId = provider): AdAccountDTO {
  const name = NAMES[platformId][n];
  return {
    id: `${platformId}-${n}`,
    platformId,
    connectionId: `c-${provider}`,
    name,
    externalId: `${provider === "meta" ? "act_" : ""}10000${n}`,
    businessExternalId: null,
    businessName: null,
    managerExternalId: null,
    managerName: null,
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    status: "active",
    isEnabled: enabled,
    enabledAt: enabled ? NOW : null,
    lastSyncedAt: enabled ? NOW : null,
    lastSync: null,
    manual: false,
    imported: null,
    fields: {},
    dashboards: [],
    projectId: enabled ? "p1" : null,
  };
}

function connectState(m: Mock): ConnectState {
  const platform = (p: ProviderId): PlatformConnectState => {
    const connected = m.connected.includes(p);
    const accounts = connected ? [0, 1].map((n) => account(p, n, (m.enabled[p] ?? []).includes(`${p}-${n}`))) : [];
    // a Meta traz o Instagram e a Página no mesmo login (como no produto)
    const extras = connected && p === "meta" ? (["instagram", "facebook"] as PlatformId[]).map((pid) => ({ platformId: pid, accounts: [account(p, 0, (m.enabled[`meta:${pid}`] ?? []).includes(`${pid}-0`), pid)] })) : [];
    return {
      ...(extras.length ? { extras } : {}),
      platformId: p,
      provider: p,
      connected,
      connections: connected ? [{ id: `c-${p}`, provider: p, status: "active", userName: "Pedro (simulado)", userEmail: null, isMock: true, connectedAt: NOW, connectedByName: null, tokenExpiresAt: null, lastSyncedAt: null, lastError: null, accountsCount: 2 }] : [],
      accounts,
      enabledCount: accounts.filter((a) => a.isEnabled).length,
    };
  };
  return {
    platforms: Object.fromEntries(PROVIDER_IDS.map((p) => [p, platform(p)])) as ConnectState["platforms"],
    providers: [...CORE_PROVIDER_IDS],
    limit: { accountsQuantity: 2, billableAccounts: 0, maxAccountsPerPlatform: 3 },
    projects: m.project ? [m.project] : [],
    canManage: true,
    canSync: true,
    mock: true,
  };
}

/** Imitação do seletor de contas (o de verdade grava no banco). */
function MockAccountsPanel({ group, onSelection }: AccountsPanelProps) {
  const { key, accounts } = group;
  const [picked, setPicked] = useState(() => accounts.filter((a) => a.isEnabled).map((a) => a.id));
  const initial = useMemo(() => accounts.filter((a) => a.isEnabled).map((a) => a.id).join(), [accounts]);
  useEffect(() => {
    onSelection(key, {
      dirty: picked.join() !== initial,
      count: picked.length,
      save: async () => {
        const m = load();
        save({ ...m, enabled: { ...m.enabled, [key]: picked } });
        return true;
      },
    });
  }, [picked, initial, onSelection, key]);
  return (
    <ul className="space-y-2">
      {accounts.map((a) => (
        <li key={a.id}>
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={picked.includes(a.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id)))} />
            {a.name}
          </label>
        </li>
      ))}
    </ul>
  );
}

function Flow() {
  const params = useSearchParams();
  const router = useRouter();
  const [mock, setMock] = useState<Mock | null>(null);

  useEffect(() => {
    if (params.get("reset") === "1") save(START);
    const m = load();
    // volta do login (simulada): a plataforma fica conectada
    const back = params.get("conectado");
    const next = back && isProviderId(back) && !m.connected.includes(back) ? { ...m, connected: [...m.connected, back] } : m;
    save(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o estado imitado do sessionStorage uma vez
    setMock(next);
  }, [params]);

  const update = useCallback((patch: Partial<Mock>) => {
    const m = { ...load(), ...patch };
    save(m);
    setMock(m);
  }, []);

  const api: FlowApi = useMemo(
    () => ({
      start: async () => (await wait(150), update({ step: "project" }), OK),
      saveProject: async (name, businessTypeId) => (await wait(150), update({ step: "connect", project: { id: "p1", name, named: true }, businessTypeId }), OK),
      toSetup: async () => {
        await wait(150);
        if (load().connected.length === 0) return { ok: false, error: { code: "onboarding:no_connection", message: "Conecte o Meta Ads ou o Google Ads para seguir." } };
        update({ step: "setup" });
        return OK;
      },
      build: async () => {
        await wait(200);
        const m = load();
        if (!Object.values(m.enabled).some((ids) => ids && ids.length)) return { ok: false, error: { code: "onboarding:no_accounts", message: "Ative pelo menos uma conta para montar o dashboard." } };
        return { ok: true, data: { id: "demo" } };
      },
      skip: async () => (await wait(150), router.push(`${BASE}?tela=inicio&caso=pulou`), OK),
      back: async (step) => (await wait(100), update({ step }), OK),
      // a Meta devolve com "#_=_" no fim (a tela limpa)
      connectHref: (p) => `${BASE}?tela=fluxo&conectado=${p}${p === "meta" ? "#_=_" : ""}`,
      finish: async () => (router.push(`${BASE}?tela=dashboard`), OK),
      AccountsPanel: MockAccountsPanel,
    }),
    [update, router],
  );

  if (!mock) return null;
  const late = stepIndex(mock.step) >= stepIndex("connect");
  const state: OnboardingState = {
    step: mock.step,
    firstName: "Pedro",
    workspaceName: "Agência Exemplo",
    businessTypeId: mock.businessTypeId,
    tier: "avancado",
    canManage: true,
    project: mock.project,
    connect: late ? connectState(mock) : null,
    showTestBadges: true,
    // como no primeiro acesso de verdade: as campanhas ainda estão sendo importadas
    suggestion: mock.step === "setup" ? suggestObjective([], mock.businessTypeId) : null,
  };
  const result = mock.step === "connect" ? connectResult(Object.fromEntries(params.entries())) : null;
  return (
    <div className="min-h-dvh bg-bg px-4 pt-16">
      <OnboardingFlow state={state} result={result} now={NOW} timeZone="America/Sao_Paulo" api={api} />
    </div>
  );
}

const SESSION: WorkspaceSession = {
  user: { id: "u1", email: "pedro@exemplo.com", fullName: "Pedro Freitas", avatarUrl: null },
  workspace: { id: "ws1", name: "Agência Exemplo", slug: "agencia-exemplo", businessTypeId: "ecommerce", brandColor: "#4B5320", brandLogoUrl: null, hideVyzBrand: false, onboardingStep: "done", onboardingCompletedAt: NOW, timezone: "America/Sao_Paulo", currency: "BRL", product: "dash" },
  role: "owner",
  access: { hasAccess: true, tier: "avancado", status: "active", interval: "year", accountsQuantity: 2, currentPeriodEnd: null, cancelAtPeriodEnd: false, entitlements: null },
  usage: { dashboards: 1, landingPages: 0, publishedLandingPages: 0, enabledAdAccounts: 0, billableAccounts: 0, activeConnections: 0, projects: 1 },
  memberships: [{ id: "ws1", name: "Agência Exemplo", role: "owner" }],
};
const GUIDES: GuidesState = { available: true, rows: [] };

function Inicio() {
  const caso = useSearchParams().get("caso") ?? "pulou";
  const con = (provider: ProviderId, n: number): HomeData["connections"][number] => ({
    provider,
    name: provider === "meta" ? "Meta Ads" : "Google Ads",
    connected: n > 0,
    enabledCount: n,
    accountsCount: n ? 2 : 0,
    lastSyncedAt: n ? NOW : null,
    syncFailed: false,
    syncing: false,
  });
  // pulou: quem pula o primeiro acesso não tem dashboard nenhum (pular não cria nada)
  const dashboard = { kind: "dashboard" as const, id: "demo", title: "Loja da Ana · Visão geral", sub: "Dashboard · VYZ", href: `${BASE}?tela=dashboard`, updatedAt: NOW };
  const cases: Record<string, Pick<HomeData, "connections" | "realDashboards" | "activeShareLinks" | "recent">> = {
    pulou: { connections: [con("meta", 0), con("google", 0)], realDashboards: 0, activeShareLinks: 0, recent: [] },
    meta: { connections: [con("meta", 1), con("google", 0)], realDashboards: 1, activeShareLinks: 0, recent: [dashboard] },
    pronto: { connections: [con("meta", 2), con("google", 1)], realDashboards: 1, activeShareLinks: 1, recent: [dashboard] },
  };
  const scenario = cases[caso] ?? cases.pulou;
  const session: WorkspaceSession = { ...SESSION, usage: { ...SESSION.usage, dashboards: scenario.recent.length, enabledAdAccounts: scenario.connections.reduce((n, c) => n + c.enabledCount, 0) } };
  const data: HomeData = {
    now: NOW,
    ...scenario,
    firstRealDashboardHref: `${BASE}?tela=dashboard`,
    guides: GUIDES,
    tools: { reset: false, replay: true },
  };
  return (
    <WorkspaceProvider session={session}>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        <HomePage data={data} />
      </div>
    </WorkspaceProvider>
  );
}

function Dashboard() {
  // ?metas=nenhuma: como o primeiro dashboard real, sem verba, alvo nem margem definidos
  const semMetas = useSearchParams().get("metas") === "nenhuma";
  const t = dashboardTemplate(TEMPLATE)!;
  const pages = t.pages;
  const settings = { ...DEFAULT_SETTINGS };
  const spec = { name: "Visão geral", client: "Loja da Ana", settings };
  const creatives = sampleCreatives(t, spec, pages, { tier: "avancado", tab: undefined, ads: undefined, upsell: false } as never, { period: settings.period, customDays: settings.customDays });
  const base = datasetFor({ templateId: t.id, ...spec }, 30);
  const realData: Dataset | undefined = semMetas ? { ...base, budget: { ...base.budget, monthly: 0 }, goal: 0, breakEven: 1, marginSet: false } : undefined;
  return (
    <WorkspaceProvider session={SESSION}>
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {!semMetas && <SampleNotice connectHref="/painel/contas" canConnect />}
        <SampleDashboard dashboard={{ id: "demo", templateId: t.id, ...spec, pages }} brand={{ color: "", logo: undefined, hideVyz: false }} canEdit sampleOnly={!semMetas} creatives={semMetas ? undefined : creatives} realData={realData} />
        {!semMetas && <DashboardTour onFinish={async () => OK} />}
      </div>
    </WorkspaceProvider>
  );
}

export function Harness() {
  const tela = useSearchParams().get("tela") ?? "fluxo";
  if (tela === "inicio") return <Inicio />;
  if (tela === "dashboard") return <Dashboard />;
  return <Flow />;
}
