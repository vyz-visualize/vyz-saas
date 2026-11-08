import "server-only";

// Receita do site (Stripe, só leitura) e a visão do RevenueCat (as duas lojas
// juntas, pela API V2 só leitura).

import type Stripe from "stripe";
import { addMoney, type Money, type RevenueBlock, type Source } from "@/features/admin/types";
import { stripe } from "@/server/billing/stripe";
import { revenueCatConfig } from "./credentials";

const DAY = 86_400_000;

/** Valor mensal de um item de assinatura (anual vira 1/12). */
function monthly(item: Stripe.SubscriptionItem): number {
  const p = item.price;
  const amount = ((p.unit_amount ?? 0) * (item.quantity ?? 1)) / 100;
  const n = p.recurring?.interval_count ?? 1;
  switch (p.recurring?.interval) {
    case "year":
      return amount / (12 * n);
    case "week":
      return (amount * 4.345) / n;
    case "day":
      return (amount * 30.4) / n;
    default:
      return amount / n;
  }
}

export async function loadStripe(): Promise<Source<RevenueBlock>> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, reason: "Stripe não configurada." };
  try {
    const s = stripe();
    const since = Math.floor((Date.now() - 30 * DAY) / 1000);
    let mrr: Money = {};
    let subscribers = 0;
    for await (const sub of s.subscriptions.list({ status: "active", limit: 100 })) {
      subscribers++;
      for (const item of sub.items.data) mrr = addMoney(mrr, item.price.currency.toUpperCase(), monthly(item));
    }
    let churned30 = 0;
    for await (const sub of s.subscriptions.list({ status: "canceled", limit: 100 })) {
      if ((sub.canceled_at ?? sub.ended_at ?? 0) >= since) churned30++;
    }
    let revenue30: Money = {};
    for await (const inv of s.invoices.list({ status: "paid", created: { gte: since }, limit: 100 })) revenue30 = addMoney(revenue30, inv.currency.toUpperCase(), inv.amount_paid / 100);
    let refunds30: Money = {};
    let refundCount30 = 0;
    for await (const r of s.refunds.list({ created: { gte: since }, limit: 100 })) {
      if (r.status === "failed" || r.status === "canceled") continue;
      refunds30 = addMoney(refunds30, r.currency.toUpperCase(), r.amount / 100);
      refundCount30++;
    }
    const churnRate = subscribers + churned30 > 0 ? (churned30 / (subscribers + churned30)) * 100 : null;
    const live = process.env.STRIPE_SECRET_KEY.startsWith("sk_live") || process.env.STRIPE_SECRET_KEY.startsWith("rk_live");
    return { ok: true, data: { mrr, subscribers, revenue30, churned30, churnRate, refunds30, refundCount30, note: live ? undefined : "Chave de teste da Stripe: números do modo de teste." } };
  } catch (err) {
    return { ok: false, reason: `Stripe: ${(err as Error).message.slice(0, 120)}` };
  }
}

type RcMetric = { id: string; value: number; unit: string };
type RcChart = { values?: { cohort: number; measure: number; value: number }[] };

async function rc<T>(path: string, cfg: NonNullable<ReturnType<typeof revenueCatConfig>>): Promise<T> {
  const res = await fetch(`https://api.revenuecat.com/v2/projects/${cfg.project}${path}`, { headers: { Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`RevenueCat: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Valor da medida no último período do gráfico. */
function lastMeasure(c: RcChart, measure: number): number {
  const vals = (c.values ?? []).filter((v) => v.measure === measure);
  return vals.at(-1)?.value ?? 0;
}

export async function loadRevenueCat(): Promise<Source<RevenueBlock>> {
  const cfg = revenueCatConfig();
  if (!cfg) return { ok: false, reason: "RevenueCat não configurado." };
  try {
    const [overview, churn, refunds] = await Promise.all([
      rc<{ currency: string; metrics: RcMetric[] }>("/metrics/overview", cfg),
      rc<RcChart>("/charts/churn?resolution=month", cfg).catch(() => ({}) as RcChart),
      rc<RcChart>("/charts/refund_rate?resolution=month", cfg).catch(() => ({}) as RcChart),
    ]);
    const m = (id: string) => overview.metrics.find((x) => x.id === id)?.value ?? 0;
    const cur = overview.currency || "USD";
    return {
      ok: true,
      data: {
        mrr: { [cur]: m("mrr") },
        subscribers: m("active_subscriptions"),
        revenue30: { [cur]: m("revenue") },
        churned30: lastMeasure(churn, 1),
        churnRate: lastMeasure(churn, 2),
        refunds30: {},
        refundCount30: lastMeasure(refunds, 1),
        trials: m("active_trials"),
        note: `App Store e Google Play juntos, em ${cur} (conversão do RevenueCat). Não soma no total para não contar duas vezes.`,
      },
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
