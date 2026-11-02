import "server-only";

// Núcleo do checkout: grava o pedido e conclui o pagamento. Não lê sessão nem
// cookies (as Server Actions autorizam antes e passam o usuário; scripts de
// teste chamam direto). Escreve com a chave de serviço porque cobrança é
// escrita só do servidor: o usuário só lê o que é dele (RLS). O actorId vai
// para a auditoria.

import { randomBytes, randomUUID } from "node:crypto";
import { businessType } from "@/features/catalog/business-types";
import type { CardSummary } from "@/features/checkout/card";
import { BLOCK_MESSAGE, type Order } from "@/features/checkout/order";
import type { PlanState } from "@/features/pricing/pricing";
import type { Json } from "@/lib/supabase/database.types";
import { requestContext } from "@/server/http/request";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest, unwrap } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { getBillingProvider, type BillingProviderId } from "./provider";

export type CheckoutCustomer = {
  userId: string;
  email: string;
  fullName: string;
  companyName: string;
  /** E.164 (+55...). */
  phone: string | null;
  /** CPF ou CNPJ, só dígitos. */
  taxId: string | null;
  /** Workspace sem assinatura que o pedido assina (o usuário é dono). null = nasce um novo. */
  workspaceId: string | null;
};

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export async function billingAdmin(actorId: string): Promise<DB> {
  const ctx = await requestContext();
  return createAdminSupabase({ actorId, forwardHeaders: ctx.forwardHeaders });
}

/** Grava o pedido (checkout_sessions + checkout_items). Fica um pedido aberto por usuário. */
export async function createCheckoutSession(input: {
  customer: CheckoutCustomer;
  state: PlanState;
  order: Order;
  checkoutId?: string;
}): Promise<{ id: string }> {
  const { customer, state, order } = input;
  if (order.blocked) throw appError(`checkout:${order.blocked}`, BLOCK_MESSAGE[order.blocked]);

  const id = input.checkoutId ?? randomUUID();
  const db = await billingAdmin(customer.userId);
  const provider = getBillingProvider();
  const { providerSessionId } = await provider.openCheckout({ checkoutId: id, email: customer.email, amountCents: order.amountDueNowCents, currency: "BRL" });

  unwrap(
    await db.from("checkout_sessions").insert({
      id,
      provider: provider.id,
      provider_session_id: providerSessionId,
      user_id: customer.userId,
      workspace_id: customer.workspaceId,
      email: customer.email,
      full_name: customer.fullName,
      company_name: customer.companyName,
      phone: customer.phone,
      tax_id: customer.taxId,
      plan_id: order.planDbId,
      product: order.product,
      interval: order.interval,
      accounts_quantity: order.accountsQuantity,
      // só tipos de negócio já disponíveis no onboarding (o nicho fica na seleção)
      business_type_id: state.nicho && businessType(state.nicho)?.available ? state.nicho : null,
      selection: state,
      quote: order.quote as unknown as Json,
      amount_due_now_cents: order.amountDueNowCents,
      recurring_cents: order.recurringCents,
      currency: "BRL",
    }),
  );

  const items = await db.from("checkout_items").insert(
    order.items.map((item, position) => ({
      checkout_session_id: id,
      kind: item.kind,
      plan_price_id: item.planPriceId ?? null,
      billing_item_id: item.billingItemId ?? null,
      quantity: item.quantity,
      amount_cents: item.amountCents,
      label: item.label,
      position,
    })),
  );
  if (items.error) {
    await db.from("checkout_sessions").delete().eq("id", id);
    throw fromPostgrest(items.error);
  }

  // o pedido anterior ainda aberto não pode mais ser pago (evita cobrar duas vezes)
  const old = await db.from("checkout_sessions").update({ status: "canceled" }).eq("user_id", customer.userId).eq("status", "open").neq("id", id);
  if (old.error) console.error("[vyz] cancelar pedidos abertos", old.error);
  return { id };
}

/** O workspace (ou algum workspace do qual o usuário é dono) já tem assinatura ativa? */
async function alreadySubscribed(db: DB, userId: string, workspaceId: string | null): Promise<boolean> {
  let ids = workspaceId ? [workspaceId] : [];
  if (!workspaceId) {
    const owned = unwrap(await db.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("role", "owner")) ?? [];
    ids = owned.map((m) => m.workspace_id);
  }
  if (ids.length === 0) return false;
  const { count, error } = await db
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .in("workspace_id", ids)
    .in("status", [...ACTIVE_STATUSES]);
  if (error) throw fromPostgrest(error);
  return (count ?? 0) > 0;
}

/** Eventos do provedor simulado ficam em billing_events, como os do webhook da Stripe. */
async function recordProviderEvent(db: DB, provider: BillingProviderId, type: string, payload: Record<string, Json>) {
  const { error } = await db.from("billing_events").insert({
    id: `${provider}_evt_${randomBytes(12).toString("hex")}`,
    provider,
    type,
    payload,
    processed_at: new Date().toISOString(),
  });
  if (error) console.error("[vyz] evento de cobrança", error);
}

export type PaidCheckout = { workspaceId: string; planId: string | null; amountCents: number; alreadyCompleted: boolean };

/**
 * Cobra o pedido no provedor e conclui com fulfill_checkout (atômico e
 * idempotente). Pedido já concluído devolve o mesmo workspace sem cobrar de
 * novo. Recusa grava a tentativa e lança billing:<motivo>.
 */
export async function payCheckoutSession(input: { checkoutId: string; userId: string; card: CardSummary }): Promise<PaidCheckout> {
  const db = await billingAdmin(input.userId);
  const checkout = unwrap(
    await db
      .from("checkout_sessions")
      .select("id, status, workspace_id, email, full_name, plan_id, interval, amount_due_now_cents, currency, expires_at")
      .eq("id", input.checkoutId)
      .eq("user_id", input.userId)
      .maybeSingle(),
  );
  if (!checkout) throw appError("checkout:not_found");

  const paid = { planId: checkout.plan_id, amountCents: checkout.amount_due_now_cents };
  if (checkout.status === "completed" && checkout.workspace_id) return { workspaceId: checkout.workspace_id, ...paid, alreadyCompleted: true };
  if (checkout.status !== "open") throw appError("checkout:not_open");
  if (new Date(checkout.expires_at).getTime() < Date.now()) {
    await db.from("checkout_sessions").update({ status: "expired" }).eq("id", checkout.id).eq("status", "open");
    throw appError("checkout:not_open", "Este pedido expirou. Monte o pedido de novo para continuar.");
  }
  if (await alreadySubscribed(db, input.userId, checkout.workspace_id)) {
    throw appError("checkout:already_subscribed", "Você já tem uma assinatura ativa. Troque de plano em Plano, no painel.");
  }

  const customer = checkout.workspace_id
    ? unwrap(await db.from("billing_customers").select("provider_customer_id").eq("workspace_id", checkout.workspace_id).maybeSingle())
    : null;

  const provider = getBillingProvider();
  const charge = await provider.confirmPayment({
    checkoutId: checkout.id,
    amountCents: checkout.amount_due_now_cents,
    currency: checkout.currency,
    customer: { email: checkout.email, name: checkout.full_name, existingId: customer?.provider_customer_id ?? null },
    subscription: checkout.plan_id ? { interval: checkout.interval } : null,
    card: input.card,
  });

  const attempt = {
    checkout_session_id: checkout.id,
    payment_id: charge.paymentId,
    amount_cents: checkout.amount_due_now_cents,
    currency: checkout.currency,
    method: "card",
    card_brand: input.card.brand,
    card_last4: input.card.last4,
  };

  if (!charge.ok) {
    if (provider.id === "mock") await recordProviderEvent(db, provider.id, "payment_intent.payment_failed", { ...attempt, failure_code: charge.code });
    // a recusa entra no histórico de transações; no primeiro checkout ainda
    // não há workspace e ela fica ligada só ao pedido
    const failed = await db.from("payment_transactions").insert({
      workspace_id: checkout.workspace_id,
      checkout_session_id: checkout.id,
      provider: provider.id,
      provider_payment_id: charge.paymentId,
      kind: "charge",
      status: "failed",
      amount_cents: checkout.amount_due_now_cents,
      currency: checkout.currency,
      method: "card",
      card_brand: input.card.brand,
      card_last4: input.card.last4,
      failure_code: charge.code,
      failure_message: charge.message,
      processed_at: new Date().toISOString(),
    });
    if (failed.error) console.error("[vyz] transação recusada", failed.error);
    throw appError(`billing:${charge.code}`, charge.message);
  }

  const workspaceId = unwrap(
    await db.rpc("fulfill_checkout", {
      p_checkout_id: checkout.id,
      p_provider_customer_id: charge.customerId,
      p_provider_invoice_id: charge.invoiceId,
      ...(charge.subscriptionId ? { p_provider_subscription_id: charge.subscriptionId } : {}),
      p_payment: { method: "card", card_brand: input.card.brand, card_last4: input.card.last4, provider_payment_id: charge.paymentId },
    }),
  );
  if (!workspaceId) throw appError("unknown");
  if (provider.id === "mock") await recordProviderEvent(db, provider.id, "payment_intent.succeeded", { ...attempt, workspace_id: workspaceId });
  return { workspaceId, ...paid, alreadyCompleted: false };
}
