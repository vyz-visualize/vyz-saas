// Cria (ou apaga) uma conta de teste completa: usuário confirmado, checkout
// pago no modo simulado, workspace com assinatura ativa e, se pedido, o
// onboarding concluído. Usa a chave de serviço; só para desenvolvimento.
//
//   npx tsx scripts/dev/create-test-account.ts --email teste@vyz.dev --password Teste12345 \
//     [--plan base|pro|avancado] [--period mensal|anual] [--accounts 2] [--company "Loja Teste"] \
//     [--onboarding pending|done] [--product dash|lp]
//   npx tsx scripts/dev/create-test-account.ts --delete --email teste@vyz.dev

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { buildOrder, normalizeState } from "@/features/checkout/order";
import { type Period, type PlanId } from "@/features/pricing/pricing";
import type { Database } from "@/lib/supabase/database.types";

process.loadEnvFile?.(".env.local");

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string", default: "Teste12345" },
    plan: { type: "string", default: "pro" },
    product: { type: "string", default: "dash" },
    period: { type: "string", default: "anual" },
    accounts: { type: "string", default: "2" },
    company: { type: "string", default: "Loja Teste" },
    name: { type: "string", default: "Pessoa Teste" },
    onboarding: { type: "string", default: "pending" },
    delete: { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email) throw new Error("--email é obrigatório");

const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUser(): Promise<string | null> {
  const { data } = await admin.from("profiles").select("id").ilike("email", email!).maybeSingle();
  return data?.id ?? null;
}

async function remove() {
  const userId = await findUser();
  if (!userId) return console.log("Nada a apagar.");
  const { data: owned } = await admin.from("workspaces").select("id").eq("created_by", userId);
  for (const w of owned ?? []) {
    // registros financeiros seguram o workspace (on delete restrict): só em teste se apagam antes
    await admin.from("payment_transactions").delete().eq("workspace_id", w.id);
    await admin.from("invoices").delete().eq("workspace_id", w.id);
    const { error } = await admin.from("workspaces").delete().eq("id", w.id);
    if (error) throw error;
  }
  await admin.from("checkout_sessions").delete().eq("user_id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  console.log(`Apagado: ${email} (${owned?.length ?? 0} workspace(s)).`);
}

async function create() {
  const plan = values.plan as PlanId;
  const period = values.period as Period;
  if (!["base", "pro", "avancado"].includes(plan)) throw new Error("--plan inválido");
  if (!["mensal", "anual"].includes(period)) throw new Error("--period inválido");

  let userId = await findUser();
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: email!,
      password: values.password!,
      email_confirm: true,
      user_metadata: { full_name: values.name },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const product = values.product === "lp" ? "lp" : "dash";
  const state = normalizeState({ produto: product, plano: plan, periodo: period, nicho: "ecommerce" });
  const order = buildOrder(state);

  const { data: checkout, error: cErr } = await admin
    .from("checkout_sessions")
    .insert({
      provider: "mock",
      user_id: userId,
      email: email!,
      full_name: values.name!,
      company_name: values.company!,
      plan_id: order.planDbId,
      product: order.product,
      interval: order.interval,
      accounts_quantity: order.accountsQuantity,
      business_type_id: "ecommerce",
      selection: state,
      quote: order.quote,
      amount_due_now_cents: order.amountDueNowCents,
      recurring_cents: order.recurringCents,
    })
    .select("id")
    .single();
  if (cErr) throw cErr;

  const { error: iErr } = await admin.from("checkout_items").insert(
    order.items.map((i, position) => ({
      checkout_session_id: checkout.id,
      kind: i.kind,
      plan_price_id: i.planPriceId ?? null,
      billing_item_id: i.billingItemId ?? null,
      quantity: i.quantity,
      amount_cents: i.amountCents,
      label: i.label,
      position,
    })),
  );
  if (iErr) throw iErr;

  const { data: workspaceId, error: fErr } = await admin.rpc("fulfill_checkout", {
    p_checkout_id: checkout.id,
    p_provider_customer_id: `mock_cus_${checkout.id.slice(0, 8)}`,
    p_provider_subscription_id: `mock_sub_${checkout.id.slice(0, 8)}`,
    p_provider_invoice_id: `mock_in_${checkout.id.slice(0, 8)}`,
    p_payment: { method: "card", card_brand: "visa", card_last4: "4242", provider_payment_id: `mock_pi_${checkout.id.slice(0, 8)}` },
  });
  if (fErr) throw fErr;

  if (values.onboarding === "done") {
    const { error } = await admin
      .from("workspaces")
      .update({ onboarding_step: "done", onboarding_completed_at: new Date().toISOString(), business_type_id: "ecommerce" })
      .eq("id", workspaceId);
    if (error) throw error;
  }

  console.log(JSON.stringify({ email, password: values.password, userId, workspaceId, product, plan, period, accounts: order.accountsQuantity, onboarding: values.onboarding }, null, 2));
}

(values.delete ? remove() : create()).catch((err) => {
  console.error(err);
  process.exit(1);
});
