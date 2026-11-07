import "server-only";

// Limite de tentativas por janela (tabela rate_limits, contagem atômica no
// banco: vale para todas as instâncias). A chave é um hash do IP ou do e-mail.
// Se o banco não responder, deixa passar (não tranca ninguém por falha de
// infraestrutura) e registra o erro.

import { fingerprint } from "@/server/http/request";
import { createAdminSupabase } from "@/server/supabase/admin";

export const RATE_RULES = {
  sign_in_ip: { windowSeconds: 15 * 60, max: 30 },
  sign_in_email: { windowSeconds: 15 * 60, max: 8 },
  signup_ip: { windowSeconds: 60 * 60, max: 10 },
  password_reset_ip: { windowSeconds: 60 * 60, max: 15 },
  password_reset_email: { windowSeconds: 60 * 60, max: 4 },
  checkout_ip: { windowSeconds: 60 * 60, max: 20 },
  oauth_start_user: { windowSeconds: 10 * 60, max: 20 },
  share_view_ip: { windowSeconds: 60, max: 120 },
  lp_submit_ip: { windowSeconds: 10 * 60, max: 20 },
  whatsapp_code_user: { windowSeconds: 60 * 60, max: 5 },
  whatsapp_code_phone: { windowSeconds: 60 * 60, max: 3 },
  whatsapp_test_user: { windowSeconds: 60 * 60, max: 3 },
} as const;

export type RateRule = keyof typeof RATE_RULES;

/** true = pode seguir; false = passou do limite. */
export async function hitRateLimit(rule: RateRule, subject: string | null | undefined): Promise<boolean> {
  if (!subject) return true;
  const { windowSeconds, max } = RATE_RULES[rule];
  try {
    const { data, error } = await createAdminSupabase().rpc("rate_limit_hit", {
      p_bucket: `${rule}:${fingerprint(subject)}`,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) throw error;
    return data === true;
  } catch (err) {
    console.error("[vyz] limite de tentativas indisponível", err);
    return true;
  }
}
