import "server-only";

// Contexto da requisição: IP e navegador (para auditoria, histórico de acesso
// e limite de tentativas) e validação de destinos de redirecionamento.

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { isSamePageRequest } from "@/lib/navigation";
import { serverEnv } from "@/server/env";

export type RequestContext = {
  ip: string | null;
  userAgent: string | null;
  /** Cabeçalhos que o banco lê para a auditoria (private.request_header). */
  forwardHeaders: Record<string, string>;
};

const ascii = (v: string) => v.replace(/[^\x20-\x7E]/g, "");

async function requestHeaders(): Promise<Headers | null> {
  try {
    return await headers();
  } catch {
    // fora de uma requisição (scripts, tarefas agendadas)
    return null;
  }
}

/**
 * O pedido veio de dentro da página (clique que troca a URL), não de abrir o endereço.
 * O navegador é quem manda este cabeçalho; sem ele, conta como abertura.
 */
export async function isInPageNavigation(): Promise<boolean> {
  return (await requestHeaders())?.get("sec-fetch-dest") === "empty";
}

/** O pedido partiu desta mesma página: filtrar ou trocar o período, sem abri-la de novo. */
export async function isSamePageNavigation(pathname: string): Promise<boolean> {
  const h = await requestHeaders();
  return isSamePageRequest({ fetchDest: h?.get("sec-fetch-dest") ?? null, referer: h?.get("referer") ?? null }, pathname);
}

export async function requestContext(): Promise<RequestContext> {
  const h = await requestHeaders();
  if (!h) return { ip: null, userAgent: null, forwardHeaders: {} };
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  const forwardHeaders: Record<string, string> = {};
  if (ip) forwardHeaders["x-vyz-ip"] = ascii(ip);
  if (userAgent) forwardHeaders["x-vyz-user-agent"] = ascii(userAgent);
  return { ip, userAgent, forwardHeaders };
}

/**
 * Origem pública do app para URLs absolutas (retorno do OAuth, links de
 * e-mail). Usa o host da requisição só quando ele é o do NEXT_PUBLIC_SITE_URL
 * ou localhost (dev em outra porta); senão, o NEXT_PUBLIC_SITE_URL.
 */
export async function appOrigin(): Promise<string> {
  const site = new URL(serverEnv().NEXT_PUBLIC_SITE_URL);
  const h = await requestHeaders();
  const host = h?.get("x-forwarded-host") ?? h?.get("host");
  if (host) {
    const hostname = host.split(":")[0];
    const local = (hostname === "localhost" || hostname === "127.0.0.1") && serverEnv().NODE_ENV !== "production";
    if (local) return `http://${host}`;
    if (hostname === site.hostname) return `${site.protocol}//${host}`;
  }
  return site.origin;
}

/** Hash curto e estável (sha256) para chaves de limite sem guardar IP ou e-mail. */
export function fingerprint(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/**
 * Destino interno seguro para ?next=. Só caminhos relativos do próprio site
 * ("/painel/..."); bloqueia "//host", "/\host", esquemas e controles.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/painel"): string {
  if (!raw || raw.length > 512) return fallback;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\x00-\x1F\\]/.test(value) || /^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;
  return value;
}
