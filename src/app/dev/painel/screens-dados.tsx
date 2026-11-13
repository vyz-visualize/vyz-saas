"use client";

// Telas de dados da bancada (/dev/painel?tela=contas, compartilhar…), com dados de exemplo.
// contas-vazio e compartilhar-vazio são a conta nova; contas-aviso mostra a volta do login;
// compartilhar-modais abre os dois modais que nascem no dashboard (link e relatório agendado).
// ?papel=viewer tira as ações de quem só lê.

import { useState } from "react";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import type { PlatformId } from "@/features/accounts/platforms";
import { PROVIDER_IDS, type ProviderId } from "@/features/integrations/providers";
import type { AdAccountDTO, ConnectionDTO, ConnectState, LastSyncDTO, PlatformConnectState } from "@/features/integrations/types";
import { ReportModal } from "@/features/share/ReportModal";
import { ShareModal } from "@/features/share/ShareModal";
import { SharePage } from "@/features/share/SharePage";
import type { ShareCenter } from "@/features/share/types";
import type { MemberRole } from "@/features/workspace/session";
import type { Screen } from "./types";

const NOW = "2026-11-13T15:00:00.000Z";
const TZ = "America/Sao_Paulo";
const at = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();
const day = (ago: number) => new Date(Date.parse(NOW) - ago * 86_400_000).toISOString();

const PROJECTS = [
  { id: "p1", name: "Loja Aurora" },
  { id: "p2", name: "Clínica Sol" },
  { id: "p3", name: "Imobiliária Vista do Parque Empreendimentos" },
];

const sync = (status: LastSyncDTO["status"], over: Partial<LastSyncDTO> = {}): LastSyncDTO => ({ status, trigger: "scheduled", startedAt: at(40), finishedAt: status === "running" || status === "queued" ? null : at(39), rowsWritten: 1240, error: null, createdAt: at(41), ...over });

function account(id: string, platformId: PlatformId, name: string, externalId: string, over: Partial<AdAccountDTO> = {}): AdAccountDTO {
  return {
    id,
    platformId,
    connectionId: `c-${platformId}`,
    name,
    externalId,
    businessExternalId: null,
    businessName: null,
    managerExternalId: null,
    managerName: null,
    currency: "BRL",
    timezone: TZ,
    status: "active",
    isEnabled: false,
    enabledAt: null,
    lastSyncedAt: null,
    lastSync: null,
    manual: false,
    imported: null,
    fields: {},
    dashboards: [],
    projectId: null,
    ...over,
  };
}

const on = (projectId: string, minutesAgo: number, over: Partial<AdAccountDTO> = {}): Partial<AdAccountDTO> => ({ isEnabled: true, enabledAt: day(30), projectId, lastSyncedAt: at(minutesAgo), lastSync: sync("succeeded"), ...over });

function connection(provider: ProviderId, over: Partial<ConnectionDTO> = {}): ConnectionDTO {
  return {
    id: `c-${provider}`,
    provider,
    status: "active",
    userName: "Pedro Freitas",
    userEmail: "pedro@exemplo.com",
    isMock: true,
    connectedAt: day(30),
    connectedByName: "Pedro Freitas",
    tokenExpiresAt: day(-30),
    lastSyncedAt: at(42),
    lastError: null,
    accountsCount: 3,
    ...over,
  };
}

const AURORA_BM = { businessExternalId: "184736291045832", businessName: "Loja Aurora" };
const SOL_BM = { businessExternalId: "297364810563927", businessName: "Clínica Sol" };
const MCC = { managerExternalId: "987-654-3210", managerName: "Agência Exemplo · MCC" };

const META_ACCOUNTS: AdAccountDTO[] = [
  account("m1", "meta", "Loja Aurora · Vendas", "act_1029384756", { ...AURORA_BM, ...on("p1", 42, { dashboards: [{ id: "d1", name: "Loja Aurora · Vendas" }, { id: "d4", name: "Aurora · Black Friday" }] }) }),
  account("m2", "meta", "Loja Aurora · Remarketing", "act_5647382910", { ...AURORA_BM, ...on("p1", 42) }),
  account("m3", "meta", "Clínica Sol · Captação de pacientes", "act_8473629105", { ...SOL_BM, ...on("p2", 55, { dashboards: [{ id: "d2", name: "Clínica Sol · Leads" }] }) }),
  account("m4", "meta", "Imobiliária Vista · Lançamentos", "act_7362910584", { businessExternalId: "552019384716203", businessName: "Imobiliária Vista" }),
  account("m5", "meta", "Conta antiga (sem acesso)", "act_3301928475", { businessExternalId: "552019384716203", businessName: "Imobiliária Vista", status: "disabled" }),
];
const INSTAGRAM: AdAccountDTO[] = [
  account("i1", "instagram", "@lojaaurora", "17841400123456789", { connectionId: "c-meta", ...on("p1", 48) }),
  account("i2", "instagram", "@clinicasol", "17841400987654321", { connectionId: "c-meta" }),
];
const FACEBOOK: AdAccountDTO[] = [account("f1", "facebook", "Loja Aurora", "104857392016483", { connectionId: "c-meta" })];

const GOOGLE_ACCOUNTS: AdAccountDTO[] = [
  account("g1", "google", "Loja Aurora · Brasil", "123-456-7890", { ...MCC, ...on("p1", 180, { lastSync: sync("failed", { error: "O Google Ads recusou o acesso: reconecte o login para continuar sincronizando." }), dashboards: [{ id: "d1", name: "Loja Aurora · Vendas" }] }) }),
  account("g2", "google", "Loja Aurora · Shopping", "234-567-8901", { ...MCC, ...on("p1", 1, { lastSyncedAt: null, lastSync: sync("running", { trigger: "initial", startedAt: at(0.3), createdAt: at(0.4) }) }) }),
  account("g3", "google", "Clínica Sol · Pesquisa", "345-678-9012", { ...MCC }),
];

const GA4_ACCOUNTS: AdAccountDTO[] = [account("a1", "ga4", "Loja Aurora · Site", "312345678", { managerExternalId: "20938475", managerName: "Loja Aurora", isEnabled: true, enabledAt: at(5), projectId: "p1" })];

const empty = (provider: ProviderId): PlatformConnectState => ({ platformId: provider as PlatformConnectState["platformId"], provider, connected: false, connections: [], accounts: [], enabledCount: 0 });

function connectState(role: MemberRole, connected: boolean): ConnectState {
  const platforms = Object.fromEntries(PROVIDER_IDS.map((p) => [p, empty(p)])) as Record<ProviderId, PlatformConnectState>;
  if (connected) {
    platforms.meta = {
      ...empty("meta"),
      connected: true,
      connections: [connection("meta", { accountsCount: 8 })],
      accounts: META_ACCOUNTS,
      enabledCount: 3,
      extras: [
        { platformId: "instagram", accounts: INSTAGRAM },
        { platformId: "facebook", accounts: FACEBOOK },
      ],
    };
    platforms.google = {
      ...empty("google"),
      connected: true,
      connections: [connection("google", { userName: "Marina Alves", userEmail: "marina@exemplo.com", connectedByName: "Marina Alves", accountsCount: 3 }), connection("google", { id: "c-google-2", status: "expired", userName: null, userEmail: "antigo@exemplo.com", accountsCount: 1, connectedAt: day(200) })],
      accounts: GOOGLE_ACCOUNTS,
      enabledCount: 2,
    };
    platforms.ga4 = { ...empty("ga4"), connected: true, connections: [connection("ga4", { accountsCount: 1 })], accounts: GA4_ACCOUNTS, enabledCount: 1 };
  }
  return {
    platforms,
    providers: ["meta", "google", "tiktok", "linkedin", "ga4", "rdstation", "hubspot", "pipedrive", "kommo"],
    limit: { accountsQuantity: 15, billableAccounts: connected ? 5 : 0, maxAccountsPerPlatform: 3 },
    projects: connected ? PROJECTS : [],
    canManage: role === "owner" || role === "admin",
    canSync: role !== "viewer",
    mock: true,
  };
}

const MANUAL: AdAccountDTO[] = [
  account("x1", "mercado", "Mercado Ads · Loja Aurora", "123456789", { connectionId: null, manual: true, status: "pending", fields: { account: "123456789" } }),
  account("x2", "youtube", "YouTube · Clínica Sol", "456-789-0123", { connectionId: null, manual: true, status: "pending", fields: { account: "456-789-0123" }, dashboards: [{ id: "d2", name: "Clínica Sol · Leads" }] }),
];

const IMPORTED: AdAccountDTO[] = [
  account("s1", "shopee", "Shopee · Loja Aurora", "planilha-s1", { connectionId: null, imported: { sheet: true }, ...on("p1", 60 * 20, { dashboards: [{ id: "d1", name: "Loja Aurora · Vendas" }] }) }),
  account("s2", "spotify", "Spotify Ads · Aurora", "planilha-s2", { connectionId: null, imported: { sheet: false }, ...on("p1", 60 * 24 * 9, { lastSync: sync("failed", { error: "Linha 14: a data não está no formato dd/mm/aaaa." }) }) }),
];

const CENTER: ShareCenter = {
  links: [
    { id: "l1", dashboardId: "d1", dashboardName: "Loja Aurora · Vendas", tokenHint: "x7Kq2a", hideSpend: false, expiresAt: day(-24), revokedAt: null, viewCount: 148, lastViewedAt: at(95), createdAt: day(6), canRevoke: true },
    { id: "l2", dashboardId: "d2", dashboardName: "Clínica Sol · Leads", tokenHint: "9mTb41", hideSpend: true, expiresAt: null, revokedAt: null, viewCount: 37, lastViewedAt: day(2), createdAt: day(21), canRevoke: true },
    { id: "l3", dashboardId: "d3", dashboardName: "Imobiliária Vista do Parque Empreendimentos · Captação de leads", tokenHint: "Qw88zL", hideSpend: false, expiresAt: day(3), revokedAt: null, viewCount: 12, lastViewedAt: day(9), createdAt: day(33), canRevoke: false },
    { id: "l4", dashboardId: "d4", dashboardName: "Aurora · Black Friday", tokenHint: "pL0v3r", hideSpend: false, expiresAt: day(-60), revokedAt: day(1), viewCount: 0, lastViewedAt: null, createdAt: day(12), canRevoke: true },
  ],
  reports: [
    { id: "r1", dashboardId: "d1", dashboardName: "Loja Aurora · Vendas", frequency: "weekly", weekday: 1, monthDay: null, sendHour: 8, timezone: TZ, format: "pdf", isActive: true, nextRunAt: day(-3), lastRunAt: day(4), recipients: ["ana@lojaaurora.com.br", "financeiro@lojaaurora.com.br"], createdAt: day(40) },
    { id: "r2", dashboardId: "d2", dashboardName: "Clínica Sol · Leads", frequency: "monthly", weekday: null, monthDay: 5, sendHour: 9, timezone: TZ, format: "whatsapp", isActive: false, nextRunAt: null, lastRunAt: day(38), recipients: ["+5571999990000"], createdAt: day(70) },
  ],
  deliveries: [
    { id: "e1", dashboardName: "Loja Aurora · Vendas", status: "sent", channel: "email", recipientsCount: 2, periodStart: "2026-11-02", periodEnd: "2026-11-08", error: null, createdAt: day(4) },
    { id: "e2", dashboardName: "Clínica Sol · Leads", status: "failed", channel: "whatsapp", recipientsCount: 1, periodStart: "2026-10-01", periodEnd: "2026-10-31", error: "Número sem WhatsApp.", createdAt: day(8) },
    { id: "e3", dashboardName: null, status: "queued", channel: "email", recipientsCount: 3, periodStart: null, periodEnd: null, error: null, createdAt: day(0) },
  ],
  exports: [
    { id: "x1", dashboardId: "d1", dashboardName: "Loja Aurora · Vendas", kind: "pdf", createdAt: day(1) },
    { id: "x2", dashboardId: null, dashboardName: "Campanha de inverno", kind: "pdf", createdAt: day(45) },
  ],
};

const EMPTY_CENTER: ShareCenter = { links: [], reports: [], deliveries: [], exports: [] };

/** Os dois modais que o dashboard abre: ?tela=compartilhar-modais (o link) e, pelo botão, o relatório. */
function ShareModals() {
  const [open, setOpen] = useState<"link" | "relatorio" | null>("link");
  const dashboard = { id: "d1", name: "Loja Aurora · Vendas", live: true };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" data-open-link onClick={() => setOpen("link")} className="h-9 rounded-control border border-line px-3 text-[13.5px]">
        Abrir Compartilhar dashboard
      </button>
      <button type="button" data-open-report onClick={() => setOpen("relatorio")} className="h-9 rounded-control border border-line px-3 text-[13.5px]">
        Abrir Agendar relatório
      </button>
      <ShareModal open={open === "link"} onClose={() => setOpen(null)} dashboard={dashboard} />
      <ReportModal open={open === "relatorio"} onClose={() => setOpen(null)} dashboard={dashboard} />
    </div>
  );
}

export const SCREENS_DADOS: Record<string, Screen> = {
  contas: {
    path: "/painel/contas",
    node: (_tier, role) => <AccountsPage state={connectState(role, true)} manual={MANUAL} imported={IMPORTED} result={null} now={NOW} timeZone={TZ} showTestBadges />,
  },
  "contas-vazio": {
    path: "/painel/contas",
    node: (_tier, role) => <AccountsPage state={connectState(role, false)} manual={[]} imported={[]} result={null} now={NOW} timeZone={TZ} showTestBadges={false} />,
  },
  "contas-aviso": {
    path: "/painel/contas",
    node: (_tier, role) => (
      <AccountsPage
        state={connectState(role, true)}
        manual={MANUAL}
        imported={IMPORTED}
        result={{ kind: "error", code: "permissoes_negadas", provider: "google", message: "Faltou autorizar o acesso aos anúncios. Conecte de novo e mantenha todas as permissões marcadas." }}
        now={NOW}
        timeZone={TZ}
        showTestBadges
      />
    ),
  },
  compartilhar: { path: "/painel/compartilhar", node: (_tier, role) => <SharePage center={CENTER} now={NOW} timeZone={TZ} canEdit={role !== "viewer"} /> },
  "compartilhar-vazio": { path: "/painel/compartilhar", node: (_tier, role) => <SharePage center={EMPTY_CENTER} now={NOW} timeZone={TZ} canEdit={role !== "viewer"} /> },
  "compartilhar-modais": { path: "/painel/compartilhar", node: () => <ShareModals /> },
};
