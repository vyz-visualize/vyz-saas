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
  ctr?: number | null;
  cpc?: number | null;
  belowBreakEven?: boolean;
  resultLabel?: string;
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
  hookRate?: number | null;
  frequency?: number | null;
  fatigue?: { frequencyChange: number; ctrChange: number } | null;
};

export type ApiSlice = { key: string; label: string; spend: number | null; spendShare?: number; value: number; valueShare?: number; conversions: number; roas: number | null };

export type ApiAgeGender = { age: string; gender: string; spend: number | null; value: number; conversions: number; roas: number | null; valueShare: number };
export type ApiHeatCell = { weekday: number; hour: number; conversions: number; value: number; spend: number | null };
export type ApiSearchTerm = { term: string; matchType: string; campaignName: string; spend: number | null; clicks: number; conversions: number; value: number; roas: number | null };
export type ApiProduct = { id: string; title: string; imageUrl: string | null; spend: number | null; value: number; valueShare: number; conversions: number; roas: number | null };

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
  ageGender?: ApiAgeGender[];
  regions?: ApiSlice[];
  devices?: ApiSlice[];
  /** Google */
  channels?: { channel: string; label: string; spend: number | null; value: number; conversions: number; roas: number | null }[];
  heatmap?: ApiHeatCell[];
  searchTerms?: ApiSearchTerm[];
  wastedTerms?: ApiSearchTerm[];
  wastedSpend?: number | null;
  wastedShare?: number;
  products?: ApiProduct[];
  impressionShare?: { share: number | null; lostBudget: number | null; lostRank: number | null };
  filterInfo?: { labels?: Record<string, Record<string, string>> };
};

/** Análise automática (o que mudou, o que vai bem, o que pede atenção). */
export type ApiInsight = {
  id: string;
  dashboardId: string;
  dashboardName: string;
  tone: "good" | "bad" | "info";
  title: string;
  body: string;
  metric?: string;
  campaignId?: string;
};

export type InsightsResponse = {
  period: "7d" | "30d" | "mes";
  insights: ApiInsight[];
  pulse: { id: string; name: string; platform: "meta" | "google"; currency: string; spend: number | null; value: number; conversions: number; roas: number | null }[];
};

/** Resposta do VYZ no app. */
export type AgentReply = {
  text: string;
  card: { label: string; value: string; delta?: { text: string; good: boolean | null }; note?: string; hint?: string } | null;
  chart: { title: string; items: { label: string; value: number; display: string }[] } | null;
  dashboardId: string | null;
  suggestions: string[] | null;
  understood: boolean;
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
    /** Dashboards com Meta e Google: as duas plataformas (filtro com ?plataforma=). */
    platforms?: ("meta" | "google")[];
  };
  insights?: ApiInsight[];
};

// ---- A Fazer ---------------------------------------------------------------------------------

export type ApiTaskStatus = "planejado" | "em_andamento" | "concluido" | "cancelado";
export type ApiTaskStage = "midia_paga" | "cro" | "crm" | "criativos" | "relatorio" | "outro";
export type ApiTaskPriority = "alta" | "media" | "baixa";
export type ApiTaskSituation = "no_prazo" | "atrasado" | "concluido" | "sem_prazo";

export type ApiTask = {
  id: string;
  title: string;
  detail: string | null;
  status: ApiTaskStatus;
  stage: ApiTaskStage;
  priority: ApiTaskPriority;
  situation: ApiTaskSituation;
  startDate: string | null;
  dueDate: string | null;
  assignees: string[];
  groupId: string | null;
  projectId: string | null;
  projectName: string | null;
  dashboardId: string | null;
  platform: string | null;
  source: "manual" | "insight" | "playbook";
  autoNote: string | null;
  /** Criada pelo VYZ e ainda não aberta. */
  isNew: boolean;
  createdAt: string;
  completedAt: string | null;
  /** Mudança que o VYZ pode aplicar na plataforma (botão Aplicar), ou null. */
  action: { kind: "pause" | "budget"; platform: "meta" | "google" | "tiktok"; campaignName: string; from: number | "active" | "paused"; to: number | "active" | "paused"; currency: string } | null;
  /** O "de → para" pronto para mostrar. */
  actionText: string | null;
};

/** Mudança aplicada numa plataforma (com Desfazer). */
export type ApiOptimizationRun = {
  id: string;
  taskId: string | null;
  description: string;
  mode: "manual" | "auto";
  status: "applied" | "failed" | "undone" | "undo_failed";
  error: string | null;
  appliedAt: string;
  undoneAt: string | null;
  canUndo: boolean;
};

/** GET /workspaces/:id/tasks (?abertas=1 só as abertas). */
export type TasksResponse = { today: string; level: "basic" | "full"; canEdit: boolean; tasks: ApiTask[]; runs: ApiOptimizationRun[] };

/** POST /workspaces/:id/tasks/:taskId/apply e POST /workspaces/:id/optimizations/:runId/undo. */
export type OptimizationRunResponse = { run: ApiOptimizationRun };

/** PATCH /workspaces/:id/tasks/:taskId (no app: status, prioridade, etapa, prazo). */
export type TaskPatchRequest = Partial<{ title: string; status: ApiTaskStatus; stage: ApiTaskStage; priority: ApiTaskPriority; dueDate: string | null }>;
export type TaskPatchResponse = { task: ApiTask };

export const TASK_STATUS_LABEL: Record<ApiTaskStatus, string> = { planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };
export const TASK_STAGE_LABEL: Record<ApiTaskStage, string> = { midia_paga: "Mídia paga", cro: "CRO", crm: "CRM", criativos: "Criativos", relatorio: "Relatório", outro: "Outro" };
export const TASK_PRIORITY_LABEL: Record<ApiTaskPriority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const TASK_SITUATION_LABEL: Record<ApiTaskSituation, string> = { no_prazo: "No prazo", atrasado: "Atrasado", concluido: "Concluído", sem_prazo: "Sem prazo" };
