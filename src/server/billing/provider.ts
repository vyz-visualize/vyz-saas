import "server-only";

// Provedor de cobrança atrás de uma interface: o simulado (mock) ou a Stripe. Quem chama não sabe qual está ligado (BILLING_PROVIDER).

import type { CardSummary } from "@/features/checkout/card";
import { serverEnv } from "@/server/env";
import { mockBillingProvider } from "./mock";
import { stripeBillingProvider } from "./stripe";

export type BillingProviderId = "mock" | "stripe";

export type ChargeFailureCode = "card_declined" | "insufficient_funds" | "expired_card" | "processing_error";

export type ChargeResult =
  | { ok: true; paymentId: string; invoiceId: string; customerId: string; subscriptionId: string | null }
  | { ok: false; paymentId: string; code: ChargeFailureCode; message: string };

export interface BillingProvider {
  readonly id: BillingProviderId;

  /** Abre o pedido no provedor (Stripe: Checkout Session ou PaymentIntent). */
  openCheckout(input: { checkoutId: string; email: string; amountCents: number; currency: string }): Promise<{ providerSessionId: string | null }>;

  /**
   * Cobra a primeira fatura do checkout e cria a assinatura, se houver plano.
   * Idempotente pelo checkout: confirmar de novo devolve os mesmos ids.
   */
  confirmPayment(input: {
    checkoutId: string;
    amountCents: number;
    currency: string;
    customer: { email: string; name: string; existingId: string | null };
    subscription: { interval: "month" | "year" } | null;
    card: CardSummary;
  }): Promise<ChargeResult>;

  /** Troca de plano: atualiza a assinatura e cobra a diferença proporcional no cartão salvo. */
  updateSubscription(input: {
    changeId: string;
    subscriptionId: string | null;
    customerId: string | null;
    prorationCents: number;
    currency: string;
    /** O plano novo: valor por período (mês ou ano) e o intervalo. A Stripe troca o preço e cobra a diferença. */
    next?: { planId: string; accounts: number; amountCents: number; interval: "month" | "year" };
  }): Promise<{ invoiceId: string | null; paymentId: string | null }>;

  /** Cancela no fim do período (ou desfaz o cancelamento). */
  setCancelAtPeriodEnd(input: { subscriptionId: string | null; cancel: boolean }): Promise<void>;
}

export function getBillingProvider(): BillingProvider {
  return serverEnv().BILLING_PROVIDER === "stripe" ? stripeBillingProvider : mockBillingProvider;
}
