import "server-only";

// Chamadas às APIs do Meta e do Google: JSON, tempo limite e erro sem vazar
// nada. URLs e corpos podem carregar token ou segredo do app: o erro guarda só
// o status e os campos de diagnóstico do provedor.
// Com Redis (server/cache/redis.ts): a Meta avisa o uso da cota nos cabeçalhos e o
// Google Ads conta operações por dia; perto do limite, a plataforma (ou a conta) entra
// em pausa compartilhada entre as funções. Sem Redis, nada disso acontece.

import type { ConnectErrorCode } from "@/features/integrations/results";
import { cached, countGoogleAdsOp, getRedis, googleAdsDailyCap, metaAccountFromUrl, metaUsagePause, pauseCalls, requestHash, secondsToUtcMidnight } from "@/server/cache/redis";
import { ProviderError } from "./types";

const TIMEOUT_MS = 15_000;

/** Cache curto das leituras da sincronização: uma nova tentativa logo depois de uma falha reaproveita o que já veio. */
export const SYNC_CACHE_SECONDS = 600;

type Init = RequestInit & {
  /** Rótulo para o log ("Meta: troca do código"). */
  label: string;
  /** Código quando o provedor recusa (4xx). Padrão: troca_falhou. */
  rejectCode?: ConnectErrorCode;
  /** Tempo limite desta chamada (padrão 15 s). Relatórios grandes pedem mais. */
  timeoutMs?: number;
  /** Cache curto da resposta no Redis (segundos). Só para leituras que podem ficar alguns minutos velhas. */
  cacheSeconds?: number;
};

const host = (url: string | URL) => {
  try {
    return new URL(String(url)).host;
  } catch {
    return "";
  }
};

/** Uso de cota informado pela resposta: pausa a Meta (ou a conta) e conta as operações do Google Ads. */
async function recordUsage(url: string | URL, res: Response): Promise<void> {
  if (!getRedis()) return;
  const h = host(url);
  if (h === "graph.facebook.com") {
    const usage = metaUsagePause(res.headers);
    if (usage.pausePlatformSeconds > 0) await pauseCalls("meta", usage.pausePlatformSeconds);
    const account = metaAccountFromUrl(url);
    if (usage.pauseAccountSeconds > 0 && account) await pauseCalls("meta", usage.pauseAccountSeconds, account);
    if (res.status === 429) await pauseCalls("meta", 300);
  } else if (h === "googleads.googleapis.com") {
    const ops = await countGoogleAdsOp();
    if (ops !== null && ops >= googleAdsDailyCap()) await pauseCalls("google", secondsToUtcMidnight());
    if (res.status === 429) await pauseCalls("google", 600);
  }
}

/** Campos de diagnóstico seguros (tipo, código, fbtrace_id, status do Google). */
function diagnostic(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const err = (body as Record<string, unknown>).error;
  if (typeof err === "string") return err.slice(0, 80);
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const fields = ["type", "code", "error_subcode", "status", "fbtrace_id"]
      .map((k) => (e[k] === undefined ? null : `${k}=${String(e[k]).slice(0, 40)}`))
      .filter(Boolean)
      .join(" ");
    return [fields, googleAdsFailure(e.details)].filter(Boolean).join(" · ");
  }
  return "";
}

/**
 * Motivo do Google Ads (GoogleAdsFailure): o código e a mensagem do primeiro erro, que dizem
 * qual campo ou recurso foi recusado ("Unrecognized field in the query: 'metrics.video_views'").
 * Não carrega token nem dado da conta.
 */
function googleAdsFailure(details: unknown): string {
  if (!Array.isArray(details)) return "";
  for (const d of details) {
    const first = (d as { errors?: { errorCode?: Record<string, unknown>; message?: unknown }[] })?.errors?.[0];
    if (!first) continue;
    const code = first.errorCode ? Object.entries(first.errorCode).map(([k, v]) => `${k}=${String(v)}`).join(",") : "";
    const message = typeof first.message === "string" ? first.message.replace(/[\r\n]+/g, " ").slice(0, 160) : "";
    return [code, message].filter(Boolean).join(" ");
  }
  return "";
}

/** Faz a chamada e devolve o corpo (JSON ou null), ou lança ProviderError. */
async function call(url: string | URL, { label, rejectCode = "troca_falhou", timeoutMs = TIMEOUT_MS, ...init }: Omit<Init, "cacheSeconds">): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    // redirect "error": um token nunca segue um redirecionamento para outro host.
    res = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ProviderError("provedor_indisponivel", `${label}: sem resposta`);
  }
  const body: unknown = await res.json().catch(() => null);
  await recordUsage(url, res);
  if (!res.ok) {
    const code = res.status >= 500 || res.status === 429 ? "provedor_indisponivel" : rejectCode;
    throw new ProviderError(code, `${label}: HTTP ${res.status} ${diagnostic(body)}`.trim(), res.status);
  }
  return { status: res.status, body };
}

export async function fetchJson<T>(url: string | URL, { cacheSeconds, ...init }: Init): Promise<T> {
  const load = async () => {
    const { status, body } = await call(url, init);
    if (body === null) throw new ProviderError("provedor_indisponivel", `${init.label}: resposta sem JSON`, status);
    return body as T;
  };
  if (!cacheSeconds) return load();
  // a chave é o hash da chamada inteira (URL com o token, corpo e autorização): duas pessoas nunca dividem resposta
  const auth = new Headers(init.headers).get("authorization");
  return cached(requestHash([init.method ?? "GET", String(url), typeof init.body === "string" ? init.body : null, auth]), cacheSeconds, load);
}

/** Para chamadas sem corpo útil na resposta (revogação). */
export async function fetchOk(url: string | URL, init: Init): Promise<void> {
  await call(url, init);
}

/** Corpo application/x-www-form-urlencoded. */
export const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields).toString(),
});
