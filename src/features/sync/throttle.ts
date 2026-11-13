// Limites de taxa e fila da sincronização. Puro: o agendador e a atualização ao abrir usam.
//
// Meta: códigos 4 (app), 17 (usuário), 32 (página), 613 (chamadas demais) e 80000–80014
// (limite por conta do caso de uso de negócio); o HTTP costuma ser 400. Google (Ads e GA4):
// HTTP 429 ou RESOURCE_EXHAUSTED. A mensagem do ProviderError já traz esses campos
// ("HTTP 400 type=OAuthException code=17 ...") e nunca o token.

const META_LIMIT = /(?:^|[\s·])code=(4|17|32|613|800\d\d)\b/;
const GOOGLE_LIMIT = /RESOURCE_EXHAUSTED|RESOURCE_TEMPORARILY_EXHAUSTED|RATE_EXCEEDED/;

/** A plataforma pediu uma pausa (limite de taxa), não é falha da conta. */
export function isRateLimited(err: unknown): boolean {
  const e = (err ?? {}) as { status?: unknown; message?: unknown };
  if (e.status === 429) return true;
  const message = typeof e.message === "string" ? e.message : "";
  if (/\bHTTP 429\b/.test(message)) return true;
  const meta = META_LIMIT.exec(message);
  // 800xx: só 80000 a 80014 são de limite
  if (meta && Number(meta[1]) <= 80014) return true;
  return GOOGLE_LIMIT.test(message);
}

/**
 * Roda `work` em até `concurrency` itens ao mesmo tempo, na ordem da fila. Antes de começar
 * cada item, `canStart` decide se ele entra (tempo da rodada, plataforma em pausa); o que
 * não entra fica de fora do resultado e volta na próxima rodada.
 */
export async function runPool<T, R>(items: readonly T[], concurrency: number, work: (item: T) => Promise<R>, canStart: (item: T) => boolean = () => true): Promise<{ item: T; result: R }[]> {
  const out: { item: T; result: R }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      if (!canStart(item)) continue;
      out.push({ item, result: await work(item) });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return out;
}

export type RunOutcome = { adAccountId: string; ok: boolean; rowsWritten: number; code?: string };

/** O resumo de uma rodada: sincronizadas, com erro, já rodando, em pausa por limite e as que ficaram. */
export function summarizeRuns<R extends RunOutcome>(due: number, results: R[], durationMs: number) {
  const skipped = results.filter((r) => r.code === "sync:running").length;
  const rateLimited = results.filter((r) => r.code === "sync:rate_limited").length;
  const failed = results.filter((r) => !r.ok).length - skipped - rateLimited;
  return { ok: failed === 0, due, synced: results.length - failed - skipped - rateLimited, failed, skipped, rateLimited, pending: due - results.length, durationMs, results };
}
