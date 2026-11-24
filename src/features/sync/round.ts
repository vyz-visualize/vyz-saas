// Regras da rodada de sincronização agendada (puras, para testar). Quem usa: server/sync/scheduled.ts,
// server/sync/run.ts e a rota /api/cron/sync.
//
// A rodada da Vercel morre aos 300 s: uma conta que começa no fim era cortada no meio e a
// sincronização ficava "aberta" até a mesma conta tentar de novo. Agora a rodada só começa uma
// conta se couber o tempo que ela costuma levar, e o que não couber vai primeiro na próxima.

import { ANALYTICS_PLATFORMS } from "./analytics";
import { CRM_PLATFORMS } from "./crm";
import { SYNC_PLATFORMS } from "./dataset";
import { ORGANIC_PLATFORMS } from "./organic";

/** Grupos com cron próprio: anúncios e analytics (Meta, Google, GA4, CRMs) e orgânico (Instagram e Página). */
export type SyncGroup = "anuncios" | "organico";
export const SYNC_GROUPS: Record<SyncGroup, readonly string[]> = {
  anuncios: [...SYNC_PLATFORMS, ...ANALYTICS_PLATFORMS, ...CRM_PLATFORMS],
  organico: [...ORGANIC_PLATFORMS],
};

/** ?grupo= da rota; sem ou desconhecido: todas as plataformas (como antes). */
export const parseSyncGroup = (raw: string | null | undefined): SyncGroup | null => (raw === "anuncios" || raw === "organico" ? raw : null);

/**
 * Quanto tempo a conta costuma levar (pior caso comum, medido em produção em nov/2026: o orgânico de
 * uma conta grande passava de 150 s antes de ler os posts em paralelo; a Meta Ads, até 110 s).
 */
export const PLATFORM_ESTIMATE_MS: Record<string, number> = { instagram: 70_000, facebook: 70_000, meta: 60_000, tiktok: 30_000, linkedin: 30_000 };
export const DEFAULT_ESTIMATE_MS = 15_000;
export const estimateMs = (platform: string) => PLATFORM_ESTIMATE_MS[platform] ?? DEFAULT_ESTIMATE_MS;

/** Começa a conta agora? Só se o tempo que ela costuma levar couber no que falta da rodada. */
export const fitsInRound = (platform: string, elapsedMs: number, budgetMs: number) => budgetMs - elapsedMs >= estimateMs(platform);

/** Sincronização aberta há mais que isto é de uma rodada que morreu: fecha como "Tempo esgotado". */
export const STALE_RUN_MS = 15 * 60 * 1000;

/** Conta sem sincronizar com sucesso há mais que isto entra no aviso da rodada. */
export const STALE_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/** Hora no fuso de Brasília (0–23). */
export const hourInSaoPaulo = (now: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(now));

/**
 * Orgânico: relê os números de todos os posts dos últimos 30 dias, ou só os dos últimos 7?
 * Todos: em sincronização pedida por alguém (inicial ou manual) e na primeira rodada agendada do dia
 * (madrugada em Brasília). Nas outras rodadas, só os recentes: os números de post antigo quase não
 * mudam e os já gravados ficam (o orgânico grava os posts por upsert, sem apagar).
 */
export const rereadAllPosts = (trigger: "initial" | "scheduled" | "manual", now: Date) => trigger !== "scheduled" || hourInSaoPaulo(now) < 8;

/**
 * Quebras da Meta (posicionamento, estado, dispositivo, hora, idade e gênero) uma vez por dia: na
 * primeira rodada de anúncios (09 UTC; até as 12 UTC, para uma rodada que atrasou) e sempre na
 * primeira sincronização de uma conta. Nas outras, ficam as do banco: 6 chamadas a menos por conta.
 */
export const fetchBreakdownsNow = (trigger: "initial" | "scheduled" | "manual", now: Date) => trigger === "initial" || (trigger === "scheduled" && now.getUTCHours() < 12);

/** Janela de posts relidos em toda rodada. */
export const RECENT_POST_DAYS = 7;

/**
 * Mensagem da falha para a tela (sync_runs.error). Falta de permissão na plataforma (HTTP 403,
 * PERMISSION_DENIED) diz o que fazer, com o código; o resto, a mensagem genérica.
 */
export function failureMessage(technical: string | null, generic: string): string {
  if (technical && /HTTP 403|PERMISSION_DENIED/i.test(technical)) {
    return "Sem permissão (HTTP 403): o login conectado não tem mais acesso a esta conta. Peça o acesso de novo a quem administra a conta ou reconecte com um login que tenha.";
  }
  return generic;
}
