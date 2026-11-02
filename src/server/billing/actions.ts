"use server";

// Ações da cobrança. No checkout: criar a conta e gravar o pedido
// (startCheckout) e pagar (payCheckout). No painel (página Plano): trocar de
// plano, cancelar e retomar. Cada ação valida a entrada, autoriza pela sessão
// e só então escreve com a chave de serviço (src/server/billing/*).

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { PASSWORD_MESSAGES } from "@/features/auth/password-rules";
import { isExpired } from "@/features/checkout/card";
import { CHECKOUT_MESSAGES } from "@/features/checkout/fields";
import { BLOCK_MESSAGE, buildOrder, normalizeState } from "@/features/checkout/order";
import { checkoutFormSchema, paymentInputSchema, planChangeSchema, type PaymentInput, type PlanChangeInput } from "@/features/checkout/schema";
import { fromQuery } from "@/features/pricing/pricing";
import { ACTIVE_WORKSPACE_COOKIE, WORKSPACE_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { createConfirmedUser, signInWithPasswordServer } from "@/server/auth/accounts";
import { getSessionUser } from "@/server/auth/session";
import { authorize } from "@/server/auth/workspace";
import { logActivity, logAuthEvent, recordLegalAcceptances } from "@/server/history/log";
import { requestContext } from "@/server/http/request";
import { hitRateLimit, type RateRule } from "@/server/security/rate-limit";
import { appError, toActionError, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { createCheckoutSession, payCheckoutSession } from "./checkout";
import { CHECKOUT_CLOSED_MESSAGE, canCheckout } from "@/server/env";
import { getCheckoutViewer } from "./queries";
import { changeSubscriptionPlan, setSubscriptionCancel } from "./subscription";

/** null = o formulário ainda não foi enviado. */
export type CheckoutFormState = ActionResult | null;

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  return fields;
}

async function limit(rule: RateRule, ip: string | null, email?: string | null) {
  if (await hitRateLimit(rule, ip)) return;
  await logAuthEvent({ event: "rate_limited", email: email || null, metadata: { rule } });
  throw appError("rate_limited");
}

/**
 * Passo 1 do /assinar: confere os dados, recalcula o pedido no servidor (a
 * tela nunca manda preço), cria a conta e entra (sem sessão), grava os
 * aceites e o pedido, e segue para o pagamento.
 */
export async function startCheckout(_prev: CheckoutFormState, formData: FormData): Promise<CheckoutFormState> {
  const checkoutId = randomUUID();
  try {
    // campo escondido: só robô preenche
    if (text(formData, "website")) throw appError("validation", "Não foi possível enviar. Recarregue a página e tente de novo.");
    const ctx = await requestContext();
    await limit("checkout_ip", ctx.ip, text(formData, "email"));

    // a seleção vem da LP; sem ela não há o que assinar (nunca cai no plano padrão)
    const selection = fromQuery(new URLSearchParams(text(formData, "plan")));
    if (!selection) throw appError("validation", "Não encontramos o pedido. Monte o plano de novo.");
    const state = normalizeState(selection);
    const order = buildOrder(state);
    if (order.blocked) throw appError(`checkout:${order.blocked}`, BLOCK_MESSAGE[order.blocked]);

    const viewer = await getCheckoutViewer(state.produto);
    if (viewer.subscribed) throw appError("checkout:already_subscribed", "Este workspace já tem uma assinatura ativa. Troque de plano em Plano, no painel.");

    const parsed = checkoutFormSchema({ newAccount: !viewer.user }).safeParse({
      fullName: text(formData, "fullName"),
      email: text(formData, "email"),
      password: text(formData, "password"),
      company: text(formData, "company"),
      phone: text(formData, "phone"),
      taxId: text(formData, "taxId"),
      acceptTerms: text(formData, "acceptTerms") === "on",
      marketing: text(formData, "marketing") === "on",
    });
    if (!parsed.success) throw appError("validation", undefined, fieldErrors(parsed.error.issues));
    const input = parsed.data;
    // pagamento simulado em produção: só os e-mails liberados (antes de criar a conta)
    if (!canCheckout(viewer.user?.email ?? input.email)) throw appError("billing:closed", CHECKOUT_CLOSED_MESSAGE);

    let userId: string;
    let email: string;
    if (viewer.user) {
      userId = viewer.user.id;
      email = viewer.user.email;
    } else {
      await limit("signup_ip", ctx.ip, input.email);
      const created = await createConfirmedUser({ email: input.email, password: input.password, fullName: input.fullName, phone: input.phone });
      if (!created.ok) {
        // o checkout é o lugar onde o produto precisa dizer que a conta existe
        if (created.reason === "email_exists") throw appError("checkout:email_exists", CHECKOUT_MESSAGES.emailExists, { email: CHECKOUT_MESSAGES.emailExists });
        if (created.reason === "weak_password") throw appError("validation", undefined, { password: PASSWORD_MESSAGES.weak });
        if (created.reason === "invalid_email") throw appError("validation", undefined, { email: CHECKOUT_MESSAGES.email });
        throw appError("unknown");
      }
      userId = created.userId;
      email = input.email;
      const signedIn = await signInWithPasswordServer(email, input.password);
      await logAuthEvent({
        event: "signup",
        userId,
        email,
        method: "checkout",
        metadata: { plan: order.planId, interval: order.interval, signed_in: signedIn.ok },
      });
      if (!signedIn.ok) throw appError("auth:required", "Sua conta foi criada. Entre com o e-mail e a senha para continuar.");
    }

    // prova de aceite: grava antes do pedido e não pode se perder
    await recordLegalAcceptances({
      userId,
      email,
      checkoutSessionId: checkoutId,
      documents: [
        { document: "terms", accepted: true },
        { document: "privacy", accepted: true },
        { document: "marketing", accepted: input.marketing },
      ],
    });
    await createCheckoutSession({
      checkoutId,
      state,
      order,
      customer: {
        userId,
        email,
        fullName: input.fullName,
        companyName: input.companyName,
        phone: input.phone,
        taxId: input.taxId,
        workspaceId: viewer.target?.workspaceId ?? null,
      },
    });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(`/assinar/pagamento/${checkoutId}`);
}

/**
 * Passo 2: paga o pedido. Do cartão chegam só bandeira, final e validade (o
 * número fica no navegador). Idempotente: pedido já pago vai direto para a
 * tela de sucesso, sem cobrar de novo.
 */
export async function payCheckout(checkoutId: string, input: PaymentInput): Promise<ActionResult> {
  let id: string;
  try {
    const parsedId = z.uuid().safeParse(checkoutId);
    const card = paymentInputSchema.safeParse(input);
    if (!parsedId.success || !card.success) throw appError("validation", "Confira os dados do cartão.");
    if (isExpired({ month: card.data.expMonth, year: card.data.expYear }, new Date())) {
      throw appError("validation", "Este cartão está vencido.", { expiry: "Este cartão está vencido." });
    }
    id = parsedId.data;

    const user = await getSessionUser();
    if (!user) throw appError("auth:required");
    if (!canCheckout(user.email)) throw appError("billing:closed", CHECKOUT_CLOSED_MESSAGE);
    const ctx = await requestContext();
    await limit("checkout_ip", ctx.ip, user.email);

    // o pedido precisa ser do usuário (RLS) antes de qualquer escrita
    const supabase = await createServerSupabase();
    const own = await supabase.from("checkout_sessions").select("id").eq("id", id).maybeSingle();
    if (!own.data) throw appError("checkout:not_found");

    const { brand, last4, expMonth, expYear } = card.data;
    const paid = await payCheckoutSession({ checkoutId: id, userId: user.id, card: { brand, last4, expMonth, expYear } });

    // abre o workspace pago, como na troca de workspace
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, paid.workspaceId, WORKSPACE_COOKIE_OPTIONS);
    if (!paid.alreadyCompleted) {
      const profile = await supabase.from("profiles").update({ default_workspace_id: paid.workspaceId }).eq("id", user.id);
      if (profile.error) console.error("[vyz] workspace padrão", profile.error);
      await logActivity({
        workspaceId: paid.workspaceId,
        actorId: user.id,
        event: "billing.checkout_completed",
        entityType: "checkout_session",
        entityId: id,
        metadata: { plan: paid.planId, amount_cents: paid.amountCents, method: "card", card_brand: brand },
      });
    }
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(`/assinar/concluido/${id}`);
}

/** Troca plano, período ou contas (dono). Cobra a diferença proporcional; menos vira crédito. */
export async function changePlan(input: PlanChangeInput): Promise<ActionResult<{ chargedCents: number; creditCents: number }>> {
  try {
    const parsed = planChangeSchema.safeParse(input);
    if (!parsed.success) throw appError("validation", "Confira o plano, o período e as contas.");
    const session = await authorize("owner");
    const result = await changeSubscriptionPlan({ workspaceId: session.workspace.id, actorId: session.user.id, next: parsed.data });
    const chargedCents = result.quote?.prorationCents ?? 0;
    const creditCents = result.quote?.creditCents ?? 0;
    if (result.changed) {
      await logActivity({
        workspaceId: session.workspace.id,
        actorId: session.user.id,
        event: "billing.plan_changed",
        entityType: "subscription",
        entityId: result.subscriptionId,
        metadata: { from: result.from, to: parsed.data, charged_cents: chargedCents, credit_cents: creditCents, invoice_id: result.invoiceId },
      });
      refresh();
    }
    return { ok: true, data: { chargedCents, creditCents } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

async function setCancel(cancel: boolean): Promise<ActionResult<{ periodEnd: string }>> {
  try {
    const session = await authorize("owner");
    const result = await setSubscriptionCancel({ workspaceId: session.workspace.id, actorId: session.user.id, cancel });
    if (result.changed) {
      await logActivity({
        workspaceId: session.workspace.id,
        actorId: session.user.id,
        event: cancel ? "billing.cancel_scheduled" : "billing.cancel_reverted",
        entityType: "subscription",
        entityId: result.subscriptionId,
        metadata: { period_end: result.periodEnd },
      });
      refresh();
    }
    return { ok: true, data: { periodEnd: result.periodEnd } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Cancela no fim do período pago (dono). O acesso continua até lá. */
export async function cancelSubscription(): Promise<ActionResult<{ periodEnd: string }>> {
  return setCancel(true);
}

/** Desfaz o cancelamento agendado (dono). */
export async function resumeSubscription(): Promise<ActionResult<{ periodEnd: string }>> {
  return setCancel(false);
}
