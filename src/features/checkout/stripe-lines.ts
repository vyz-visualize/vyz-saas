// Linhas do Checkout da Stripe a partir dos itens gravados do pedido: as
// recorrentes cobram por período (o valor do item é por mês; no anual, × 12)
// e as únicas entram só na primeira fatura. No anual, a linha do plano leva o
// total exato do ano (o item guarda o por mês arredondado: R$ 41,66 × 12 ≠
// R$ 499,90). Puro (testável). Confere com os totais do pedido: fora o
// arredondamento do plano anual (menos de 1 centavo por mês), nada passa.

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
  const recurringItems = items.filter((i) => i.kind === "recurring");
  // amount_cents é o valor da linha (já com a quantidade), por mês nas recorrentes
  const byMonths = recurringItems.reduce((n, i) => n + i.amount_cents * months, 0);
  // o arredondamento do plano anual: no máximo 11 centavos no ano; no mensal, zero
  const rounding = c.recurring_cents - byMonths;
  if (Math.abs(rounding) >= months || (rounding !== 0 && !recurringItems.some((i) => i.plan_price_id))) {
    throw new OrderMismatch(`Itens (${byMonths}) diferentes do pedido (${c.recurring_cents}).`);
  }
  const unit = (i: CheckoutItemRow) => (i.kind !== "recurring" ? i.amount_cents : i.amount_cents * months + (i.plan_price_id ? rounding : 0));
  const recurring = recurringItems.reduce((n, i) => n + unit(i), 0);
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
