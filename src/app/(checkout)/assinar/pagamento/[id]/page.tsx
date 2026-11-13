import type { Metadata } from "next";
import { PRODUCT_HOME } from "@/features/pricing/pricing";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { btn } from "@/components/ui/styles";
import { CheckoutSteps } from "@/features/checkout/CheckoutSteps";
import { OrderSummary } from "@/features/checkout/OrderSummary";
import { PaymentForm } from "@/features/checkout/PaymentForm";
import { StripePay } from "@/features/checkout/StripePay";
import { toQuery } from "@/features/pricing/pricing";
import { getSessionUser } from "@/server/auth/session";
import { getCheckout, getCheckoutReceipt, type CheckoutView } from "@/server/billing/queries";
import { isMockBilling } from "@/server/env";

export const metadata: Metadata = { title: "Pagamento" };

// O pedido é do usuário logado (RLS) e o id vem da URL: tudo dentro do Suspense.
export default function Page({ params, searchParams }: PageProps<"/assinar/pagamento/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2 lg:pt-6">
      <CheckoutSteps current={2} />
      <Suspense fallback={<PaymentSkeleton />}>
        <Payment params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Payment({ params, searchParams }: Pick<PageProps<"/assinar/pagamento/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const query = await searchParams;
  const notice = query.cancelado ? "cancelado" : typeof query.erro === "string" ? query.erro : null;
  // a sessão (validade do token) e a validade do pedido dependem da hora: só na requisição
  await connection();
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/assinar/pagamento/${id}`)}`);

  const checkout = await getCheckout(id);
  if (!checkout) notFound();
  if (checkout.status === "completed") {
    if (!checkout.planId) redirect("/painel/plano");
    redirect((await getCheckoutReceipt(checkout)).entryUrl ?? PRODUCT_HOME[checkout.product]);
  }
  if (checkout.status !== "open") return <Closed checkout={checkout} />;

  // validade de exemplo para o cartão de teste: dezembro, daqui a 4 anos
  const sampleExpiry = `12/${String((new Date().getFullYear() + 4) % 100).padStart(2, "0")}`;
  const planQuery = toQuery(checkout.state);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
      <section aria-labelledby="pagamento-titulo" className="min-w-0">
        <p className="label-caps text-fg-2">Pagamento</p>
        <h1 id="pagamento-titulo" className="display mt-3 text-[clamp(2.1rem,5vw,3.4rem)] text-fg">
          Último passo,
          <br />
          <span className="text-accent">{checkout.fullName.split(" ")[0]}.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] text-fg-2">
          Assim que o pagamento for aprovado, a organização <strong className="font-semibold text-fg">{checkout.companyName}</strong> fica pronta e você segue
          para conectar as contas.
        </p>
        <div className="mt-8">
          {isMockBilling() ? (
            <PaymentForm checkoutId={checkout.id} amountCents={checkout.amountDueNowCents} holderName={checkout.fullName} sampleExpiry={sampleExpiry} simulated />
          ) : (
            <StripePay checkoutId={checkout.id} amountCents={checkout.amountDueNowCents} notice={notice} />
          )}
        </div>
      </section>

      <aside aria-label="Resumo do pedido" className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
        <OrderSummary
          state={checkout.state}
          quote={checkout.quote}
          amountDueNowCents={checkout.amountDueNowCents}
          recurringCents={checkout.recurringCents}
          editHref={`/?${planQuery}#planos`}
        />
      </aside>
    </div>
  );
}

/** Pedido vencido (24 h) ou trocado por um mais novo: monta de novo com os preços de hoje. */
function Closed({ checkout }: { checkout: CheckoutView }) {
  const query = toQuery(checkout.state);
  const expired = checkout.status === "expired";
  return (
    <section aria-labelledby="fechado-titulo" className="mt-8 max-w-2xl rounded-card border border-line bg-card p-6 sm:p-8">
      <p className="label-caps text-fg-2">Pedido {expired ? "expirado" : "substituído"}</p>
      <h1 id="fechado-titulo" className="display mt-3 text-[clamp(1.9rem,4vw,2.8rem)] text-fg">
        {expired ? "Este pedido expirou." : "Há um pedido mais novo."}
      </h1>
      <p className="mt-4 text-[15px] text-fg-2">
        {expired
          ? "Um pedido vale por 24 horas. Recomece com a mesma seleção: os valores são os de hoje."
          : "Você montou outro pedido depois deste, e só o mais recente pode ser pago. Recomece com esta seleção, se preferir."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/assinar?${query}`} className={btn.primary}>
          Recomeçar
        </Link>
        <Link href={`/?${query}#planos`} className={btn.secondary}>
          Alterar pedido
        </Link>
      </div>
    </section>
  );
}

function PaymentSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14" aria-busy="true" aria-label="Carregando o pagamento">
      <div className="space-y-4">
        <div className="h-4 w-28 animate-pulse rounded-control bg-card" />
        <div className="h-24 w-2/3 animate-pulse rounded-control bg-card" />
        <div className="h-12 animate-pulse rounded-[10px] bg-card" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 animate-pulse rounded-[10px] bg-card" />
          <div className="h-12 animate-pulse rounded-[10px] bg-card" />
        </div>
      </div>
      <div className="order-first h-80 animate-pulse rounded-card bg-card lg:order-none" />
    </div>
  );
}
