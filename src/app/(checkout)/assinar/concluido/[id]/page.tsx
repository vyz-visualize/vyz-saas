import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { CARD_BRAND_LABEL } from "@/features/checkout/card";
import { CheckoutSteps } from "@/features/checkout/CheckoutSteps";
import { INTERVAL_LABEL, PAYMENT_METHOD_LABEL, formatDate } from "@/features/checkout/labels";
import { PLAN_LABEL, PRODUCT_HOME } from "@/features/pricing/pricing";
import { brl } from "@/lib/format";
import { getSessionUser } from "@/server/auth/session";
import { getCheckout, getCheckoutReceipt, type CheckoutReceipt, type CheckoutView } from "@/server/billing/queries";
import { isMockBilling } from "@/server/env";

export const metadata: Metadata = { title: "Assinatura confirmada" };

const NEXT_STEPS = [
  { title: "Tipo de negócio", text: "Para o VYZ falar a língua do seu cliente." },
  { title: "Plataformas", text: "Meta Ads, Google Ads e as outras do plano." },
  { title: "Conectar as contas", text: "Login na plataforma, sem copiar ID." },
  { title: "Escolher o dashboard", text: "Ele nasce com as métricas das contas." },
];

const LP_NEXT_STEPS = [
  { title: "Escolher o template", text: "A primeira página já nasce com o GTM." },
  { title: "Ajustar textos e cores", text: "Do jeito da sua marca." },
  { title: "Publicar", text: "No link lps.vyzualize.com.br, pronto para anúncio." },
  { title: "Receber os leads", text: "Tudo cai no painel, com a origem do clique." },
];

export default function Page({ params }: PageProps<"/assinar/concluido/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2 lg:pt-6">
      <CheckoutSteps current={3} />
      <Suspense fallback={<div className="mx-auto mt-8 h-96 max-w-2xl animate-pulse rounded-[20px] bg-card" aria-busy="true" />}>
        <Done params={params} />
      </Suspense>
    </div>
  );
}

async function Done({ params }: { params: PageProps<"/assinar/concluido/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/assinar/concluido/${id}`)}`);

  const checkout = await getCheckout(id);
  if (!checkout) notFound();
  if (checkout.status !== "completed") redirect(`/assinar/pagamento/${id}`);
  const receipt = await getCheckoutReceipt(checkout);
  const services = checkout.items.filter((i) => i.kind === "one_time");

  return (
    <section aria-labelledby="concluido-titulo" className="mx-auto mt-8 max-w-2xl rounded-[20px] border border-line bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
          <Check size={24} strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="label-caps text-fg-2">{checkout.planId ? "Assinatura ativa" : "Pedido confirmado"}</p>
          <h1 id="concluido-titulo" className="display mt-2 text-[clamp(1.9rem,4.4vw,2.9rem)] text-fg">
            Tudo certo, {checkout.fullName.split(" ")[0]}.
          </h1>
          <p className="mt-3 text-[15px] text-fg-2">
            {checkout.planId
              ? checkout.product === "lp"
                ? `O plano ${PLAN_LABEL[checkout.planId]} de landing pages já está valendo. Agora é escolher o template da primeira página.`
                : `O plano ${PLAN_LABEL[checkout.planId]} já está valendo. Agora é conectar as contas e escolher o primeiro dashboard.`
              : "O time da VYZ chama você no WhatsApp para começar os serviços contratados."}
          </p>
        </div>
      </div>

      <Receipt checkout={checkout} receipt={receipt} />

      {services.length > 0 && checkout.planId && (
        <p className="mt-4 text-[13.5px] text-fg-2">
          {services.map((s) => `${s.quantity}× ${s.label}`).join(", ")}: entra na fila do time, e avisamos pelo WhatsApp quando começar.
        </p>
      )}

      {checkout.planId ? (
        <>
          <h2 className="title mt-8 text-lg text-fg">Próximos passos</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {(checkout.product === "lp" ? LP_NEXT_STEPS : NEXT_STEPS).map((step, i) => (
              <li key={step.title} className="flex gap-3 rounded-control border border-line px-3.5 py-3">
                <span className="label-caps pt-0.5 text-accent tnum">0{i + 1}</span>
                <span>
                  <span className="block text-[14px] font-semibold text-fg">{step.title}</span>
                  <span className="block text-[13px] text-fg-2">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link href={PRODUCT_HOME[checkout.product]} className={`${btn.primary} mt-7 w-full rounded-[10px] sm:w-auto`}>
            Começar
            <ArrowRight size={17} aria-hidden />
          </Link>
        </>
      ) : (
        <Link href="/painel/plano" className={`${btn.primary} mt-7 w-full rounded-[10px] sm:w-auto`}>
          Acompanhar o pedido
          <ArrowRight size={17} aria-hidden />
        </Link>
      )}

      {isMockBilling() && (
        <div className="mt-6">
          <PendingChip
            label="Pagamento simulado · nenhum valor foi cobrado"
            detail="A cobrança real entra com a Stripe. A assinatura e o histórico já são de verdade."
          />
        </div>
      )}
    </section>
  );
}

function Receipt({ checkout, receipt }: { checkout: CheckoutView; receipt: CheckoutReceipt }) {
  const p = receipt.payment;
  const rows: [string, string][] = [];
  if (receipt.workspaceName) rows.push(["Workspace", receipt.workspaceName]);
  if (checkout.planId) {
    const accounts = checkout.product === "lp" ? "landing pages" : checkout.accountsQuantity === 1 ? "1 conta" : `${checkout.accountsQuantity} contas`;
    rows.push(["Plano", `${PLAN_LABEL[checkout.planId]} · ${INTERVAL_LABEL[checkout.interval]} · ${accounts}`]);
  }
  const method =
    p?.cardBrand && p.cardLast4 ? `${CARD_BRAND_LABEL[p.cardBrand] ?? "Cartão"} •••• ${p.cardLast4}` : p?.method ? PAYMENT_METHOD_LABEL[p.method] : null;
  rows.push(["Pago hoje", `${brl(p?.amountCents ?? checkout.amountDueNowCents)}${method ? ` · ${method}` : ""}`]);
  if (receipt.subscription && checkout.recurringCents > 0) {
    rows.push(["Próxima cobrança", `${formatDate(receipt.subscription.currentPeriodEnd)} · ${brl(checkout.recurringCents)}`]);
  }
  return (
    <dl className="mt-7 divide-y divide-line rounded-control border border-line">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <dt className="text-[13px] text-fg-2">{label}</dt>
          <dd className="text-[14.5px] font-medium text-fg tnum sm:text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
