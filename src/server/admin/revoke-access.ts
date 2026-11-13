// Revogação do acesso do app na origem (Meta e Google), para a exclusão total. Os endpoints são
// os mesmos de src/server/integrations/providers, que só rodam dentro do Next (server-only); o
// teste confere que a versão da Graph API é a mesma de lá.
//
// Melhor esforço: o que não for revogado volta na lista, com o motivo, para remover à mão. O
// motivo nunca leva o token: só o status HTTP e os códigos de diagnóstico do provedor.

import { createHmac } from "node:crypto";

export const META_GRAPH_VERSION = "v26.0";
export const META_PERMISSIONS_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions`;
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Uma conexão real (não simulada) num workspace que sai junto com a pessoa. */
export type AccessToRevoke = { connectionId: string; workspaceId: string; workspaceName: string; provider: string; account: string };
export type StoredTokens = { accessToken: string | null; refreshToken: string | null };
export type RevokeOutcome = AccessToRevoke & { revoked: boolean; reason?: string };
export type RevokeOptions = { fetch?: typeof fetch; metaAppSecret?: string; timeoutMs?: number };

const PROVIDER_LABEL: Record<string, string> = { meta: "Meta", google: "Google" };
export const providerLabel = (provider: string) => PROVIDER_LABEL[provider] ?? provider;

/** Campos de diagnóstico seguros: tipo, código, subcódigo (Meta) ou o código de erro (Google). */
function diagnostic(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const err = (body as Record<string, unknown>).error;
  if (typeof err === "string") return err.replace(/[^\w.-]/g, "").slice(0, 60);
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return ["type", "code", "error_subcode"]
      .filter((k) => e[k] !== undefined)
      .map((k) => `${k}=${String(e[k]).replace(/[^\w.-]/g, "").slice(0, 40)}`)
      .join(" ");
  }
  return "";
}

async function call(url: string, init: RequestInit, opts: RevokeOptions): Promise<{ ok: boolean; status: number; body: unknown }> {
  const doFetch = opts.fetch ?? fetch;
  // redirect "error": o token nunca segue um redirecionamento para outro endereço
  const res = await doFetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000) });
  const body: unknown = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

/** Tenta revogar uma conexão. Nunca lança: devolve se revogou e, se não, por quê. */
export async function revokeAccess(item: AccessToRevoke, tokens: StoredTokens | null, opts: RevokeOptions = {}): Promise<RevokeOutcome> {
  const fail = (reason: string): RevokeOutcome => ({ ...item, revoked: false, reason });
  if (!tokens?.accessToken && !tokens?.refreshToken) return fail("sem token guardado");
  try {
    if (item.provider === "meta") {
      if (!tokens.accessToken) return fail("sem token de acesso guardado");
      // tira todas as permissões do app para este login (como em providers/meta.ts)
      const params = new URLSearchParams({ access_token: tokens.accessToken });
      if (opts.metaAppSecret) params.set("appsecret_proof", createHmac("sha256", opts.metaAppSecret).update(tokens.accessToken).digest("hex"));
      const res = await call(`${META_PERMISSIONS_URL}?${params}`, { method: "DELETE" }, opts);
      const success = res.ok && (res.body as { success?: unknown } | null)?.success === true;
      return success ? { ...item, revoked: true } : fail(`HTTP ${res.status} ${diagnostic(res.body)}`.trim());
    }
    if (item.provider === "google") {
      // revogar o refresh token derruba também os access tokens dele (como em providers/google.ts)
      const token = (tokens.refreshToken ?? tokens.accessToken)!;
      const res = await call(GOOGLE_REVOKE_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }).toString() }, opts);
      return res.ok ? { ...item, revoked: true } : fail(`HTTP ${res.status} ${diagnostic(res.body)}`.trim());
    }
    return fail("provedor sem revogação automática");
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return fail(timeout ? "sem resposta do provedor (tempo esgotado)" : "sem resposta do provedor (rede)");
  }
}

/** Uma por vez, na ordem do plano. */
export async function revokeAll(pending: { item: AccessToRevoke; tokens: StoredTokens | null }[], opts: RevokeOptions = {}): Promise<RevokeOutcome[]> {
  const out: RevokeOutcome[] = [];
  for (const p of pending) out.push(await revokeAccess(p.item, p.tokens, opts));
  return out;
}

/** O resultado, para a tela: o que foi revogado e, à parte, o que falta remover à mão. */
export function renderRevocations(outcomes: RevokeOutcome[]): string {
  if (!outcomes.length) return "Revogação na origem: nenhuma conexão real nas organizações apagadas.";
  const done = outcomes.filter((o) => o.revoked);
  const left = outcomes.filter((o) => !o.revoked);
  const line = (o: RevokeOutcome) => `  ${providerLabel(o.provider)} · ${o.account} (workspace "${o.workspaceName}")${o.reason ? `: ${o.reason}` : ""}`;
  const out = [`Revogação na origem: ${done.length} de ${outcomes.length} revogada(s).`];
  for (const o of done) out.push(line(o));
  if (left.length) {
    out.push("", "ATENÇÃO: NÃO REVOGADO. Remova à mão (veja docs/EXCLUSAO-DE-DADOS.md, passo 4):");
    for (const o of left) out.push(line(o));
  }
  return out.join("\n");
}
