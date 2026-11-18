// Anual com total exato (supabase/migrations/20261122090000_annual_exact_total.sql) num Postgres em
// memória com as migrações reais: o item do plano guarda o por mês arredondado (R$ 124,99), a
// cobrança é o total do ano (R$ 1.499,90). fulfill_checkout aceita só esse arredondamento
// (menos de 12 centavos no ano) e a fatura mostra o total exato na linha do plano.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { buildOrder, normalizeState } from "@/features/checkout/order";
import { createUser, freshDb, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let ins: ReturnType<typeof seeder>;
let n = 0;

/** Um checkout aberto com os itens do pedido, como o servidor grava (pode forçar os totais). */
async function checkout(state: Parameters<typeof normalizeState>[0], force: { recurring?: number; due?: number } = {}) {
  const order = buildOrder(normalizeState(state));
  const user = await createUser(db, `cliente${++n}@exemplo.com`);
  const c = await ins("checkout_sessions", {
    provider: "stripe",
    user_id: user,
    email: `cliente${n}@exemplo.com`,
    full_name: "Cliente Teste",
    company_name: `Empresa ${n}`,
    plan_id: order.planId,
    interval: order.interval,
    accounts_quantity: order.accountsQuantity,
    selection: {},
    quote: {},
    amount_due_now_cents: force.due ?? order.amountDueNowCents,
    recurring_cents: force.recurring ?? order.recurringCents,
  });
  for (const [position, i] of order.items.entries()) {
    await ins("checkout_items", { checkout_session_id: c.id, kind: i.kind, plan_price_id: i.planPriceId ?? null, billing_item_id: i.billingItemId ?? null, quantity: i.quantity, amount_cents: i.amountCents, label: i.label, position });
  }
  return { id: c.id as string, order };
}

const fulfill = (id: string) => db.query<{ ws: string }>(`select public.fulfill_checkout($1, $2) as ws`, [id, `cus_${id.slice(0, 8)}`]);

beforeAll(async () => {
  db = await freshDb();
  ins = seeder(db);
  await seedCatalog(db, ins);
  // o catálogo do plano como o sync-catalog grava: o por mês (no anual, arredondado)
  await ins("plan_prices", { id: "pro_month", plan_id: "pro", interval: "month", first_account_cents: 14990, extra_account_cents: 0 });
  await ins("plan_prices", { id: "pro_year", plan_id: "pro", interval: "year", first_account_cents: 12499, extra_account_cents: 0 });
}, 120_000);

describe("anual com total exato", () => {
  it("o pedido anual fecha com o total do ano (R$ 1.499,90) e a fatura mostra esse total na linha do plano", async () => {
    const { id, order } = await checkout({ plano: "pro", periodo: "anual" });
    expect(order.recurringCents).toBe(149990);
    const [{ ws }] = (await fulfill(id)).rows;
    expect(ws).toBeTruthy();
    const inv = (await db.query<{ total_cents: number; lines: { amount_cents: number; plan_price_id: string | null }[] }>(`select total_cents, lines from public.invoices where checkout_session_id = $1`, [id])).rows[0];
    expect(Number(inv.total_cents)).toBe(149990);
    expect(inv.lines.find((l) => l.plan_price_id)?.amount_cents).toBe(149990);
    const item = (await db.query<{ amount_cents: number }>(`select amount_cents from public.subscription_items where workspace_id = $1`, [ws])).rows[0];
    expect(Number(item.amount_cents)).toBe(12499); // o item continua por mês
  });

  it("recusa diferença de 12 centavos ou mais no anual", async () => {
    const { id, order } = await checkout({ plano: "pro", periodo: "anual" }, { recurring: 149990 + 12, due: 149990 + 12 });
    expect(order.items[0].amountCents * 12).toBe(149988);
    await expect(fulfill(id)).rejects.toThrow(/checkout:invalid_order/);
  });

  it("no mensal, nem um centavo de diferença passa", async () => {
    const { id } = await checkout({ plano: "pro", periodo: "mensal" }, { recurring: 14991, due: 14991 });
    await expect(fulfill(id)).rejects.toThrow(/checkout:invalid_order/);
    const ok = await checkout({ plano: "pro", periodo: "mensal" });
    expect((await fulfill(ok.id)).rows[0].ws).toBeTruthy();
  });

  it("o total cobrado agora tem de ser o recorrente + os itens únicos", async () => {
    const { id } = await checkout({ plano: "pro", periodo: "anual" }, { due: 149990 + 1 });
    await expect(fulfill(id)).rejects.toThrow(/checkout:invalid_order/);
  });
});
