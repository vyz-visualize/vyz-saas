// Otimizações que o VYZ aplica nas plataformas pela API, a partir das tarefas
// do A Fazer. Puro: serve ao site, ao app, às rotas e aos testes.
//
// Dois tipos de mudança, sempre numa campanha que já existe:
//   - pause:  pausar a campanha (nunca reativa sozinho; reativar só desfazendo);
//   - budget: mudar o orçamento diário da campanha.
// Com aprovação (todos os planos): a pessoa vê o "de → para" e toca em Aplicar.
// Automático (Avançado): o VYZ aplica dentro dos limites do projeto (ver
// checkAutopilot) e avisa pelo app e pelo WhatsApp. Tudo fica registrado e
// pode ser desfeito.

export type OptimizationKind = "pause" | "budget";

/** Plataformas em que o VYZ consegue aplicar pela API (escrita). */
export const WRITE_PLATFORMS = ["meta", "google", "tiktok"] as const;
export type WritePlatform = (typeof WRITE_PLATFORMS)[number];
export const isWritePlatform = (v: unknown): v is WritePlatform => (WRITE_PLATFORMS as readonly unknown[]).includes(v);

/** Ação proposta, gravada na tarefa (tasks.action). */
export type OptimizationAction = {
  kind: OptimizationKind;
  platform: WritePlatform;
  /** ad_campaigns.id (uuid do VYZ). */
  campaignId: string;
  campaignName: string;
  currency: string;
  /** pause: status de antes e depois. budget: orçamento diário de antes e depois. */
  from: number | "active" | "paused";
  to: number | "active" | "paused";
};

/** O que a análise pede. */
export type CampaignFacts = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived" | "removed";
  dailyBudget: number | null;
  startedOn: string | null;
  currency: string;
  platform: string;
};

/** Passo das mudanças de orçamento propostas (20%). */
export const BUDGET_STEP = 0.2;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * A ação de uma análise, ou null quando ela não vira mudança automática
 * (queda de KPI, criativo cansado, termos de pesquisa: ficam como tarefa manual).
 */
export function proposeAction(insightId: string, c: CampaignFacts | null | undefined): OptimizationAction | null {
  if (!c || !isWritePlatform(c.platform) || c.status !== "active") return null;
  const kind = insightId.split(":")[0];
  const base = {
    platform: c.platform,
    campaignId: c.id,
    campaignName: c.name,
    currency: c.currency,
  };
  if (kind === "zero") return { ...base, kind: "pause", from: "active", to: "paused" };
  if (!c.dailyBudget || c.dailyBudget <= 0) return null;
  if (kind === "be")
    return {
      ...base,
      kind: "budget",
      from: c.dailyBudget,
      to: round2(c.dailyBudget * (1 - BUDGET_STEP)),
    };
  if (kind === "best")
    return {
      ...base,
      kind: "budget",
      from: c.dailyBudget,
      to: round2(c.dailyBudget * (1 + BUDGET_STEP)),
    };
  return null;
}

const money = (v: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);

/** "Orçamento diário de R$ 100,00 para R$ 80,00" ou "Pausar a campanha". */
export function describeAction(a: OptimizationAction): string {
  if (a.kind === "pause") return a.to === "paused" ? `Pausar a campanha ${a.campaignName}` : `Reativar a campanha ${a.campaignName}`;
  return `Orçamento diário de ${a.campaignName}: de ${money(a.from as number, a.currency)} para ${money(a.to as number, a.currency)}`;
}

/** A ação que desfaz (volta ao "de"). */
export function inverseAction(a: OptimizationAction): OptimizationAction {
  return { ...a, from: a.to, to: a.from };
}

/** Variação do orçamento (+0,2 = 20% a mais). */
export const budgetChange = (a: OptimizationAction) => (a.kind === "budget" ? (a.to as number) / (a.from as number) - 1 : 0);

// ---- automático (Avançado) ----------------------------------------------------------

export type AutopilotRules = {
  enabled: boolean;
  /** Variação máxima do orçamento de uma campanha por dia, em % (5 a 50). */
  maxBudgetChangePct: number;
  /** Pode aumentar orçamento (desligado: só reduz e pausa, nunca cria gasto novo). */
  allowIncrease: boolean;
  /** Pode pausar campanha sem conversão. */
  allowPause: boolean;
  /** Não mexe em campanha com menos dias que isto (ainda aprendendo). */
  minCampaignAgeDays: number;
};

export const DEFAULT_AUTOPILOT: AutopilotRules = {
  enabled: false,
  maxBudgetChangePct: 20,
  allowIncrease: false,
  allowPause: true,
  minCampaignAgeDays: 7,
};

export const AUTOPILOT_LIMITS = {
  minPct: 5,
  maxPct: 50,
  minAge: 3,
  maxAge: 30,
} as const;

export type AutopilotCheck = { ok: true; action: OptimizationAction } | { ok: false; reason: string };

/**
 * Se o automático pode aplicar a ação, já ajustada aos limites.
 * `changedToday` = variação de orçamento já aplicada hoje nesta campanha
 * (soma das variações, ex.: -0,1). `daysRunning` = dias desde o início.
 */
export function checkAutopilot(a: OptimizationAction, rules: AutopilotRules, ctx: { changedToday: number; daysRunning: number | null }): AutopilotCheck {
  if (!rules.enabled) return { ok: false, reason: "Automático desligado no projeto." };
  if (ctx.daysRunning === null || ctx.daysRunning < rules.minCampaignAgeDays)
    return {
      ok: false,
      reason: `Campanha com menos de ${rules.minCampaignAgeDays} dias.`,
    };
  if (a.kind === "pause") {
    if (a.to !== "paused") return { ok: false, reason: "O automático nunca reativa campanhas." };
    return rules.allowPause ? { ok: true, action: a } : { ok: false, reason: "Pausar está desligado no automático." };
  }
  const want = budgetChange(a);
  if (want > 0 && !rules.allowIncrease)
    return {
      ok: false,
      reason: "Aumentar orçamento está desligado no automático.",
    };
  const max = rules.maxBudgetChangePct / 100;
  const room = want > 0 ? max - Math.max(0, ctx.changedToday) : max + Math.min(0, ctx.changedToday);
  if (room <= 0.001)
    return {
      ok: false,
      reason: "Limite de mudança do dia já usado nesta campanha.",
    };
  const applied = Math.sign(want) * Math.min(Math.abs(want), room);
  const from = a.from as number;
  return { ok: true, action: { ...a, to: round2(from * (1 + applied)) } };
}

/** Normaliza as regras vindas do formulário ou do banco. */
export function cleanRules(input: Partial<AutopilotRules> | null | undefined): AutopilotRules {
  const r = { ...DEFAULT_AUTOPILOT, ...(input ?? {}) };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
  return {
    enabled: !!r.enabled,
    maxBudgetChangePct: clamp(r.maxBudgetChangePct, AUTOPILOT_LIMITS.minPct, AUTOPILOT_LIMITS.maxPct),
    allowIncrease: !!r.allowIncrease,
    allowPause: !!r.allowPause,
    minCampaignAgeDays: clamp(r.minCampaignAgeDays, AUTOPILOT_LIMITS.minAge, AUTOPILOT_LIMITS.maxAge),
  };
}

/** Lê uma ação gravada (jsonb), ou null se não for válida. */
export function parseAction(v: unknown): OptimizationAction | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (!isWritePlatform(a.platform) || typeof a.campaignId !== "string" || typeof a.campaignName !== "string" || typeof a.currency !== "string") return null;
  if (a.kind === "pause" && ((a.from === "active" && a.to === "paused") || (a.from === "paused" && a.to === "active"))) return a as unknown as OptimizationAction;
  if (a.kind === "budget" && typeof a.from === "number" && typeof a.to === "number" && a.from > 0 && a.to > 0) return a as unknown as OptimizationAction;
  return null;
}

export type OptimizationLogStatus = "applied" | "failed" | "undone" | "undo_failed";

/** Registro de uma mudança aplicada (para a lista e o botão Desfazer). */
export type OptimizationLogDTO = {
  id: string;
  taskId: string | null;
  description: string;
  mode: "manual" | "auto";
  status: OptimizationLogStatus;
  error: string | null;
  appliedAt: string;
  undoneAt: string | null;
  canUndo: boolean;
};
