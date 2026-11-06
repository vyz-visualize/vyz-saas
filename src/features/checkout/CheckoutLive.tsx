"use client";

// Checkout com o pedido vivo: período, projetos e plataforma extra mudam na
// hora no navegador (o cupom recalcula com as mesmas funções do servidor) e a
// URL acompanha sem recarregar. Ao enviar, o servidor recalcula tudo de novo.

import { useEffect, useState, type ReactNode } from "react";
import { normalizeState, buildOrder } from "@/features/checkout/order";
import { toQuery, type PlanState } from "@/features/pricing/pricing";
import { CheckoutForm } from "./CheckoutForm";
import { OrderSummary } from "./OrderSummary";

type CheckoutLiveProps = {
  initial: PlanState;
  /** Título e aviso da conta (do servidor). */
  heading: ReactNode;
  account: { email: string; fullName: string; phone: string | null } | null;
  workspaceName: string | null;
  simulated: boolean;
};

export function CheckoutLive({ initial, heading, account, workspaceName, simulated }: CheckoutLiveProps) {
  const [state, setState] = useState(initial);
  const order = buildOrder(state);
  const query = toQuery(state);

  // cliques seguidos somam (cada um parte do estado anterior); a URL acompanha sem recarregar
  function adjust(patch: (current: PlanState) => Partial<PlanState>) {
    setState((prev) => normalizeState({ ...prev, ...patch(prev) }));
  }
  useEffect(() => {
    window.history.replaceState(null, "", `/assinar?${query}`);
  }, [query]);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
      <section aria-labelledby="assinar-titulo" className="min-w-0">
        {heading}
        <div className="mt-8">
          <CheckoutForm planQuery={query} account={account} workspaceName={workspaceName} signInHref={`/entrar?next=${encodeURIComponent(`/assinar?${query}`)}`} />
        </div>
      </section>

      <aside aria-label="Resumo do pedido" className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
        <OrderSummary
          state={state}
          quote={order.quote}
          amountDueNowCents={order.amountDueNowCents}
          recurringCents={order.recurringCents}
          editHref={`/?${query}#planos`}
          simulated={simulated}
          onAdjust={adjust}
        />
      </aside>
    </div>
  );
}
