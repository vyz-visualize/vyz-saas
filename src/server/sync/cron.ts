import "server-only";

// Quem pode chamar a rota do agendador: só quem manda o CRON_SECRET no
// cabeçalho Authorization (o Vercel Cron faz isso sozinho:
// "Authorization: Bearer <CRON_SECRET>"). Sem segredo configurado, a rota
// fica fechada.

import { createHash, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/server/env";

/** O segredo, se estiver configurado (serverEnv exige 16 caracteres ou mais). */
export const cronSecret = (): string | null => serverEnv().CRON_SECRET ?? null;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compara em tempo constante (o hash iguala os tamanhos). */
export function isAuthorizedCron(authorization: string | null, secret: string): boolean {
  const match = /^Bearer\s+(\S+)$/.exec(authorization?.trim() ?? "");
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret));
}

/** Cabeçalhos das respostas das rotas do agendador: nada fica em cache. */
export const CRON_HEADERS = { "Cache-Control": "no-store" };

/** Barra quem não é o agendador: 503 sem CRON_SECRET, 401 com o segredo errado. null = pode seguir. */
export function rejectCron(request: Request): Response | null {
  // ler o cabeçalho primeiro também deixa a rota fora da pré-renderização
  const authorization = request.headers.get("authorization");
  const secret = cronSecret();
  if (!secret) return Response.json({ ok: false, error: "cron:not_configured", message: "Defina CRON_SECRET para liberar as rotinas agendadas." }, { status: 503, headers: CRON_HEADERS });
  if (!isAuthorizedCron(authorization, secret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CRON_HEADERS });
  return null;
}
