import { describe, expect, it } from "vitest";
import { buildOrder, normalizeState } from "./order";
import { stripeLineItems, OrderMismatch } from "./stripe-lines";

/** O pedido como fica gravado (checkout_sessions + checkout_items). */
function rows(state: Parameters<typeof normalizeState>[0]) {
  const order = buildOrder(normalizeState(state));
  return {
    order,
    row: {
      interval: order.interval,
      amount_due_now_cents: order.amountDueNowCents,
      recurring_cents: order.recurringCents,
      checkout_items: order.items.map((i, position) => ({ kind: i.kind, plan_price_id: i.planPriceId ?? null, amount_cents: i.amountCents, label: i.label, position })),
    },
  };
}

describe("stripeLineItems", () => {
  for (const plano of ["base", "pro", "avancado"] as const)
    for (const periodo of ["mensal", "anual"] as const) {
      {
        it(`${plano} ${periodo}: linhas somam o pedido`, () => {
          const { order, row } = rows({ plano, periodo });
          const lines = stripeLineItems(row);
          const total = lines.reduce((n, l) => n + l.price_data.unit_amount, 0);
          expect(total).toBe(order.amountDueNowCents);
          // o plano vai marcado e recorre no período escolhido
          const plan = lines.find((l) => l.price_data.product_data.metadata.kind === "plan")!;
          expect(plan.price_data.recurring?.interval).toBe(periodo === "anual" ? "year" : "month");
        });
      }
    }

  it("Básico com sob medida mensal e dashboard adicional: linhas somam o pedido", () => {
    const { order, row } = rows({ plano: "base", periodo: "mensal", sob: 1, sobm: "recorrente", dash: 1 });
    const lines = stripeLineItems(row);
    expect(lines.length).toBe(order.items.filter((i) => i.amountCents > 0).length);
    expect(lines.reduce((n, l) => n + l.price_data.unit_amount, 0)).toBe(order.amountDueNowCents);
  });

  it("recusa itens que não batem com o total", () => {
    const { row } = rows({ plano: "pro", periodo: "mensal" });
    expect(() => stripeLineItems({ ...row, amount_due_now_cents: row.amount_due_now_cents + 1 })).toThrow(OrderMismatch);
  });
});
