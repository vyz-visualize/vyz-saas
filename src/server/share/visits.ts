import "server-only";

// Visitas ao link público (/r/<token>) para a aba Acessos do workspace. A página aberta manda
// um sinal ao abrir, ao trocar de tela, a cada 30 s com a aba visível e ao sair
// (src/features/share/VisitTracker.tsx). Aqui: limite por IP, robôs fora, token conferido
// pelo hash e a gravação no banco (record_share_visit confere de novo se o link vale).
// Do visitante fica só o tipo de aparelho: nada de IP nem navegador nesta tabela.

import { z } from "zod";
import { deviceFromUserAgent, isBotUserAgent } from "@/features/projects/client-activity";
import { SHARE_TOKEN_RE } from "@/features/share/links";
import { hitRateLimit } from "@/server/security/rate-limit";
import { createAdminSupabase } from "@/server/supabase/admin";
import { hashShareToken } from "./token";

export const VisitPing = z.object({
  token: z.string().regex(SHARE_TOKEN_RE),
  visit: z.uuid(),
  page: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullish(),
  seconds: z.number().int().min(0).max(120),
});
export type VisitPingInput = z.infer<typeof VisitPing>;

export type PingResult = "ok" | "ignored" | "invalid" | "rate_limited";

export async function recordVisitPing(input: unknown, ctx: { ip: string | null; userAgent: string | null }): Promise<PingResult> {
  const parsed = VisitPing.safeParse(input);
  if (!parsed.success) return "invalid";
  if (isBotUserAgent(ctx.userAgent)) return "ignored";
  if (!(await hitRateLimit("share_ping_ip", ctx.ip))) return "rate_limited";

  const p = parsed.data;
  const admin = createAdminSupabase();
  const { data: link, error } = await admin.from("share_links").select("id").eq("token_hash", hashShareToken(p.token)).maybeSingle();
  if (error) {
    console.error("[vyz] visita do link", error.message);
    return "ignored";
  }
  if (!link) return "ignored";
  const { error: e } = await admin.rpc("record_share_visit", {
    p_link_id: link.id,
    p_visit_id: p.visit,
    p_page: p.page ?? "",
    p_seconds: p.seconds,
    p_device: deviceFromUserAgent(ctx.userAgent) ?? "",
  });
  if (e) console.error("[vyz] visita do link", e.message);
  return "ok";
}
