import "server-only";

// Autenticação da API para o app nativo (/api/v1): o app manda o access token
// do Supabase em "Authorization: Bearer <jwt>". O token é validado (getClaims,
// chave ES256) e o cliente criado com ele respeita o RLS do usuário, como o
// cliente de cookies do site.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { serverEnv } from "@/server/env";
import type { DB } from "@/server/supabase/server";

export type BearerSession = { userId: string; email: string | null; db: DB };

export async function bearerSession(request: Request): Promise<BearerSession | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header);
  if (!match) return null;
  const token = match[1];
  const env = serverEnv();
  const db = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { userId: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : null, db };
}

/** Respostas JSON da API v1 (sem cache: dado de cada usuário). */
export function apiJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Erro no formato da API v1: { error: { code, message } }. */
export const apiError = (code: string, message: string, status: number) => apiJson({ error: { code, message } }, status);

export const unauthorized = () => apiError("auth:required", "Entre na sua conta para continuar.", 401);
