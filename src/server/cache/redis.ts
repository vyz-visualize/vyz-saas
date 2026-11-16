import "server-only";

// Redis (Upstash, por HTTP: sem limite de conexões na Vercel) para o que é curto e compartilhado
// entre as funções: pausa por limite de chamadas da Meta e do Google, contador de operações do
// Google Ads e cache curto de respostas das APIs. Nada de histórico aqui; a trava de "uma
// sincronização por conta" continua no Postgres (índice único de sync_runs).
//
// Sem as variáveis (KV_REST_API_URL e KV_REST_API_TOKEN, criadas pela integração da Vercel;
// ou UPSTASH_REDIS_REST_URL/TOKEN), tudo funciona como antes, sem Redis. E se o Redis cair
// ou demorar, também: cada operação tem tempo limite curto e devolve o valor padrão.

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/** Tempo máximo de uma operação no Redis: passou disso, segue sem ele. */
const OP_TIMEOUT_MS = 400;
/** Respostas maiores que isso não vão para o cache (o plano gratuito é pequeno). */
const MAX_CACHED_BYTES = 100_000;
const PREFIX = "vyz:";

let client: Redis | null | undefined;

/** O cliente, ou null sem as variáveis. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const env = process.env;
  const configured = (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) || (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  try {
    client = configured ? Redis.fromEnv({ automaticDeserialization: true, enableTelemetry: false }) : null;
  } catch (err) {
    console.error("[vyz] redis: configuração inválida; seguindo sem", err instanceof Error ? err.message.slice(0, 120) : err);
    client = null;
  }
  return client;
}

/** Para os testes: troca o cliente (null = sem Redis; undefined = relê o ambiente). */
export function setRedisForTests(next: Redis | null | undefined) {
  client = next;
}

/** Roda a operação com tempo limite; erro ou demora devolve `fallback` (o Redis nunca derruba nada). */
export async function safe<T>(op: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  const r = getRedis();
  if (!r) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([op(r), new Promise<T>((resolve) => (timer = setTimeout(() => resolve(fallback), OP_TIMEOUT_MS)))]);
  } catch (err) {
    console.warn("[vyz] redis: operação falhou; seguindo sem", err instanceof Error ? err.message.slice(0, 120) : err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export const key = (...parts: (string | number)[]) => PREFIX + parts.join(":");

/** Hash de uma chamada (URL, corpo e cabeçalhos de autorização). O token nunca vai para a chave em claro. */
export function requestHash(parts: (string | undefined | null)[]): string {
  return createHash("sha256").update(parts.map((p) => p ?? "").join("\u0000")).digest("hex").slice(0, 40);
}

// ---- cache curto -----------------------------------------------------------------------------

/**
 * Lê do cache ou chama `load` e guarda por `ttlSeconds`. A chave vem de `requestHash` (inclui o
 * token, então duas pessoas nunca dividem a mesma resposta). Sem Redis, só chama `load`.
 */
export async function cached<T>(cacheKey: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (!getRedis()) return load();
  const k = key("cache", cacheKey);
  const hit = await safe((r) => r.get<T>(k), null);
  if (hit !== null && hit !== undefined) return hit;
  const value = await load();
  const size = JSON.stringify(value)?.length ?? 0;
  if (size > 0 && size <= MAX_CACHED_BYTES) await safe((r) => r.set(k, value, { ex: ttlSeconds }), null);
  return value;
}

// ---- pausa por limite de chamadas ---------------------------------------------------------------

export type LimitedPlatform = "meta" | "google";

/** Pausa a plataforma inteira (todas as contas) ou uma conta por `seconds`. */
export async function pauseCalls(platform: LimitedPlatform, seconds: number, account?: string): Promise<void> {
  const ttl = Math.max(30, Math.min(Math.round(seconds), 24 * 3600));
  await safe((r) => r.set(key("rl", platform, account ?? "*"), Date.now() + ttl * 1000, { ex: ttl }), null);
}

/** Plataformas em pausa agora (compartilhado entre as funções). Sem Redis: nenhuma. */
export async function pausedPlatforms(): Promise<Set<LimitedPlatform>> {
  const platforms: LimitedPlatform[] = ["meta", "google"];
  const values = await safe((r) => r.mget<(number | null)[]>(...platforms.map((p) => key("rl", p, "*"))), [] as (number | null)[]);
  return new Set(platforms.filter((_, i) => values[i] != null));
}

/** Contas (ids externos, ex.: act_123) em pausa por limite da própria conta. */
export async function pausedAccounts(platform: LimitedPlatform, accounts: string[]): Promise<Set<string>> {
  if (!accounts.length) return new Set();
  const values = await safe((r) => r.mget<(number | null)[]>(...accounts.map((a) => key("rl", platform, a))), [] as (number | null)[]);
  return new Set(accounts.filter((_, i) => values[i] != null));
}

// ---- uso informado pela Meta nos cabeçalhos -------------------------------------------------------

/** Acima disto (% da cota), a Meta pede para segurar: pausamos antes de tomar o erro. */
export const META_PAUSE_PCT = 75;

type MetaUsage = { pausePlatformSeconds: number; pauseAccountSeconds: number };

/**
 * Lê os cabeçalhos de uso da Meta (x-fb-ads-insights-throttle, x-business-use-case-usage e
 * x-app-usage) e diz quanto pausar. Puro (testável). 0 = não pausa.
 */
export function metaUsagePause(headers: { get(name: string): string | null }): MetaUsage {
  let platform = 0;
  let account = 0;
  const parse = (name: string): unknown => {
    const raw = headers.get(name);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const insights = parse("x-fb-ads-insights-throttle") as { app_id_util_pct?: number; acc_id_util_pct?: number } | null;
  if (insights) {
    if ((insights.app_id_util_pct ?? 0) >= META_PAUSE_PCT) platform = Math.max(platform, 300);
    if ((insights.acc_id_util_pct ?? 0) >= META_PAUSE_PCT) account = Math.max(account, 300);
  }
  const app = parse("x-app-usage") as { call_count?: number; total_cputime?: number; total_time?: number } | null;
  if (app && Math.max(app.call_count ?? 0, app.total_cputime ?? 0, app.total_time ?? 0) >= META_PAUSE_PCT) platform = Math.max(platform, 300);
  // por conta de negócio: a Meta diz em quantos minutos a cota volta
  const buc = parse("x-business-use-case-usage") as Record<string, { call_count?: number; total_cputime?: number; total_time?: number; estimated_time_to_regain_access?: number }[]> | null;
  for (const list of Object.values(buc ?? {})) {
    for (const u of Array.isArray(list) ? list : []) {
      const regain = (u.estimated_time_to_regain_access ?? 0) * 60;
      const pct = Math.max(u.call_count ?? 0, u.total_cputime ?? 0, u.total_time ?? 0);
      if (regain > 0) account = Math.max(account, regain);
      else if (pct >= META_PAUSE_PCT) account = Math.max(account, 300);
    }
  }
  return { pausePlatformSeconds: platform, pauseAccountSeconds: account };
}

/** A conta da Meta na URL (act_123), se houver. */
export function metaAccountFromUrl(url: string | URL): string | null {
  const m = /\/(act_\d+)(?:\/|$|\?)/.exec(String(url));
  return m ? m[1] : null;
}

// ---- operações do Google Ads no dia --------------------------------------------------------------

/** Soma uma operação do Google Ads no dia (UTC, como a cota do Google) e devolve o total. Sem Redis: null. */
export async function countGoogleAdsOp(): Promise<number | null> {
  const day = new Date().toISOString().slice(0, 10);
  const k = key("gads", "ops", day);
  return safe(async (r) => {
    const n = await r.incr(k);
    if (n === 1) await r.expire(k, 26 * 3600);
    return n;
  }, null);
}

/** Teto diário de operações do Google Ads (GOOGLE_ADS_DAILY_OPS; padrão 2.000, abaixo dos 2.880 do Explorer). */
export const googleAdsDailyCap = () => Number(process.env.GOOGLE_ADS_DAILY_OPS) || 2000;

/** Segundos até a meia-noite UTC (quando a cota diária do Google volta). */
export function secondsToUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

// ---- para os agendadores -------------------------------------------------------------------

/** A plataforma de cota de uma conta: Instagram e Página do Facebook usam a cota da Meta. */
export function limitedPlatformOf(platformId: string): LimitedPlatform | null {
  if (platformId === "meta" || platformId === "instagram" || platformId === "facebook") return "meta";
  if (platformId === "google") return "google";
  return null;
}

/** Quanto pausar quando uma conta toma limite: Meta 5 min, Google 10 min. */
export const RATE_LIMIT_PAUSE_SECONDS: Record<LimitedPlatform, number> = { meta: 300, google: 600 };

const metaAct = (externalId: string) => (externalId.startsWith("act_") ? externalId : `act_${externalId}`);

/**
 * Lê uma vez as pausas compartilhadas (plataforma inteira e contas da Meta) e devolve quem
 * está em pausa. Sem Redis: ninguém (fica só a pausa da rodada, como antes).
 */
export async function sharedPauses(accounts: { platform_id: string; external_id?: string | null }[]): Promise<(a: { platform_id: string; external_id?: string | null }) => boolean> {
  if (!getRedis() || !accounts.length) return () => false;
  const metaIds = [...new Set(accounts.filter((a) => a.platform_id === "meta" && a.external_id).map((a) => metaAct(a.external_id!)))];
  const [platforms, metaAccounts] = await Promise.all([pausedPlatforms(), pausedAccounts("meta", metaIds)]);
  return (a) => {
    const p = limitedPlatformOf(a.platform_id);
    if (p && platforms.has(p)) return true;
    return a.platform_id === "meta" && !!a.external_id && metaAccounts.has(metaAct(a.external_id));
  };
}

/** A conta tomou limite: a plataforma inteira entra em pausa para as outras funções também. */
export async function pauseAfterRateLimit(platformId: string): Promise<void> {
  const p = limitedPlatformOf(platformId);
  if (p) await pauseCalls(p, RATE_LIMIT_PAUSE_SECONDS[p]);
}
