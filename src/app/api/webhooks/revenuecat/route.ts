// POST /api/webhooks/revenuecat: compras na loja (App Store / Google Play).
// Créditos: cada transação credita uma vez. Planos (vyz_<plano>_<período>_ate<projetos>):
// qualquer evento relê o estado no RevenueCat e grava a assinatura do workspace. O RevenueCat manda "Authorization: <REVENUECAT_WEBHOOK_SECRET>"
// (configurado no painel dele). O app_user_id é o id do usuário no Supabase
// (o app chama Purchases.logIn(userId) ao entrar). Idempotente: cada evento é
// gravado uma vez e cada transação da loja credita uma vez.

import { timingSafeEqual } from "node:crypto";
import { creditsFor, parseStorePlan } from "@vyz/shared";
import { z } from "zod";
import { syncStoreSubscription } from "@/server/billing/store";
import { serverEnv } from "@/server/env";
import { createAdminSupabase } from "@/server/supabase/admin";

const Event = z.object({
  event: z.object({
    id: z.string().min(1),
    type: z.string(),
    // O RevenueCat manda null em vários campos (o evento TEST, por exemplo):
    // null vira ausente.
    app_user_id: z.string().nullish().transform((v) => v ?? undefined),
    product_id: z.string().nullish().transform((v) => v ?? undefined),
    new_product_id: z.string().nullish(),
    transaction_id: z.string().nullish().transform((v) => v ?? undefined),
    store: z.string().nullish().transform((v) => v ?? undefined),
  }),
});

const STORE: Record<string, "app_store" | "play_store"> = { APP_STORE: "app_store", PLAY_STORE: "play_store" };

// O segredo pode estar salvo com ou sem "Bearer " (no painel do RevenueCat e
// na Vercel): compara só o valor.
const bare = (v: string) => v.trim().replace(/^bearer\s+/i, "");

function authorized(header: string | null, secret: string) {
  const a = Buffer.from(bare(header ?? ""));
  const b = Buffer.from(bare(secret));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = serverEnv().REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "revenuecat:not_configured" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), secret)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = Event.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const e = parsed.data.event;
  const admin = createAdminSupabase();

  const inserted = await admin.from("store_events").insert({ id: e.id, type: e.type, app_user_id: e.app_user_id ?? null, payload: raw }).select("id");
  if (inserted.error?.code === "23505") return Response.json({ ok: true, duplicate: true });
  if (inserted.error) return Response.json({ error: "store" }, { status: 500 });

  const userId = z.uuid().safeParse(e.app_user_id).success ? e.app_user_id! : null;

  // plano: o estado vem da API do RevenueCat (eventos fora de ordem dão no mesmo)
  if (userId && (parseStorePlan(e.product_id) || parseStorePlan(e.new_product_id))) {
    try {
      await syncStoreSubscription(userId);
      await admin.from("store_events").update({ processed_at: new Date().toISOString() }).eq("id", e.id);
      return Response.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // sem workspace ou com plano do site: não adianta repetir
      if (message.startsWith("store:")) {
        await admin.from("store_events").update({ error: message }).eq("id", e.id);
        return Response.json({ ok: false, error: message });
      }
      // o RevenueCat repete; apaga o registro para o reenvio ser processado
      await admin.from("store_events").delete().eq("id", e.id);
      return Response.json({ error: "store_sync" }, { status: 500 });
    }
  }

  const credits = e.product_id ? creditsFor(e.product_id) : null;
  // TEST (botão "Send test event" do RevenueCat) credita só se vier com um
  // produto de crédito, um usuário real e uma transação; o teste padrão só confirma o 200.
  const isPurchase = e.type === "NON_RENEWING_PURCHASE" || e.type === "INITIAL_PURCHASE" || e.type === "TEST";
  const isRefund = e.type === "CANCELLATION" && raw?.event?.cancel_reason === "CUSTOMER_SUPPORT";
  if (credits && userId && e.transaction_id && (isPurchase || isRefund)) {
    const { error } = await admin.rpc("credit_store_purchase", {
      p_event_id: e.id,
      p_user_id: userId,
      p_store: STORE[e.store ?? ""] ?? "app_store",
      p_product_id: e.product_id!,
      p_transaction_id: e.transaction_id,
      p_credits: isRefund ? -credits : credits,
      p_reason: isRefund ? "refund" : "purchase",
    });
    if (error) {
      await admin.from("store_events").update({ error: error.message }).eq("id", e.id);
      return Response.json({ error: "credit" }, { status: 500 });
    }
  } else {
    await admin.from("store_events").update({ processed_at: new Date().toISOString() }).eq("id", e.id);
  }
  return Response.json({ ok: true });
}
