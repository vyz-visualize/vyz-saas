import "server-only";

// Checkout simulado com a cobrança real ligada (CHECKOUT_SIMULATED_EMAILS): a equipe assina
// numa "organização de teste" que nunca chama a Stripe. A assinatura dela é do provedor mock
// e leva metadata.teste = true; é isso que a tira de receita, relatórios de admin e métricas,
// e é só ela que o "Recomeçar teste" apaga.
//
// Por que exigir Google ou Apple: o checkout cria conta já confirmada, sem verificar o e-mail.
// Sem essa trava, qualquer um poderia criar a conta de um e-mail da lista e assinar sem pagar.

import { cache } from "react";
import { isSimulatedCheckoutEmail, serverEnv } from "@/server/env";
import { createAdminSupabase } from "@/server/supabase/admin";
import type { DB } from "@/server/supabase/server";

/** Chave no metadata da assinatura que marca a organização de teste. */
export const TEST_MARK = "teste";

const PROVEN = ["google", "apple"];

/** A assinatura é de uma organização de teste? */
export const isTestSubscription = (metadata: unknown): boolean => !!metadata && typeof metadata === "object" && (metadata as Record<string, unknown>)[TEST_MARK] === true;

/** Só com a Stripe ligada existe "simulado à parte"; com tudo simulado, vale a regra antiga. */
const liveBilling = () => serverEnv().BILLING_PROVIDER !== "mock";

/**
 * Este usuário assina pelo checkout simulado? E-mail na lista, cobrança real ligada e conta que
 * já entrou com Google ou Apple (o provedor provou que o e-mail é dela).
 */
export const isSimulatedCheckoutUser = cache(async (user: { id: string; email: string | null } | null): Promise<boolean> => {
  if (!user || !liveBilling() || !isSimulatedCheckoutEmail(user.email)) return false;
  const { data, error } = await createAdminSupabase().auth.admin.getUserById(user.id);
  if (error || !data.user) return false;
  const providers = (data.user.app_metadata?.providers as string[] | undefined) ?? [data.user.app_metadata?.provider as string];
  return providers.some((p) => PROVEN.includes(p));
});

/** Organizações (de que a pessoa é dona) com assinatura de teste viva. */
export async function testWorkspaceIds(db: DB, userId: string): Promise<string[]> {
  const owned = (await db.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("role", "owner")).data ?? [];
  if (!owned.length) return [];
  const subs =
    (
      await db
        .from("subscriptions")
        .select("workspace_id, metadata")
        .in(
          "workspace_id",
          owned.map((m) => m.workspace_id),
        )
        .eq("provider", "mock")
        .in("status", ["active", "trialing", "past_due"])
    ).data ?? [];
  return subs.filter((s) => isTestSubscription(s.metadata)).map((s) => s.workspace_id);
}

/** Marca a assinatura viva do workspace como de teste (depois de concluir o checkout simulado). */
export async function markTestSubscription(db: DB, workspaceId: string): Promise<void> {
  const { data } = await db.from("subscriptions").select("id, metadata").eq("workspace_id", workspaceId).eq("provider", "mock").in("status", ["active", "trialing", "past_due"]);
  for (const s of data ?? []) {
    const metadata = { ...((s.metadata as Record<string, unknown>) ?? {}), [TEST_MARK]: true };
    const { error } = await db.from("subscriptions").update({ metadata: metadata as never }).eq("id", s.id);
    if (error) console.error("[vyz] marcar organização de teste", error);
  }
}

/** O workspace aberto é uma organização de teste? (Selo "Pagamento simulado" no painel.) */
export async function isTestWorkspace(db: DB, workspaceId: string): Promise<boolean> {
  const { data } = await db.from("subscriptions").select("metadata").eq("workspace_id", workspaceId).eq("provider", "mock").in("status", ["active", "trialing", "past_due"]);
  return (data ?? []).some((s) => isTestSubscription(s.metadata));
}
