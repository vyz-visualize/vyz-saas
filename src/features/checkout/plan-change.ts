// Troca de plano, contas ou período: novo valor e o ajuste proporcional, no
// jeito da Stripe (proration). Mesmo período: cobra a diferença pelo tempo que
// falta no ciclo. Período novo (mensal ↔ anual): o ciclo recomeça agora e a
// sobra do ciclo atual vira desconto. Diferença negativa vira crédito (não é
// cobrada). E se o que já está em uso cabe no plano novo. A página Plano usa
// para a prévia; o servidor, para cobrar e para recusar.

import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { ENTITLEMENTS, TIER_LABEL, canUse } from "@/features/pricing/entitlements";
import { PLAN_PROJECTS, planMonthly, type Period, type PlanId } from "@/features/pricing/pricing";

export type PlanSelection = { tier: PlanId; period: Period; accounts: number };

export type PlanChangeQuote = {
  /** Plano por mês no período novo (todas as contas, áudio incluso). */
  planMonthlyCents: number;
  /** Cobrança por período depois da troca (plano + extras mensais). */
  recurringCents: number;
  /** Cobrado agora. */
  prorationCents: number;
  /** Sobra a favor do cliente (troca para menos). */
  creditCents: number;
  /** Troca de período: o ciclo recomeça agora. */
  resetsPeriod: boolean;
  periodStart: Date;
  periodEnd: Date;
};

const periodMonths = (p: Period) => (p === "anual" ? 12 : 1);

/** Soma meses no estilo do Postgres: 31/01 + 1 mês = 28/02 (ou 29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function quotePlanChange(input: {
  current: PlanSelection & { periodStart: Date; periodEnd: Date };
  next: PlanSelection;
  /** Extras mensais da assinatura (hospedagem de LP, dashboard sob medida), por mês. */
  extrasMonthlyCents: number;
  now: Date;
}): PlanChangeQuote {
  const { current, next, extrasMonthlyCents, now } = input;
  const recurring = (s: PlanSelection) => (planMonthly(s.tier, s.period) + extrasMonthlyCents) * periodMonths(s.period);
  const oldRecurring = recurring(current);
  const newRecurring = recurring(next);

  const total = current.periodEnd.getTime() - current.periodStart.getTime();
  const left = current.periodEnd.getTime() - now.getTime();
  const remaining = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const resetsPeriod = current.period !== next.period;

  // arredonda o valor absoluto: subir e descer o mesmo tanto dá o mesmo ajuste
  const delta = newRecurring - oldRecurring;
  const diff = resetsPeriod ? newRecurring - Math.round(oldRecurring * remaining) : Math.sign(delta) * Math.round(Math.abs(delta) * remaining);

  return {
    planMonthlyCents: planMonthly(next.tier, next.period),
    recurringCents: newRecurring,
    prorationCents: Math.max(0, diff),
    creditCents: Math.max(0, -diff),
    resetsPeriod,
    periodStart: resetsPeriod ? now : current.periodStart,
    periodEnd: resetsPeriod ? addMonths(now, periodMonths(next.period)) : current.periodEnd,
  };
}

/** Seleção de um plano fixo: os projetos são os do plano. */
export const planSelection = (tier: PlanId, period: Period): PlanSelection => ({ tier, period, accounts: PLAN_PROJECTS[tier] });

export const samePlan = (a: PlanSelection, b: PlanSelection) => a.tier === b.tier && a.period === b.period && a.accounts === b.accounts;

/** O que o workspace usa hoje (workspace_usage + plataformas das contas ativas). */
export type PlanUsage = { projects: number; dashboards: number; publishedLandingPages: number; enabledPlatforms: string[]; /** membros + convites pendentes */ members?: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** O uso atual cabe no plano novo? null = cabe; senão, o motivo (código e texto para a tela). */
export function planChangeBlocker(next: PlanSelection, usage: PlanUsage): { code: string; message: string } | null {
  const limits = ENTITLEMENTS[next.tier];
  const tier = TIER_LABEL[next.tier];
  if (usage.projects > next.accounts) {
    return {
      code: "limit:projects_in_use",
      message: `Você tem ${plural(usage.projects, "workspace ativo", "workspaces ativos")}. O ${tier} vai até ${next.accounts}. Arquive workspaces em Workspaces antes de trocar.`,
    };
  }
  if (usage.dashboards > limits.maxDashboards) {
    return {
      code: "limit:dashboards_in_use",
      message: `O ${tier} permite até ${limits.maxDashboards} dashboards e você tem ${usage.dashboards}. Apague alguns antes de trocar.`,
    };
  }
  if (usage.publishedLandingPages > limits.maxLandingPages) {
    return {
      code: "limit:landing_pages_in_use",
      message: `O ${tier} permite até ${plural(limits.maxLandingPages, "landing page publicada", "landing pages publicadas")} e você tem ${usage.publishedLandingPages}. Despublique antes de trocar.`,
    };
  }
  if ((usage.members ?? 0) > limits.maxMembers) {
    return {
      code: "limit:members_in_use",
      message: `O ${tier} permite até ${plural(limits.maxMembers, "usuário", "usuários")} e a equipe tem ${usage.members}. Remova pessoas ou cancele convites antes de trocar.`,
    };
  }
  const outside = usage.enabledPlatforms.map((id) => PLATFORMS[id as PlatformId]).find((p) => p && !canUse(next.tier, p.tier));
  if (outside) {
    return {
      code: "plan:platform_in_use",
      message: `${outside.name} é do plano ${TIER_LABEL[outside.tier]}. Desative essas contas antes de trocar para o ${tier}.`,
    };
  }
  return null;
}
