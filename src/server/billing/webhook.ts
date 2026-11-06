import "server-only";

// Eventos do webhook da Stripe: grava pelo id (billing_events) e processa uma
// vez só. Reentrega de evento já processado volta 200 sem repetir nada; falha
// no processamento fica em `error` e volta 500, para a Stripe tentar de novo
// (tudo aqui é idempotente, então reprocessar é seguro).
//
//   checkout.session.completed      pedido pago: conclui (igual à volta do cliente)
//   invoice.paid                    renovação: período novo, fatura e transação
//   invoice.payment_failed          renovação recusada: transação com o motivo
//   customer.subscription.*         situação, cancelamento e período
//   charge.refunded                 estorno na lista de transações

import type Stripe from "stripe";
import { Constants, type Json } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import { unwrap } from "@/server/supabase/errors";
import { cardOf, fulfillStripeSession, invoicePaymentIntent, stripe, subscriptionPeriod, type StripeEvent } from "./stripe";

type Handler = (event: StripeEvent) => Promise<void>;

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const isoFromUnix = (v: unknown) => (typeof v === "number" ? new Date(v * 1000).toISOString() : null);
const SUBSCRIPTION_STATUSES: readonly string[] = Constants.public.Enums.subscription_status;

/** Checkout da Stripe pago: conclui o pedido do VYZ. */
async function checkoutPaid(event: StripeEvent) {
  const id = str(event.data.object.id);
  if (!id) throw new Error(`${event.type} sem id`);
  // boleto e PIX confirmariam depois (checkout.session.async_payment_succeeded)
  await fulfillStripeSession(id);
}

/** Situação e período da assinatura na Stripe (atraso, cancelamento, fim, troca). */
async function subscriptionChanged(event: StripeEvent) {
  const s = event.data.object as unknown as Stripe.Subscription;
  if (!s.id || !SUBSCRIPTION_STATUSES.includes(s.status)) throw new Error(`${event.type} com assinatura inválida`);
  const period = subscriptionPeriod(s);
  unwrap(
    await createAdminSupabase()
      .from("subscriptions")
      .update({
        status: s.status as (typeof Constants.public.Enums.subscription_status)[number],
        cancel_at_period_end: s.cancel_at_period_end === true,
        canceled_at: isoFromUnix(s.canceled_at),
        ended_at: isoFromUnix(s.ended_at),
        ...(period ? { current_period_start: period.start, current_period_end: period.end } : {}),
      })
      .eq("provider_subscription_id", s.id),
  );
}

const subscriptionOf = (inv: Stripe.Invoice) => {
  const sub = inv.parent?.subscription_details?.subscription;
  return typeof sub === "string" ? sub : (sub?.id ?? null);
};

/** Assinatura do VYZ ligada à da Stripe. */
async function localSubscription(providerSubscriptionId: string | null) {
  if (!providerSubscriptionId) return null;
  return unwrap(await createAdminSupabase().from("subscriptions").select("id, workspace_id").eq("provider_subscription_id", providerSubscriptionId).maybeSingle());
}

/**
 * Fatura paga. A primeira (subscription_create) e a da troca de plano
 * (subscription_update) já são gravadas pelo checkout e pela troca; aqui
 * entram as renovações (subscription_cycle): período novo, fatura e transação.
 */
async function invoicePaid(event: StripeEvent) {
  const inv = event.data.object as unknown as Stripe.Invoice;
  if (inv.billing_reason !== "subscription_cycle") return;
  const sub = await localSubscription(subscriptionOf(inv));
  if (!sub) throw new Error(`invoice ${inv.id} de assinatura desconhecida`);
  const db = createAdminSupabase();
  const full = await stripe().invoices.retrieve(inv.id!, { expand: ["payments"] });
  const payment = await cardOf(stripe(), invoicePaymentIntent(full));
  const line = full.lines.data[0];
  const periodStart = isoFromUnix(line?.period?.start);
  const periodEnd = isoFromUnix(line?.period?.end);

  const invoice = unwrap(
    await db
      .from("invoices")
      .upsert(
        {
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          provider: "stripe",
          provider_invoice_id: full.id!,
          status: "paid",
          currency: full.currency.toUpperCase(),
          subtotal_cents: full.subtotal,
          total_cents: full.total,
          amount_paid_cents: full.amount_paid,
          description: "Renovação da assinatura",
          lines: full.lines.data.map((l) => ({ label: l.description, amount_cents: l.amount })) as unknown as Json,
          hosted_invoice_url: full.hosted_invoice_url ?? null,
          invoice_pdf_url: full.invoice_pdf ?? null,
          period_start: periodStart,
          period_end: periodEnd,
          paid_at: isoFromUnix(full.status_transitions?.paid_at) ?? new Date().toISOString(),
        },
        { onConflict: "provider_invoice_id" },
      )
      .select("id")
      .single(),
  );
  if (!invoice) throw new Error(`invoice ${full.id} não gravada`);
  if (payment.provider_payment_id) {
    unwrap(
      await db.from("payment_transactions").upsert(
        {
          workspace_id: sub.workspace_id,
          invoice_id: invoice.id,
          provider: "stripe",
          provider_payment_id: payment.provider_payment_id,
          kind: "charge",
          status: "succeeded",
          amount_cents: full.amount_paid,
          currency: full.currency.toUpperCase(),
          method: "card",
          card_brand: payment.card_brand,
          card_last4: payment.card_last4,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "provider_payment_id" },
      ),
    );
  }
  if (periodStart && periodEnd) unwrap(await db.from("subscriptions").update({ current_period_start: periodStart, current_period_end: periodEnd }).eq("id", sub.id));
}

/** Cobrança recusada (renovação ou troca): entra no histórico com o motivo. A situação vem pelo customer.subscription.updated. */
async function invoiceFailed(event: StripeEvent) {
  const inv = event.data.object as unknown as Stripe.Invoice;
  const sub = await localSubscription(subscriptionOf(inv));
  if (!sub) return;
  const full = await stripe().invoices.retrieve(inv.id!, { expand: ["payments.data.payment.payment_intent"] });
  const pi = full.payments?.data[0]?.payment?.payment_intent;
  const piObj = typeof pi === "object" ? pi : null;
  if (!piObj) return;
  const err = piObj.last_payment_error;
  unwrap(
    await createAdminSupabase().from("payment_transactions").upsert(
      {
        workspace_id: sub.workspace_id,
        provider: "stripe",
        provider_payment_id: `${piObj.id}:${event.id}`,
        kind: "charge",
        status: "failed",
        amount_cents: full.amount_due,
        currency: full.currency.toUpperCase(),
        method: "card",
        card_brand: err?.payment_method?.card?.brand ?? null,
        card_last4: err?.payment_method?.card?.last4 ?? null,
        failure_code: err?.decline_code ?? err?.code ?? "card_declined",
        failure_message: err?.message ?? null,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "provider_payment_id" },
    ),
  );
}

/** Estorno (total ou parcial) feito no painel da Stripe. */
async function chargeRefunded(event: StripeEvent) {
  const charge = event.data.object as unknown as Stripe.Charge;
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null);
  if (!pi) return;
  const db = createAdminSupabase();
  const original = unwrap(await db.from("payment_transactions").select("workspace_id, invoice_id").eq("provider_payment_id", pi).maybeSingle());
  if (!original) return;
  unwrap(
    await db.from("payment_transactions").upsert(
      {
        workspace_id: original.workspace_id,
        invoice_id: original.invoice_id,
        provider: "stripe",
        provider_payment_id: `${pi}:refund:${charge.amount_refunded}`,
        kind: "refund",
        status: "succeeded",
        amount_cents: charge.amount_refunded,
        currency: charge.currency.toUpperCase(),
        method: "card",
        card_brand: charge.payment_method_details?.card?.brand ?? null,
        card_last4: charge.payment_method_details?.card?.last4 ?? null,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "provider_payment_id" },
    ),
  );
}

const HANDLERS: Record<string, Handler> = {
  "checkout.session.completed": checkoutPaid,
  "checkout.session.async_payment_succeeded": checkoutPaid,
  "invoice.paid": invoicePaid,
  "invoice.payment_failed": invoiceFailed,
  "customer.subscription.updated": subscriptionChanged,
  "customer.subscription.deleted": subscriptionChanged,
  "charge.refunded": chargeRefunded,
};

/** Eventos para ligar no endpoint do webhook, no painel da Stripe. */
export const STRIPE_WEBHOOK_EVENTS = Object.keys(HANDLERS);

export async function processStripeEvent(event: StripeEvent): Promise<{ status: number; body: Record<string, unknown> }> {
  const admin = createAdminSupabase();
  const stored = await admin
    .from("billing_events")
    .upsert({ id: event.id, provider: "stripe", type: event.type, payload: event as unknown as Json }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (stored.error) {
    console.error("[vyz] webhook: gravar evento", stored.error);
    return { status: 500, body: { error: "storage_failed" } };
  }
  if (stored.data.length === 0) {
    const existing = unwrap(await admin.from("billing_events").select("processed_at").eq("id", event.id).maybeSingle());
    if (existing?.processed_at) return { status: 200, body: { received: true, duplicate: true } };
  }

  const handler = HANDLERS[event.type];
  try {
    if (handler) await handler(event);
    await admin.from("billing_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event.id);
    return { status: 200, body: { received: true, handled: !!handler } };
  } catch (err) {
    console.error("[vyz] webhook da Stripe", event.type, err);
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("billing_events")
      .update({ error: message.slice(0, 500) })
      .eq("id", event.id);
    return { status: 500, body: { error: "processing_failed" } };
  }
}
