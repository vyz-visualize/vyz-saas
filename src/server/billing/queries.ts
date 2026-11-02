import "server-only";

// Leituras da cobrança com a sessão do usuário (RLS): o pedido é de quem o
// criou; assinatura, faturas e transações, de owner e admin do workspace.
// Devolvem DTOs no formato da tela, nunca as linhas cruas.

import { PLAN_LABEL, parsePlanDbId, type Product } from "@/features/pricing/pricing";
import { productEntryUrl } from "@/lib/product-hosts";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import type { CardBrand } from "@/features/checkout/card";
import {
  describeSubscriptionChange,
  type InvoiceStatus,
  type PaymentMethod,
  type ServiceOrderStatus,
  type SubscriptionChange,
  type TransactionKind,
  type TransactionStatus,
} from "@/features/checkout/labels";
import { normalizeState, planItemLabel } from "@/features/checkout/order";
import { maskTaxId } from "@/features/checkout/tax-id";
import { BILLING_ITEMS, type BillingItemId } from "@/features/pricing/catalog";
import type { PlanId, PlanState, Quote } from "@/features/pricing/pricing";
import type { SubscriptionStatus } from "@/features/workspace/session";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/supabase/cookies";
import type { Json } from "@/lib/supabase/database.types";
import { authorize, getViewer } from "@/server/auth/workspace";
import { serverEnv } from "@/server/env";
import { createServerSupabase } from "@/server/supabase/server";

const isPlanId = (v: string | null): v is PlanId => v === "base" || v === "pro" || v === "avancado";
const billingItem = (id: string | null) => (id && id in BILLING_ITEMS ? BILLING_ITEMS[id as BillingItemId] : null);

// ---- quem está assinando ----------------------------------------------------------

export type CheckoutViewer = {
  user: { id: string; email: string; fullName: string; phone: string | null } | null;
  /** Workspace do usuário (dono) que já tem assinatura ativa: a troca é em /painel/plano. */
  subscribed: { workspaceId: string; workspaceName: string } | null;
  /** Workspace do usuário (dono) sem assinatura: o pedido assina por ele. */
  target: { workspaceId: string; workspaceName: string } | null;
  /** Participa de workspaces de outras pessoas, mas não é dono de nenhum. */
  memberElsewhere: boolean;
};

/** Para o /assinar e para startCheckout: decide se o pedido cria um workspace, assina um existente ou não cabe. */
/** Quem está no checkout e qual workspace dele recebe o produto escolhido. */
export const getCheckoutViewer = cache(async (product: Product = "dash"): Promise<CheckoutViewer> => {
  const viewer = await getViewer();
  if (!viewer) return { user: null, subscribed: null, target: null, memberElsewhere: false };

  const supabase = await createServerSupabase();
  // cada produto tem o seu workspace: comprar LP não mexe no workspace de dashboards
  const owned = viewer.memberships.filter((m) => m.role === "owner" && m.workspace.product === product).map((m) => m.workspace);
  const [profile, access] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", viewer.user.id).maybeSingle(),
    owned.length > 0
      ? supabase
          .from("workspace_access")
          .select("workspace_id, has_access")
          .in(
            "workspace_id",
            owned.map((w) => w.id),
          )
      : null,
  ]);
  if (access?.error) console.error("[vyz] acesso dos workspaces", access.error);

  // o workspace aberto (cookie ou padrão do perfil) decide primeiro
  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value ?? viewer.profile?.default_workspace_id;
  const first = owned.find((w) => w.id === preferred) ?? owned[0];
  const active = new Set((access?.data ?? []).filter((a) => a.has_access).map((a) => a.workspace_id));
  const ref = first ? { workspaceId: first.id, workspaceName: first.name } : null;

  return {
    user: {
      id: viewer.user.id,
      email: viewer.profile?.email || viewer.user.email || "",
      fullName: viewer.profile?.full_name ?? "",
      phone: profile.data?.phone ?? null,
    },
    subscribed: first && active.has(first.id) ? ref : null,
    target: first && !active.has(first.id) ? ref : null,
    memberElsewhere: owned.length === 0 && viewer.memberships.length > 0,
  };
});

// ---- pedido ------------------------------------------------------------------------

export type CheckoutStatus = "open" | "completed" | "expired" | "canceled";

export type CheckoutView = {
  id: string;
  /** "expired" também quando passou da validade e ainda não foi marcado. */
  status: CheckoutStatus;
  email: string;
  fullName: string;
  companyName: string;
  planId: PlanId | null;
  /** Produto do pedido: decide para onde o cliente vai depois de pagar. */
  product: Product;
  interval: "month" | "year";
  accountsQuantity: number;
  amountDueNowCents: number;
  recurringCents: number;
  currency: string;
  /** Seleção da LP, para resumir, alterar ou recomeçar. */
  state: PlanState;
  quote: Quote;
  items: { kind: "recurring" | "one_time"; label: string; quantity: number; amountCents: number }[];
  workspaceId: string | null;
  expiresAt: string;
  completedAt: string | null;
};

function asQuote(value: Json): Quote | null {
  const q = value as Partial<Quote> | null;
  return q && typeof q === "object" && Array.isArray(q.lines) ? (q as Quote) : null;
}

/** Pedido do usuário logado (RLS: só o próprio). null = não existe ou é de outra pessoa. */
export async function getCheckout(id: string): Promise<CheckoutView | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("checkout_sessions")
    .select(
      "id, status, email, full_name, company_name, plan_id, product, interval, accounts_quantity, amount_due_now_cents, recurring_cents, currency, selection, quote, workspace_id, expires_at, completed_at, checkout_items(kind, label, quantity, amount_cents, position)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[vyz] pedido", error);
  const quote = data ? asQuote(data.quote) : null;
  if (!data || !quote) return null;

  const lapsed = data.status === "open" && new Date(data.expires_at).getTime() < Date.now();
  return {
    id: data.id,
    status: lapsed ? "expired" : data.status,
    email: data.email,
    fullName: data.full_name,
    companyName: data.company_name,
    planId: checkoutTier(data.plan_id),
    product: data.product,
    interval: data.interval,
    accountsQuantity: data.accounts_quantity,
    amountDueNowCents: data.amount_due_now_cents,
    recurringCents: data.recurring_cents,
    currency: data.currency,
    state: normalizeState(data.selection as unknown as Partial<PlanState>),
    quote,
    items: [...data.checkout_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ kind: i.kind === "one_time" ? "one_time" : "recurring", label: i.label, quantity: i.quantity, amountCents: i.amount_cents })),
    workspaceId: data.workspace_id,
    expiresAt: data.expires_at,
    completedAt: data.completed_at,
  };
}

export type CheckoutReceipt = {
  workspaceName: string | null;
  /** Endereço de entrada no produto (dash.…/<slug> ou lps.…/<slug>). */
  entryUrl: string | null;
  payment: { method: PaymentMethod | null; cardBrand: CardBrand | null; cardLast4: string | null; amountCents: number; processedAt: string | null } | null;
  subscription: { currentPeriodEnd: string } | null;
};

/** Comprovante do pedido concluído (tela de sucesso). */
export async function getCheckoutReceipt(checkout: CheckoutView): Promise<CheckoutReceipt> {
  if (checkout.status !== "completed" || !checkout.workspaceId) return { workspaceName: null, entryUrl: null, payment: null, subscription: null };
  const supabase = await createServerSupabase();
  const [workspace, payment, subscription] = await Promise.all([
    supabase.from("workspaces").select("name, slug, product").eq("id", checkout.workspaceId).maybeSingle(),
    supabase
      .from("payment_transactions")
      .select("method, card_brand, card_last4, amount_cents, processed_at")
      .eq("checkout_session_id", checkout.id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("subscriptions").select("current_period_end").eq("checkout_session_id", checkout.id).maybeSingle(),
  ]);
  const p = payment.data;
  return {
    workspaceName: workspace.data?.name ?? null,
    entryUrl: workspace.data ? productEntryUrl(workspace.data.product, workspace.data.slug, "?bemvindo=1") : null,
    payment: p
      ? {
          method: (p.method as PaymentMethod | null) ?? null,
          cardBrand: (p.card_brand as CardBrand | null) ?? null,
          cardLast4: p.card_last4,
          amountCents: p.amount_cents,
          processedAt: p.processed_at,
        }
      : null,
    subscription: subscription.data ? { currentPeriodEnd: subscription.data.current_period_end } : null,
  };
}

// ---- página Plano ------------------------------------------------------------------

export type BillingOverview = {
  workspaceId: string;
  /** mock = pagamento simulado (mostrar o selo). */
  provider: "mock" | "stripe";
  /** Só o dono troca plano, cancela e retoma. */
  canManage: boolean;
  subscription: {
    id: string;
    tier: PlanId;
    product: Product;
    status: SubscriptionStatus;
    interval: "month" | "year";
    accountsQuantity: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    items: { id: string; kind: "plan" | "extra"; label: string; quantity: number; monthlyCents: number }[];
    /** Soma dos itens, por mês. */
    monthlyCents: number;
    /** Extras mensais (entram na troca de plano). */
    extrasMonthlyCents: number;
    /** Cobrança por período (mês ou ano). */
    recurringCents: number;
  } | null;
  customer: { email: string; legalName: string | null; taxId: string | null; phone: string | null } | null;
  invoices: {
    id: string;
    status: InvoiceStatus;
    description: string | null;
    totalCents: number;
    amountPaidCents: number;
    currency: string;
    lines: { label: string; quantity: number; amountCents: number }[];
    periodStart: string | null;
    periodEnd: string | null;
    paidAt: string | null;
    createdAt: string;
    hostedUrl: string | null;
    pdfUrl: string | null;
  }[];
  transactions: {
    id: string;
    kind: TransactionKind;
    status: TransactionStatus;
    amountCents: number;
    currency: string;
    method: PaymentMethod | null;
    cardBrand: CardBrand | null;
    cardLast4: string | null;
    failureMessage: string | null;
    processedAt: string | null;
    createdAt: string;
  }[];
  timeline: { id: number; change: SubscriptionChange; label: string; actorName: string | null; createdAt: string }[];
  serviceOrders: { id: string; itemId: string; label: string; quantity: number; status: ServiceOrderStatus; createdAt: string; deliveredAt: string | null }[];
};

function invoiceLines(value: Json): BillingOverview["invoices"][number]["lines"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((l) => {
    const line = l as { label?: unknown; quantity?: unknown; amount_cents?: unknown } | null;
    if (!line || typeof line.label !== "string") return [];
    return [{ label: line.label, quantity: Number(line.quantity) || 1, amountCents: Number(line.amount_cents) || 0 }];
  });
}

/** Assinatura, itens, faturas, transações, linha do tempo e pedidos de serviço (owner e admin). */
export async function getBillingOverview(): Promise<BillingOverview> {
  const session = await authorize("admin", { access: false });
  const ws = session.workspace.id;
  const supabase = await createServerSupabase();

  const [sub, invoices, transactions, changes, orders, customer] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, plan_id, status, interval, accounts_quantity, current_period_start, current_period_end, cancel_at_period_end, created_at, subscription_items(id, plan_price_id, billing_item_id, quantity, amount_cents, created_at)",
      )
      .eq("workspace_id", ws)
      .not("status", "in", "(canceled,incomplete_expired)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "id, status, description, total_cents, amount_paid_cents, currency, lines, hosted_invoice_url, invoice_pdf_url, period_start, period_end, paid_at, created_at",
      )
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("payment_transactions")
      .select("id, kind, status, amount_cents, currency, method, card_brand, card_last4, failure_message, processed_at, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("subscription_changes")
      .select("id, change, from_value, to_value, actor_id, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("service_orders")
      .select("id, billing_item_id, quantity, status, created_at, delivered_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("billing_customers").select("email, legal_name, tax_id, phone").eq("workspace_id", ws).maybeSingle(),
  ]);
  for (const r of [sub, invoices, transactions, changes, orders, customer]) if (r.error) console.error("[vyz] visão da cobrança", r.error);

  const actorIds = [...new Set((changes.data ?? []).map((c) => c.actor_id).filter((v): v is string => !!v))];
  const actors = actorIds.length ? ((await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)).data ?? []) : [];
  const actorName = (id: string | null) => {
    const a = actors.find((p) => p.id === id);
    return a ? a.full_name || a.email : null;
  };

  const s = sub.data && checkoutTier(sub.data.plan_id) ? sub.data : null;
  const sTier = s ? (checkoutTier(s.plan_id) as PlanId) : null;
  const sLp = !!s && s.plan_id.startsWith("lp_");
  const items = s
    ? [...s.subscription_items]
        .sort((a, b) => Number(!!a.billing_item_id) - Number(!!b.billing_item_id) || a.created_at.localeCompare(b.created_at))
        .map((i) => ({
          id: i.id,
          kind: i.billing_item_id ? ("extra" as const) : ("plan" as const),
          label: i.billing_item_id ? (billingItem(i.billing_item_id)?.name ?? i.billing_item_id) : sLp ? `Plano ${PLAN_LABEL[sTier!]} · landing pages` : planItemLabel(sTier!, i.quantity),
          quantity: i.quantity,
          monthlyCents: i.amount_cents,
        }))
    : [];
  const monthlyCents = items.reduce((sum, i) => sum + i.monthlyCents, 0);
  const c = customer.data;

  return {
    workspaceId: ws,
    provider: serverEnv().BILLING_PROVIDER,
    canManage: session.role === "owner",
    subscription: s
      ? {
          id: s.id,
          tier: sTier!,
          product: (sLp ? "lp" : "dash") as Product,
          status: s.status,
          interval: s.interval,
          accountsQuantity: s.accounts_quantity,
          currentPeriodStart: s.current_period_start,
          currentPeriodEnd: s.current_period_end,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          createdAt: s.created_at,
          items,
          monthlyCents,
          extrasMonthlyCents: items.filter((i) => i.kind === "extra").reduce((sum, i) => sum + i.monthlyCents, 0),
          recurringCents: monthlyCents * (s.interval === "year" ? 12 : 1),
        }
      : null,
    customer: c ? { email: c.email, legalName: c.legal_name, taxId: maskTaxId(c.tax_id), phone: c.phone } : null,
    invoices: (invoices.data ?? []).map((i) => ({
      id: i.id,
      status: i.status,
      description: i.description,
      totalCents: i.total_cents,
      amountPaidCents: i.amount_paid_cents,
      currency: i.currency,
      lines: invoiceLines(i.lines),
      periodStart: i.period_start,
      periodEnd: i.period_end,
      paidAt: i.paid_at,
      createdAt: i.created_at,
      hostedUrl: i.hosted_invoice_url,
      pdfUrl: i.invoice_pdf_url,
    })),
    transactions: (transactions.data ?? []).map((t) => ({
      id: t.id,
      kind: t.kind as TransactionKind,
      status: t.status as TransactionStatus,
      amountCents: t.amount_cents,
      currency: t.currency,
      method: (t.method as PaymentMethod | null) ?? null,
      cardBrand: (t.card_brand as CardBrand | null) ?? null,
      cardLast4: t.card_last4,
      failureMessage: t.failure_message,
      processedAt: t.processed_at,
      createdAt: t.created_at,
    })),
    timeline: (changes.data ?? []).map((ch) => {
      const change = ch.change as SubscriptionChange;
      return {
        id: ch.id,
        change,
        label: describeSubscriptionChange({ change, fromValue: ch.from_value, toValue: ch.to_value }),
        actorName: actorName(ch.actor_id),
        createdAt: ch.created_at,
      };
    }),
    serviceOrders: (orders.data ?? []).map((o) => ({
      id: o.id,
      itemId: o.billing_item_id,
      label: billingItem(o.billing_item_id)?.name ?? o.billing_item_id,
      quantity: o.quantity,
      status: o.status,
      createdAt: o.created_at,
      deliveredAt: o.delivered_at,
    })),
  };
}

/** Plano do pedido ("pro" ou "lp_pro") → tier exibido. */
function checkoutTier(planId: string | null): PlanId | null {
  const parsed = parsePlanDbId(planId);
  return parsed && parsed.tier !== "personalizado" ? parsed.tier : null;
}
