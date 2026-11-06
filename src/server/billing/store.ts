import "server-only";

// Assinatura comprada na loja (App Store / Google Play) pelo app. O webhook
// do RevenueCat só avisa que algo mudou; o estado vem sempre da API dele
// (GET /v1/subscribers/:id), então eventos fora de ordem ou repetidos dão no
// mesmo resultado. A regra do plano é a do site: o produto diz plano,
// período e limite de projetos (packages/shared/src/store-plans.ts).

import { parseStorePlan, type StorePlan } from "@vyz/shared";
import { z } from "zod";
import { INTERVAL } from "@/features/pricing/catalog";
import { serverEnv } from "@/server/env";
import { createAdminSupabase } from "@/server/supabase/admin";

const Subscription = z.object({
  expires_date: z.string().nullable(),
  purchase_date: z.string(),
  store: z.string(),
  unsubscribe_detected_at: z.string().nullable().optional(),
  billing_issues_detected_at: z.string().nullable().optional(),
  grace_period_expires_date: z.string().nullable().optional(),
  refunded_at: z.string().nullable().optional(),
});
const Subscriber = z.object({ subscriber: z.object({ subscriptions: z.record(z.string(), Subscription) }) });

type StoreState = {
  plan: StorePlan;
  store: "app_store" | "play_store";
  status: "active" | "past_due" | "canceled";
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

/** Estado atual do plano do usuário na loja (o produto de plano que vence por último). */
export function storeStateFrom(subscriptions: z.infer<typeof Subscriber>["subscriber"]["subscriptions"], now = new Date()): StoreState | null {
  let best: StoreState | null = null;
  for (const [productId, s] of Object.entries(subscriptions)) {
    const plan = parseStorePlan(productId);
    if (!plan || !s.expires_date || (s.store !== "app_store" && s.store !== "play_store")) continue;
    const periodEnd = new Date(s.expires_date);
    if (best && periodEnd <= best.periodEnd) continue;
    const grace = s.grace_period_expires_date ? new Date(s.grace_period_expires_date) > now : false;
    const live = periodEnd > now && !s.refunded_at;
    const status = s.refunded_at ? "canceled" : live ? (s.billing_issues_detected_at ? "past_due" : "active") : grace ? "past_due" : "canceled";
    let periodStart = new Date(s.purchase_date);
    if (periodStart >= periodEnd) periodStart = new Date(periodEnd.getTime() - 1000);
    best = { plan, store: s.store, status, periodStart, periodEnd, cancelAtPeriodEnd: !!s.unsubscribe_detected_at };
  }
  return best;
}

/** Lê o usuário no RevenueCat e grava a assinatura. null = sem plano da loja. */
export async function syncStoreSubscription(userId: string): Promise<string | null> {
  const key = serverEnv().REVENUECAT_SECRET_API_KEY;
  if (!key) throw new Error("revenuecat:no_secret_key");
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`revenuecat:${res.status}`);
  const parsed = Subscriber.safeParse(await res.json());
  if (!parsed.success) throw new Error("revenuecat:invalid_subscriber");
  const state = storeStateFrom(parsed.data.subscriber.subscriptions);
  if (!state) return null;

  const { data, error } = await createAdminSupabase().rpc("sync_store_subscription", {
    p_user_id: userId,
    p_store: state.store,
    p_plan_id: state.plan.tier,
    p_interval: INTERVAL[state.plan.period],
    p_accounts: state.plan.accounts,
    p_status: state.status,
    p_period_start: state.periodStart.toISOString(),
    p_period_end: state.periodEnd.toISOString(),
    p_cancel_at_period_end: state.cancelAtPeriodEnd,
  });
  if (error) throw new Error(error.message);
  return data ?? null;
}
