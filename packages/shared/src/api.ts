// Contrato da API /api/v1 (site ↔ app nativo). Mudou aqui, mudou nos dois.

export type ApiError = { code: string; message: string; fields?: Record<string, string> };

export type MeResponse = {
  user: { id: string; email: string | null; fullName: string; avatarUrl: string | null };
  defaultWorkspaceId: string | null;
  credits: number;
  workspaces: {
    id: string;
    name: string;
    role: "viewer" | "member" | "admin" | "owner";
    onboardingDone: boolean;
    plan: string | null;
    hasAccess: boolean;
    /** Onde o plano foi contratado: no site muda no site; na loja muda no app. */
    planSource: "site" | "app_store" | "play_store" | null;
    period: "mensal" | "anual" | null;
    accounts: number;
    cancelAtPeriodEnd: boolean;
    periodEnd: string | null;
    maxMembers: number;
  }[];
};

export type DashboardSummary = { id: string; name: string; clientName: string; templateId: string; period: string; updatedAt: string };
export type DashboardsResponse = { dashboards: DashboardSummary[] };

export type PushTokenInput = { platform: "ios" | "android"; token: string; appVersion?: string };

export type DeleteAccountResponse = { deleted: true };

/** O que o app usa do dashboard live (o site recebe o objeto completo). */
export type ApiKpi = {
  id: string;
  label: string;
  value: number | null;
  previous?: number | null;
  delta: number | null;
  format: "money" | "int" | "decimal" | "pct" | "ratio";
  better: "up" | "down" | "neutral";
  note?: string;
  help?: string;
  /** Série diária (null = sem dado no dia). */
  spark?: (number | null)[];
};

export type ApiDailyPoint = { date: string; spend: number | null; value: number; conversions: number; roas: number | null; maturing: boolean };

export type ApiCampaign = {
  id: string;
  name: string;
  status: string;
  kind: string | null;
  spend: number | null;
  /** Fatia do investimento do período (0–1). */
  spendShare: number;
  value: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
};

export type ApiFunnelStep = { id: string; label: string; count: number; rate: number | null; cost: number | null };

export type ApiCreative = {
  id: string;
  name: string;
  format: string;
  thumbnailUrl: string | null;
  spend: number | null;
  value: number;
  conversions: number;
  roas: number | null;
  linkCtr: number | null;
};

export type ApiSlice = { key: string; label: string; spend: number | null; value: number; conversions: number; roas: number | null };

export type ApiDashboardView = {
  kpis: ApiKpi[];
  daily?: ApiDailyPoint[];
  campaigns?: ApiCampaign[];
  breakEvenRoas?: number | null;
  hasData?: boolean;
  /** Meta */
  funnel?: ApiFunnelStep[];
  creatives?: ApiCreative[];
  placements?: ApiSlice[];
  /** Google */
  channels?: { channel: string; label: string; spend: number | null; value: number; conversions: number; roas: number | null }[];
  devices?: ApiSlice[];
};

export type DashboardDataResponse = {
  dashboard: {
    dashboard: { id: string; name: string; clientName: string; templateId: string };
    platform: "meta" | "google";
    status: "ok" | "no_accounts" | "no_data";
    currency: string;
    hideSpend?: boolean;
    current: { from: string; to: string; days: number };
    previous?: { from: string; to: string; days: number };
    maturingFrom?: string | null;
    view: ApiDashboardView;
  };
};
