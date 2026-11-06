// Volta do Checkout da Stripe: confere a sessão na própria Stripe (nada da
// URL é confiável além do id), conclui o pedido se pago e abre o workspace
// novo, como no pagamento simulado. O webhook faz o mesmo em paralelo
// (fulfill_checkout é idempotente). Sem confirmação ainda, volta para o
// pagamento com aviso.

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, WORKSPACE_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { getSessionUser } from "@/server/auth/session";
import { fulfillStripeSession } from "@/server/billing/stripe";
import { logActivity } from "@/server/history/log";
import { appOrigin } from "@/server/http/request";
import { createServerSupabase } from "@/server/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(request: NextRequest) {
  const origin = await appOrigin();
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  const pedido = request.nextUrl.searchParams.get("pedido") ?? "";
  const sessao = request.nextUrl.searchParams.get("sessao") ?? "";
  if (!UUID.test(pedido) || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessao)) return go("/assinar");

  const user = await getSessionUser();
  if (!user) return go(`/entrar?next=${encodeURIComponent(`/assinar/pagamento/${pedido}`)}`);

  let result;
  try {
    result = await fulfillStripeSession(sessao);
  } catch (err) {
    console.error("[vyz] volta da Stripe", err instanceof Error ? err.message : err);
    return go(`/assinar/pagamento/${pedido}?erro=confirmacao`);
  }
  // a sessão tem de ser deste pedido e deste usuário
  if (!result || result.checkoutId !== pedido || result.userId !== user.id) return go("/assinar");
  if (!result.paid) return go(`/assinar/pagamento/${pedido}?erro=pendente`);

  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, result.workspaceId, WORKSPACE_COOKIE_OPTIONS);
  const supabase = await createServerSupabase();
  const profile = await supabase.from("profiles").update({ default_workspace_id: result.workspaceId }).eq("id", user.id);
  if (profile.error) console.error("[vyz] workspace padrão", profile.error);
  await logActivity({
    workspaceId: result.workspaceId,
    actorId: user.id,
    event: "billing.checkout_completed",
    entityType: "checkout_session",
    entityId: pedido,
    metadata: { plan: result.planId, amount_cents: result.amountCents, method: "card", provider: "stripe" },
  });
  return go(`/assinar/concluido/${pedido}`);
}
