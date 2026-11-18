// POST /api/links/visita: sinal da página aberta do link público (/r/<token>), para a aba
// Acessos do workspace. Vem de navigator.sendBeacon (sem sessão). Responde sempre 204, sem
// dizer se o link existe; corpo grande ou fora do formato, 400.

import type { NextRequest } from "next/server";
import { requestContext } from "@/server/http/request";
import { recordVisitPing } from "@/server/share/visits";

const MAX_BODY = 1024;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return new Response(null, { status: 400, headers: NO_STORE });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400, headers: NO_STORE });
  }
  const { ip, userAgent } = await requestContext();
  const result = await recordVisitPing(body, { ip, userAgent });
  if (result === "invalid") return new Response(null, { status: 400, headers: NO_STORE });
  if (result === "rate_limited") return new Response(null, { status: 429, headers: NO_STORE });
  return new Response(null, { status: 204, headers: NO_STORE });
}
