// Rótulos em português da cobrança (checkout e página Plano): estados da
// assinatura, faturas, transações e pedidos de serviço, e a linha do tempo.

import { TIER_LABEL, TIERS, type Tier } from "@/features/pricing/entitlements";
import type { SubscriptionStatus } from "@/features/workspace/session";

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export type TransactionStatus = "pending" | "succeeded" | "failed" | "canceled";
export type TransactionKind = "charge" | "refund" | "chargeback";
export type PaymentMethod = "card" | "pix" | "boleto";
export type ServiceOrderStatus = "pending" | "in_progress" | "delivered" | "canceled";
export type SubscriptionChange =
  "created" | "plan_changed" | "quantity_changed" | "interval_changed" | "status_changed" | "cancel_scheduled" | "cancel_reverted" | "renewed";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  unpaid: "Não paga",
  paused: "Pausada",
  incomplete: "Aguardando pagamento",
  incomplete_expired: "Expirada",
  canceled: "Cancelada",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  open: "Em aberto",
  paid: "Paga",
  void: "Anulada",
  uncollectible: "Não cobrável",
};

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  pending: "Processando",
  succeeded: "Aprovada",
  failed: "Recusada",
  canceled: "Cancelada",
};

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = { charge: "Cobrança", refund: "Estorno", chargeback: "Contestação" };

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { card: "Cartão de crédito", pix: "PIX", boleto: "Boleto" };

export const SERVICE_ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  pending: "Na fila",
  in_progress: "Em produção",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export const INTERVAL_LABEL: Record<"month" | "year", string> = { month: "mensal", year: "anual" };

const isTier = (v: string | null): v is Tier => !!v && (TIERS as string[]).includes(v);
const tier = (v: string | null) => {
  if (isTier(v)) return TIER_LABEL[v];
  // planos de landing pages: "lp_pro" → "Padrão (landing pages)"
  if (v?.startsWith("lp_") && isTier(v.slice(3))) return `${TIER_LABEL[v.slice(3) as Tier]} (landing pages)`;
  return v ?? "—";
};
const interval = (v: string | null) => (v === "month" || v === "year" ? INTERVAL_LABEL[v] : (v ?? "—"));
const status = (v: string | null) => (v && v in SUBSCRIPTION_STATUS_LABEL ? SUBSCRIPTION_STATUS_LABEL[v as SubscriptionStatus] : (v ?? "—"));
const accounts = (v: string | null) => `${v ?? "?"} ${v === "1" ? "conta" : "contas"}`;

/** Data e hora do Postgres ou ISO → "29/10/2026" (horário de Brasília). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Uma linha da linha do tempo da assinatura (subscription_changes). */
export function describeSubscriptionChange(c: { change: SubscriptionChange; fromValue: string | null; toValue: string | null }): string {
  switch (c.change) {
    case "created": {
      // "pro · year · 2 conta(s)"
      const m = /^(\w+) · (\w+) · (\d+)/.exec(c.toValue ?? "");
      return m ? `Assinatura criada: ${tier(m[1])}, ${interval(m[2])}, ${accounts(m[3])}` : "Assinatura criada";
    }
    case "plan_changed":
      return `Plano: ${tier(c.fromValue)} → ${tier(c.toValue)}`;
    case "quantity_changed":
      return `Contas contratadas: ${c.fromValue ?? "?"} → ${c.toValue ?? "?"}`;
    case "interval_changed":
      return `Período: ${interval(c.fromValue)} → ${interval(c.toValue)}`;
    case "status_changed":
      return `Situação: ${status(c.fromValue)} → ${status(c.toValue)}`;
    case "cancel_scheduled":
      return `Cancelamento agendado para ${formatDate(c.toValue)}`;
    case "cancel_reverted":
      return "Cancelamento desfeito";
    case "renewed":
      return `Renovada até ${formatDate(c.toValue)}`;
  }
}

/** Descrição da fatura gravada pelo banco ("Assinatura lp_pro") no texto da tela. */
export function invoiceDescription(text: string | null): string | null {
  const m = text?.match(/^Assinatura (\S+)$/);
  return m ? `Assinatura ${tier(m[1])}` : text;
}
