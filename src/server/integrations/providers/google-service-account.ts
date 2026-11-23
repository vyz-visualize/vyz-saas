import "server-only";

// Conta de serviço do Google (GA4 por token): o cliente cria a conta de serviço no projeto
// dele, dá acesso de Leitor no GA4 e cola a chave JSON. O VYZ guarda a chave no Vault (no
// lugar do refresh token, com o prefixo "sa:") e troca por um token de 1 hora quando precisa
// (JWT assinado com a chave, RFC 7523). A chave nunca sai do servidor nem vai para log.

import { createSign } from "node:crypto";
import { fetchJson, form } from "./http";
import { ProviderError, type OAuthTokens } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PREFIX = "sa:";

export type ServiceAccountKey = { client_email: string; private_key: string; project_id?: string };

/** Lê a chave JSON colada; null quando não é uma chave de conta de serviço do Google. */
export function parseServiceAccountKey(raw: string): ServiceAccountKey | null {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== "service_account" || typeof d.client_email !== "string" || typeof d.private_key !== "string") return null;
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(d.client_email) || !d.private_key.includes("PRIVATE KEY")) return null;
  return { client_email: d.client_email, private_key: d.private_key, ...(typeof d.project_id === "string" ? { project_id: d.project_id } : {}) };
}

/** A chave guardada no lugar do refresh token. */
export const packServiceAccount = (key: ServiceAccountKey) => `${PREFIX}${JSON.stringify(key)}`;
export const isPackedServiceAccount = (refresh: string | null | undefined) => !!refresh?.startsWith(PREFIX);

function unpack(packed: string): ServiceAccountKey {
  const key = parseServiceAccountKey(JSON.stringify({ type: "service_account", ...JSON.parse(packed.slice(PREFIX.length)) }));
  if (!key) throw new ProviderError("troca_falhou", "Google: chave da conta de serviço inválida");
  return key;
}

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

/** Token de acesso de 1 hora da conta de serviço, com o escopo pedido. Devolve a chave de novo no refresh (para não se perder). */
export async function serviceAccountTokens(packed: string, scope: string): Promise<OAuthTokens> {
  const key = unpack(packed);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  } catch {
    throw new ProviderError("troca_falhou", "Google: não foi possível assinar com a chave da conta de serviço");
  }
  const res = await fetchJson<{ access_token: string; expires_in?: number }>(TOKEN_URL, {
    ...form({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    label: "Google: token da conta de serviço",
  });
  if (!res.access_token) throw new ProviderError("troca_falhou", "Google: token ausente na resposta da conta de serviço");
  return {
    accessToken: res.access_token,
    refreshToken: packed,
    expiresAt: new Date(Date.now() + (res.expires_in ?? 3600) * 1000).toISOString(),
    scopes: [scope],
  };
}
