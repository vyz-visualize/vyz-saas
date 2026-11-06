// Linhas do Checkout da Stripe a partir dos itens gravados do pedido: as
// recorrentes cobram por período (o valor do item é por mês; no anual, × 12)
// e as únicas entram só na primeira fatura. Puro (testável). Confere com os
// totais do pedido: diferença de um centavo não passa.

export type CheckoutItemRow = { kind: "recurring" | "one_time"; plan_price_id: string | null; amount_cents: number; label: string; position: number };

export type StripeLine = {
  quantity: 1;
  price_data: {
    currency: "brl";
    unit_amount: number;
    product_data: { name: string; metadata: { kind: "plan" | "extra" } };
    recurring?: { interval: "month" | "year" };
  };
};

export class OrderMismatch extends Error {}

export function stripeLineItems(c: { interval: "month" | "year"; amount_due_now_cents: number; recurring_cents: number; checkout_items: CheckoutItemRow[] }): StripeLine[] {
  const months = c.interval === "year" ? 12 : 1;
  const items = [...c.checkout_items].sort((a, b) => a.position - b.position).filter((i) => i.amount_cents > 0);
  // amount_cents é o valor da linha (já com a quantidade), por mês nas recorrentes
  const unit = (i: CheckoutItemRow) => (i.kind === "recurring" ? i.amount_cents * months : i.amount_cents);
  const recurring = items.filter((i) => i.kind === "recurring").reduce((n, i) => n + unit(i), 0);
  const total = items.reduce((n, i) => n + unit(i), 0);
  if (recurring !== c.recurring_cents || total !== c.amount_due_now_cents) {
    throw new OrderMismatch(`Itens (${total}/${recurring}) diferentes do pedido (${c.amount_due_now_cents}/${c.recurring_cents}).`);
  }
  return items.map((i) => ({
    quantity: 1,
    price_data: {
      currency: "brl",
      unit_amount: unit(i),
      // o produto do plano é marcado: a troca de plano muda só esse item
      product_data: { name: i.label, metadata: { kind: i.plan_price_id ? "plan" : "extra" } },
      ...(i.kind === "recurring" ? { recurring: { interval: c.interval } } : {}),
    },
  }));
}
