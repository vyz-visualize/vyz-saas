// Variáveis de cada relatório, a partir do que o motor de análises já calcula
// (loadWorkspaceInsights: análises + totais por dashboard). Puro: nenhuma
// métrica nova sai daqui, só soma e formatação para o template.

import type { Insight } from "@/features/insights/insights";
import { deltaText } from "./rules";

export type PulseLike = { currency: string; spend: number | null; conversions: number; previousSpend: number | null; previousConversions: number };
export type ReportInput = { firstName: string; workspaceName: string; insights: Insight[]; pulse: PulseLike[] };

const money = (v: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
const int = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

function sums(pulse: PulseLike[]) {
  const currency = pulse[0]?.currency ?? "BRL";
  const spend = pulse.reduce((n, p) => n + (p.spend ?? 0), 0);
  const prevSpend = pulse.reduce((n, p) => n + (p.previousSpend ?? 0), 0);
  const conv = pulse.reduce((n, p) => n + p.conversions, 0);
  const prevConv = pulse.reduce((n, p) => n + p.previousConversions, 0);
  return { currency, spend, prevSpend, conv, prevConv };
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "tudo bem";

/** "2 de Meta Ads e 1 de Google Ads". */
export function accountsText(byPlatform: Record<string, number>): string {
  const label: Record<string, string> = { meta: "Meta Ads", google: "Google Ads", ga4: "GA4", tiktok: "TikTok", linkedin: "LinkedIn" };
  const parts = Object.entries(byPlatform)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${n} de ${label[p] ?? p}`);
  if (!parts.length) return "nenhuma ainda";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

export function welcomeParams(input: ReportInput, accounts: Record<string, number>): string[] {
  const s = sums(input.pulse);
  const top = input.insights[0];
  return [firstName(input.firstName), input.workspaceName, accountsText(accounts), money(s.spend, s.currency), int(s.conv), top ? top.title + "." : "os números aparecem aqui assim que a primeira sincronização terminar."];
}

/** null = nada a dizer hoje (não envia). */
export function dailyParams(input: ReportInput): string[] | null {
  const top = input.insights[0];
  if (!top) return null;
  return [firstName(input.firstName), input.workspaceName, `${top.title}.`, top.body];
}

/** null = sem dados na semana. */
export function weeklyParams(input: ReportInput): string[] | null {
  if (!input.pulse.length) return null;
  const s = sums(input.pulse);
  const moves = input.insights.filter((i) => i.id.startsWith("kpi:")).slice(0, 2);
  const changed = moves.length ? moves.map((m) => `${m.title}.`).join(" ") : input.insights[0] ? `${input.insights[0].title}.` : "nada fora do normal.";
  return [firstName(input.firstName), input.workspaceName, money(s.spend, s.currency), deltaText(s.spend, s.prevSpend), int(s.conv), deltaText(s.conv, s.prevConv), changed];
}

export function alertParams(workspaceName: string, i: Insight): string[] {
  return [workspaceName, i.dashboardName, `${i.title}.`, i.body];
}
