// Contrato do cérebro do VYZ. Hoje só existe o LocalEngine (intenções em
// PT-BR, contexto montado no servidor); um LlmEngine futuro entra pela mesma interface.

import type { Totals } from "@/features/metrics/compute";
import type { Entitlements, Tier } from "@/features/pricing/entitlements";
import type { MetricId } from "@/features/metrics/definitions";
import type { Profile } from "@/features/metrics/definitions";

/** Um dashboard da conta, com os totais do mês até hoje e do período anterior de mesmo tamanho. */
export type ClientData = {
  dashboardId: string;
  dashboardName: string;
  client: string;
  profile: Profile;
  cur: Totals;
  prev: Totals;
  /** Métricas que aparecem como KPI na primeira página (alvos do "Mostrar no painel"). */
  kpis: MetricId[];
};

export type AgentContext = {
  now: Date;
  tier: Tier;
  tierLabel: string;
  ent: Entitlements;
  dashboards: ClientData[];
  /** Este workspace usa o módulo de landing pages? (false = em breve, lista de espera) */
  landingPages: boolean;
  counts: { dashboards: number; landingPublished: number; accounts: number; contractedAccounts: number };
};

export type AgentAction =
  | { type: "theme"; theme: "light" | "dark" }
  | { type: "navigate"; href: string; label: string };

/** Onde o card mora no painel: dashboard + KPI. */
export type AgentTarget = { dashboardId: string; metric: MetricId };

export type AgentAnswer = {
  /** Texto com **negrito** nos números. */
  text: string;
  /** Versão para a voz e a legenda (sem marcação). */
  spoken: string;
  card?: { label: string; value: string; delta?: { text: string; good: boolean | null }; note?: string; /** Sentido da métrica ("menor é melhor"). */ hint?: string };
  chart?: { title: string; items: { label: string; value: number; display: string }[] };
  action?: AgentAction;
  target?: AgentTarget;
  suggestions?: string[];
  /** Pergunta entendida? (falso = resposta honesta de "não sei") */
  understood: boolean;
};

export interface VyzEngine {
  readonly label: string;
  ask(question: string, ctx: AgentContext): Promise<AgentAnswer>;
}
