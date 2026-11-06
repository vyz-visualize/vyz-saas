import "server-only";

// Cobrança pela Stripe. O cartão nunca passa pelo VYZ: o pagamento é no
// Checkout hospedado da Stripe. Os preços não são cadastrados na Stripe: cada
// pedido manda as linhas calculadas aqui (price_data), as mesmas do resumo do
// checkout. Na volta (/api/billing/stripe/retorno) e no webhook, o pedido é
// concluído pela fulfill_checkout (idempotente: os dois caminhos podem chegar).

import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { serverEnv } from "@/server/env";
import { appOrigin } from "@/server/http/request";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, unwrap } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { OrderMismatch, stripeLineItems, type CheckoutItemRow } from "@/features/checkout/stripe-lines";
import type { BillingProvider } from "./provider";

const notConfigured = () => appError("billing:not_configured", "A cobrança pela Stripe ainda não foi configurada.");

let client: Stripe | null = null;

/** Cliente da Stripe (STRIPE_SECRET_KEY). */
export function stripe(): Stripe {
  const key = serverEnv().STRIPE_SECRET_KEY;
  if (!key) throw notConfigured();
  client ??= new Stripe(key, { appInfo: { name: "VYZ", url: "https://www.vyzualize.com.br" }, maxNetworkRetries: 2 });
  return client;
}

const id = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

// ---- provedor (interface comum com o simulado) -------------------------------------

export const stripeBillingProvider: BillingProvider = {
  id: "stripe",

  // a sessão da Stripe nasce no clique em "Pagar" (startStripeCheckout), com o pedido já gravado
  async openCheckout() {
    return { providerSessionId: null };
  },

  // o pagamento é no Checkout da Stripe, nunca com cartão no formulário do VYZ
  async confirmPayment() {
    throw appError("billing:use_stripe_checkout", "O pagamento é feito na página segura da Stripe.");
  },

  /**
   * Troca o preço do item do plano. A Stripe calcula e cobra a diferença na
   * hora no cartão salvo (always_invoice); troca para menos vira crédito.
   */
  async updateSubscription({ changeId, subscriptionId, next }) {
    if (!subscriptionId || !next) throw appError("plan:inactive");
    const s = stripe();
    const sub = await s.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
    const item = planItem(sub);
    if (!item) throw appError("plan:inactive");
    const updated = await s.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: item.id,
            price_data: { currency: "brl", product: id(item.price.product)!, unit_amount: next.amountCents, recurring: { interval: next.interval } },
            quantity: 1,
          },
        ],
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
        metadata: { plan_id: next.planId, accounts_quantity: String(next.accounts) },
        expand: ["latest_invoice.payments"],
      },
      { idempotencyKey: `vyz-change-${changeId}` },
    );
    const invoice = typeof updated.latest_invoice === "object" ? updated.latest_invoice : null;
    // só a fatura desta troca (a última pode ser a da renovação anterior)
    if (!invoice || invoice.billing_reason !== "subscription_update" || invoice.amount_paid <= 0) return { invoiceId: null, paymentId: null };
    const payment = invoice.payments?.data[0]?.payment;
    return { invoiceId: invoice.id ?? null, paymentId: id(payment?.payment_intent) };
  },

  async setCancelAtPeriodEnd({ subscriptionId, cancel }) {
    if (!subscriptionId) throw appError("plan:inactive");
    await stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });
  },
};

// ---- checkout ----------------------------------------------------------------------

type CheckoutRow = {
  id: string;
  status: string;
  user_id: string | null;
  workspace_id: string | null;
  email: string;
  full_name: string;
  company_name: string;
  plan_id: string | null;
  interval: "month" | "year";
  accounts_quantity: number;
  amount_due_now_cents: number;
  recurring_cents: number;
  expires_at: string;
  provider_session_id: string | null;
  checkout_items: CheckoutItemRow[];
};

function lineItems(c: CheckoutRow) {
  try {
    return stripeLineItems(c);
  } catch (err) {
    if (err instanceof OrderMismatch) throw appError("checkout:invalid_order", "Não conseguimos montar o pagamento deste pedido. Monte o pedido de novo.");
    throw err;
  }
}

async function loadCheckout(db: DB, checkoutId: string): Promise<CheckoutRow | null> {
  return unwrap(
    await db
      .from("checkout_sessions")
      .select(
        "id, status, user_id, workspace_id, email, full_name, company_name, plan_id, interval, accounts_quantity, amount_due_now_cents, recurring_cents, expires_at, provider_session_id, checkout_items(kind, plan_price_id, quantity, amount_cents, label, position)",
      )
      .eq("id", checkoutId)
      .maybeSingle(),
  ) as CheckoutRow | null;
}

/**
 * Abre (ou reaproveita) o Checkout da Stripe do pedido e devolve a URL. O
 * pedido já foi autorizado pela Server Action (é do usuário e está aberto).
 */
export async function startStripeCheckout(input: { checkoutId: string; userId: string }): Promise<string> {
  const db = createAdminSupabase({ actorId: input.userId });
  const c = await loadCheckout(db, input.checkoutId);
  if (!c || c.user_id !== input.userId) throw appError("checkout:not_found");
  if (c.status !== "open") throw appError("checkout:not_open");
  const s = stripe();

  // a mesma sessão aberta serve de novo (voltou da Stripe sem pagar)
  if (c.provider_session_id?.startsWith("cs_")) {
    const old = await s.checkout.sessions.retrieve(c.provider_session_id).catch(() => null);
    if (old?.status === "open" && old.url) return old.url;
  }

  const customer = c.workspace_id ? unwrap(await db.from("billing_customers").select("provider_customer_id").eq("workspace_id", c.workspace_id).maybeSingle()) : null;
  const origin = await appOrigin();
  const metadata = { checkout_session_id: c.id, user_id: input.userId, plan_id: c.plan_id ?? "", accounts_quantity: String(c.accounts_quantity) };
  const subscription = !!c.plan_id && c.recurring_cents > 0;
  // a Stripe exige pelo menos 30 min e no máximo 24 h; o pedido vence antes disso
  const expiresAt = Math.min(Math.floor(new Date(c.expires_at).getTime() / 1000), Math.floor(Date.now() / 1000) + 23 * 3600);

  const session = await s.checkout.sessions.create(
    {
      mode: subscription ? "subscription" : "payment",
      line_items: lineItems(c),
      ...(customer?.provider_customer_id ? { customer: customer.provider_customer_id } : { customer_email: c.email }),
      ...(subscription ? { subscription_data: { metadata } } : { customer_creation: "always", payment_intent_data: { metadata } }),
      client_reference_id: c.id,
      metadata,
      locale: "pt-BR",
      billing_address_collection: "auto",
      ...(expiresAt - Date.now() / 1000 > 1800 ? { expires_at: expiresAt } : {}),
      success_url: `${origin}/api/billing/stripe/retorno?pedido=${c.id}&sessao={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinar/pagamento/${c.id}?cancelado=1`,
    },
    // uma sessão por pedido; se a anterior venceu, a nova leva o id dela na chave
    { idempotencyKey: `vyz-checkout-${c.id}-${c.provider_session_id ?? "primeira"}` },
  );
  unwrap(await db.from("checkout_sessions").update({ provider_session_id: session.id }).eq("id", c.id));
  if (!session.url) throw appError("unknown");
  return session.url;
}

/** Bandeira, final e id do pagamento de um PaymentIntent. */
async function cardOf(s: Stripe, paymentIntent: string | null) {
  if (!paymentIntent) return { provider_payment_id: null, method: "card", card_brand: null, card_last4: null };
  const pi = await s.paymentIntents.retrieve(paymentIntent, { expand: ["latest_charge"] }).catch(() => null);
  const card = typeof pi?.latest_charge === "object" ? pi.latest_charge?.payment_method_details?.card : null;
  return {
    provider_payment_id: paymentIntent,
    method: "card",
    card_brand: card?.brand ?? null,
    card_last4: card?.last4 ?? null,
    ...(card?.installments?.plan?.count ? { installments: card.installments.plan.count } : {}),
  };
}

/** O PaymentIntent de uma fatura (as faturas novas guardam em payments). */
function invoicePaymentIntent(invoice: Stripe.Invoice | null): string | null {
  return id(invoice?.payments?.data.find((p) => p.status === "paid")?.payment?.payment_intent ?? invoice?.payments?.data[0]?.payment?.payment_intent);
}

/** O item do plano na assinatura (produto marcado no checkout; sem a marca, o primeiro). */
function planItem(sub: Stripe.Subscription): Stripe.SubscriptionItem | undefined {
  return sub.items.data.find((i) => typeof i.price.product === "object" && !i.price.product.deleted && i.price.product.metadata?.kind === "plan") ?? sub.items.data[0];
}

/** Período da assinatura na Stripe (na API nova, fica nos itens; é o mesmo em todos). */
export function subscriptionPeriod(sub: Stripe.Subscription): { start: string; end: string } | null {
  const item = sub.items.data[0];
  if (!item?.current_period_start || !item.current_period_end) return null;
  return { start: new Date(item.current_period_start * 1000).toISOString(), end: new Date(item.current_period_end * 1000).toISOString() };
}

export type StripeFulfillment = { workspaceId: string; checkoutId: string; userId: string | null; planId: string | null; amountCents: number; paid: boolean };

/**
 * Conclui o pedido a partir da sessão do Checkout da Stripe, se paga. Usada
 * na volta do cliente e no webhook; a fulfill_checkout é idempotente.
 */
export async function fulfillStripeSession(sessionId: string): Promise<StripeFulfillment | null> {
  const s = stripe();
  const session = await s.checkout.sessions.retrieve(sessionId, { expand: ["subscription", "invoice.payments"] });
  const checkoutId = session.metadata?.checkout_session_id ?? session.client_reference_id;
  if (!checkoutId) throw new Error(`sessão ${session.id} sem checkout_session_id`);
  const db = createAdminSupabase();
  const c = await loadCheckout(db, checkoutId);
  if (!c) throw new Error(`pedido ${checkoutId} não encontrado`);
  const base = { checkoutId, userId: c.user_id, planId: c.plan_id, amountCents: c.amount_due_now_cents };
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return { workspaceId: c.workspace_id ?? "", ...base, paid: false };
  // o valor cobrado tem de ser o do pedido (ninguém troca o preço no caminho)
  if (session.amount_total !== c.amount_due_now_cents) throw new Error(`valor pago ${session.amount_total} ≠ pedido ${c.amount_due_now_cents}`);

  const customer = id(session.customer);
  if (!customer) throw new Error(`sessão ${session.id} sem customer`);
  const sub = typeof session.subscription === "object" ? session.subscription : null;
  const invoice = typeof session.invoice === "object" ? session.invoice : null;
  const payment = await cardOf(s, id(session.payment_intent) ?? invoicePaymentIntent(invoice));

  const workspaceId = unwrap(
    await db.rpc("fulfill_checkout", {
      p_checkout_id: checkoutId,
      p_provider_customer_id: customer,
      ...(sub ? { p_provider_subscription_id: sub.id } : {}),
      ...(invoice?.id ? { p_provider_invoice_id: invoice.id } : {}),
      p_payment: payment,
    }),
  );
  if (!workspaceId) throw new Error(`fulfill_checkout sem workspace (${checkoutId})`);

  // o período e os links da fatura vêm da Stripe
  const period = sub ? subscriptionPeriod(sub) : null;
  if (sub && period) {
    const upd = await db.from("subscriptions").update({ current_period_start: period.start, current_period_end: period.end }).eq("provider_subscription_id", sub.id);
    if (upd.error) console.error("[vyz] stripe: período da assinatura", upd.error);
  }
  if (invoice?.id) {
    const upd = await db.from("invoices").update({ hosted_invoice_url: invoice.hosted_invoice_url ?? null, invoice_pdf_url: invoice.invoice_pdf ?? null }).eq("provider_invoice_id", invoice.id);
    if (upd.error) console.error("[vyz] stripe: links da fatura", upd.error);
  }
  return { workspaceId, ...base, paid: true };
}

// ---- webhook -----------------------------------------------------------------------

/** Evento do webhook, só com o que o VYZ lê. */
export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

/**
 * Confere o cabeçalho Stripe-Signature ("t=<unix>,v1=<hmac>,...") com o corpo
 * cru: HMAC-SHA256 de "<t>.<corpo>" com o segredo do endpoint, comparação em
 * tempo constante e no máximo 5 minutos de diferença (contra replay).
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now(), toleranceSeconds = 300): StripeEvent {
  if (!header) throw new Error("assinatura ausente");
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k, v]) => k === "v1" && v).map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new Error("assinatura malformada");
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) throw new Error("assinatura fora da janela");

  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex"));
  const match = signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!match) throw new Error("assinatura inválida");

  const event = JSON.parse(payload) as Partial<StripeEvent>;
  if (typeof event.id !== "string" || typeof event.type !== "string" || !event.data?.object) throw new Error("evento inválido");
  return event as StripeEvent;
}

export { cardOf, invoicePaymentIntent };
