// POST /api/v1/push-tokens: registra o token nativo do aparelho (APNs no iOS,
// FCM no Android). DELETE: remove (ao sair). O envio é feito pelo nosso backend.

import { z } from "zod";
import { apiJson, bearerSession, unauthorized, apiError } from "@/server/auth/bearer";
import { createAdminSupabase } from "@/server/supabase/admin";

const Input = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().trim().min(32).max(4096),
  appVersion: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("validation", "Token inválido.", 400);
  // o mesmo aparelho pode trocar de conta: o token passa para quem está logado
  const { error } = await createAdminSupabase({ actorId: session.userId })
    .from("push_tokens")
    .upsert(
      { user_id: session.userId, platform: parsed.data.platform, token: parsed.data.token, app_version: parsed.data.appVersion ?? null, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) return apiError("unknown", "Não foi possível registrar as notificações.", 500);
  return apiJson({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const token = new URL(request.url).searchParams.get("token") ?? "";
  await session.db.from("push_tokens").delete().eq("token", token);
  return apiJson({ ok: true });
}
