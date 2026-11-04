import "server-only";

// Assinatura viva do workspace: troca de plano, contas ou período (com o
// ajuste proporcional) e cancelamento no fim do período. As Server Actions
// chamam daqui depois de authorize("owner"). Escreve com a chave de serviço
// (cobrança não tem política de escrita para usuários). A troca grava tudo de
// uma vez pela change_subscription; a auditoria e a linha do tempo
// (subscription_changes) vêm dos gatilhos do banco.

import { randomUUID } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { planItemLabel } from "@/features/checkout/order";
import { planChangeBlocker, quotePlanChange, samePlan, type PlanChangeQuote, type PlanSelection } from "@/features/checkout/plan-change";
import { INTERVAL } from "@/features/pricing/catalog";
import { PERIOD_LABEL, type PlanId } from "@/features/pricing/pricing";
import { appError, fromPostgrest, unwrap } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { billingAdmin } from "./checkout";
import { getBillingProvider } from "./provider";

const isPlanId = (v: string): v is PlanId => v === "base" || v === "pro" || v === "avancado";

async function loadLiveSubscription(db: DB, workspaceId: string) {
  return unwrap(
    await db
      .from("subscriptions")
      .select(
        "id, plan_id, status, interval, accounts_quantity, provider_subscription_id, current_period_start, current_period_end, cancel_at_period_end, subscription_items(id, plan_price_id, billing_item_id, amount_cents)",
      )
      .eq("workspace_id", workspaceId)
      .not("status", "in", "(canceled,incomplete_expired)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

/** O que já está em uso cabe no plano novo? (contas ativas, dashboards, LPs publicadas, plataformas) */
async function assertUsageFits(db: DB, workspaceId: string, next: PlanSelection) {
  const [usage, enabled, members, invites] = await Promise.all([
    db.from("workspace_usage").select("dashboards, published_landing_pages, projects").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("ad_accounts").select("platform_id").eq("workspace_id", workspaceId).eq("is_enabled", true),
    db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    db
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  const u = unwrap(usage);
  const blocker = planChangeBlocker(next, {
    projects: u?.projects ?? 0,
    dashboards: u?.dashboards ?? 0,
    publishedLandingPages: u?.published_landing_pages ?? 0,
    enabledPlatforms: (unwrap(enabled) ?? []).map((a) => a.platform_id),
    members: (members.count ?? 0) + (invites.count ?? 0),
  });
  if (blocker) throw appError(blocker.code, blocker.message);
}

// o que fazer quando o uso não cabe (o hint do banco diz só o número)
const IN_USE_ADVICE: Record<string, string> = {
  "limit:accounts_in_use": "Desative contas em Contas antes de trocar.",
  "limit:projects_in_use": "Arquive projetos em Projetos antes de trocar.",
  "limit:dashboards_in_use": "Apague alguns dashboards antes de trocar.",
  "limit:landing_pages_in_use": "Despublique algumas landing pages antes de trocar.",
  "limit:members_in_use": "Remova pessoas ou cancele convites em Equipe antes de trocar.",
};

/** Erro da change_subscription no formato da tela. */
function changeError(error: PostgrestError) {
  const err = fromPostgrest(error);
  if (err.code in IN_USE_ADVICE) return appError(err.code, `${err.message} ${IN_USE_ADVICE[err.code]}`);
  if (err.code === "checkout:invalid_order") {
    // preço do código diferente do catálogo do banco: falta rodar npm run db:catalog
    console.error("[vyz] troca de plano: preço fora do catálogo", error.hint);
    return appError(err.code, "Não conseguimos calcular o novo valor do plano. Recarregue a página e tente de novo.");
  }
  return err;
}

export type PlanChangeResult = { changed: boolean; subscriptionId: string; from: PlanSelection; quote: PlanChangeQuote | null; invoiceId: string | null };

/**
 * Troca plano, período ou contas da assinatura viva. Cobra a diferença
 * proporcional (fatura paga + transação no cartão salvo); troca para menos
 * vira crédito, sem cobrança.
 */
export async function changeSubscriptionPlan(input: { workspaceId: string; actorId: string; next: PlanSelection; now?: Date }): Promise<PlanChangeResult> {
  const now = input.now ?? new Date();
  const db = await billingAdmin(input.actorId);
  const sub = await loadLiveSubscription(db, input.workspaceId);
  if (!sub || !isPlanId(sub.plan_id)) throw appError("plan:inactive");

  const from: PlanSelection = { tier: sub.plan_id, period: sub.interval === "year" ? "anual" : "mensal", accounts: sub.accounts_quantity };
  if (samePlan(from, input.next)) return { changed: false, subscriptionId: sub.id, from, quote: null, invoiceId: null };
  await assertUsageFits(db, input.workspaceId, input.next);

  const extrasMonthlyCents = sub.subscription_items.filter((i) => i.billing_item_id).reduce((sum, i) => sum + i.amount_cents, 0);
  const quote = quotePlanChange({
    current: { ...from, periodStart: new Date(sub.current_period_start), periodEnd: new Date(sub.current_period_end) },
    next: input.next,
    extrasMonthlyCents,
    now,
  });

  const [customer, lastCard] = await Promise.all([
    db.from("billing_customers").select("provider_customer_id").eq("workspace_id", input.workspaceId).maybeSingle(),
    db
      .from("payment_transactions")
      .select("card_brand, card_last4")
      .eq("workspace_id", input.workspaceId)
      .eq("status", "succeeded")
      .not("card_last4", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const provider = getBillingProvider();
  const charge = await provider.updateSubscription({
    changeId: randomUUID(),
    subscriptionId: sub.provider_subscription_id,
    customerId: unwrap(customer)?.provider_customer_id ?? null,
    prorationCents: quote.prorationCents,
    currency: "BRL",
  });

  // assinatura, item do plano, fatura e transação numa transação só; o banco
  // confere de novo o preço e o uso (outra aba pode ter ativado uma conta)
  const next = input.next;
  const card = unwrap(lastCard);
  const label = `Ajuste proporcional: ${planItemLabel(from.tier, from.accounts)} (${PERIOD_LABEL[from.period]}) → ${planItemLabel(next.tier, next.accounts)} (${PERIOD_LABEL[next.period]})`;
  const { data: invoiceId, error } = await db.rpc("change_subscription", {
    p_subscription_id: sub.id,
    p_plan_id: next.tier,
    p_interval: INTERVAL[next.period],
    p_accounts: next.accounts,
    p_plan_amount_cents: quote.planMonthlyCents,
    ...(quote.resetsPeriod ? { p_period_start: quote.periodStart.toISOString(), p_period_end: quote.periodEnd.toISOString() } : {}),
    ...(quote.prorationCents > 0
      ? {
          p_invoice: { provider_invoice_id: charge.invoiceId, description: "Troca de plano", label, amount_cents: quote.prorationCents },
          p_payment: {
            provider_payment_id: charge.paymentId,
            method: card ? "card" : null,
            card_brand: card?.card_brand ?? null,
            card_last4: card?.card_last4 ?? null,
          },
        }
      : {}),
  });
  if (error) throw changeError(error);
  return { changed: true, subscriptionId: sub.id, from, quote, invoiceId: invoiceId ?? null };
}

/** Cancela no fim do período (cancel = true) ou desfaz. */
export async function setSubscriptionCancel(input: {
  workspaceId: string;
  actorId: string;
  cancel: boolean;
}): Promise<{ changed: boolean; subscriptionId: string; periodEnd: string }> {
  const db = await billingAdmin(input.actorId);
  const sub = await loadLiveSubscription(db, input.workspaceId);
  if (!sub) throw appError("plan:inactive");
  const result = { subscriptionId: sub.id, periodEnd: sub.current_period_end };
  if (sub.cancel_at_period_end === input.cancel) return { changed: false, ...result };
  await getBillingProvider().setCancelAtPeriodEnd({ subscriptionId: sub.provider_subscription_id, cancel: input.cancel });
  unwrap(await db.from("subscriptions").update({ cancel_at_period_end: input.cancel }).eq("id", sub.id));
  return { changed: true, ...result };
}
