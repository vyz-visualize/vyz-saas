// Aviso da assinatura na faixa do topo do painel: pagamento em atraso,
// cancelamento agendado ou assinatura inativa. Puro (testado).

import { formatDate } from "@/features/checkout/labels";
import type { WorkspaceAccess } from "./session";

export type SubscriptionNotice = { tone: "warn" | "error" | "info"; text: string; action: { label: string; href: string } };

export function subscriptionNotice(access: Pick<WorkspaceAccess, "hasAccess" | "status" | "cancelAtPeriodEnd" | "currentPeriodEnd">): SubscriptionNotice | null {
  if (!access.hasAccess) {
    return {
      tone: "error",
      text: access.status ? "A assinatura desta organização não está ativa. Os dados continuam guardados." : "Esta organização ainda não tem um plano.",
      action: { label: "Ver plano", href: "/painel/plano" },
    };
  }
  if (access.status === "past_due" || access.status === "unpaid") {
    return {
      tone: "warn",
      text: "O último pagamento não passou. Atualize a forma de pagamento para não perder o acesso.",
      action: { label: "Resolver", href: "/painel/plano" },
    };
  }
  if (access.cancelAtPeriodEnd) {
    const end = access.currentPeriodEnd ? formatDate(access.currentPeriodEnd) : null;
    return {
      tone: "info",
      text: end ? `A assinatura foi cancelada e termina em ${end}.` : "A assinatura foi cancelada e termina no fim do período.",
      action: { label: "Retomar", href: "/painel/plano" },
    };
  }
  return null;
}
