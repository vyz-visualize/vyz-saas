import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { btn } from "@/components/ui/styles";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { CheckoutLive } from "@/features/checkout/CheckoutLive";
import { CheckoutSteps } from "@/features/checkout/CheckoutSteps";
import { BLOCK_MESSAGE, buildOrder, normalizeState, type Order } from "@/features/checkout/order";
import { TestReset } from "@/features/checkout/TestReset";
import { buildPlanMessage } from "@/features/pricing/messages";
import { fromQuery, toQuery, type PlanState } from "@/features/pricing/pricing";
import { waLink } from "@/lib/whatsapp";
import { signOut } from "@/server/auth/actions";
import { getCheckoutViewer, type CheckoutViewer } from "@/server/billing/queries";
import { isMockBilling, isTestAccount } from "@/server/env";
import { appOrigin } from "@/server/http/request";

export const metadata: Metadata = {
  title: "Assinar",
  description: "Crie sua conta, pague e entre no VYZ.",
};

type SearchParams = Awaited<PageProps<"/assinar">["searchParams"]>;

/** Query da LP (Monte seu plano) → URLSearchParams, com o primeiro valor de cada chave. */
function toParams(params: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) out.set(key, first);
  }
  return out;
}

// A seleção vem da URL e a sessão dos cookies: os dois são dados da
// requisição e ficam dentro do Suspense (Cache Components).
export default function Page({ searchParams }: PageProps<"/assinar">) {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2 lg:pt-6">
      <CheckoutSteps current={1} />
      <Suspense fallback={<CheckoutSkeleton />}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Checkout({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // a sessão (validade do token) e o pedido dependem da hora: só na requisição
  await connection();
  const state = normalizeState(fromQuery(toParams(await searchParams)));
  const order = buildOrder(state);
  const query = toQuery(state);
  const viewer = await getCheckoutViewer(state.produto);
  const editHref = `/?${query}#planos`;

  if (order.blocked) return <Blocked order={order} state={state} query={query} editHref={editHref} />;
  if (viewer.subscribed) return <AlreadySubscribed workspaceName={viewer.subscribed.workspaceName} test={isTestAccount(viewer.user?.email)} />;

  return (
    <CheckoutLive
      initial={state}
      account={viewer.user ? { email: viewer.user.email, fullName: viewer.user.fullName, phone: viewer.user.phone } : null}
      workspaceName={viewer.target?.workspaceName ?? null}
      simulated={isMockBilling()}
      heading={
        <>
          <p className="label-caps text-fg-2">Assinatura</p>
          <h1 id="assinar-titulo" className="display mt-3 text-[clamp(2.1rem,5vw,3.4rem)] text-fg">
            {viewer.user ? "Falta pouco" : "Crie sua conta"}
            <br />
            <span className="text-accent">{viewer.user ? "para assinar." : "e assine."}</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-fg-2">
            {viewer.user
              ? "Confira seus dados e siga para o pagamento."
              : "Crie a conta com o Google ou com e-mail, depois o pagamento. Ao terminar, você já entra no painel."}
          </p>
          {viewer.user && <AccountNotice viewer={viewer} />}
        </>
      }
    />
  );
}

function AccountNotice({ viewer }: { viewer: CheckoutViewer }) {
  return (
    <div className="mt-6 space-y-2 rounded-control border border-line bg-card px-4 py-3 text-[14px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-fg-2">
          Você entrou como <strong className="font-semibold text-fg">{viewer.user?.email}</strong>.
        </span>
        <form action={signOut}>
          <button type="submit" className="font-semibold text-accent underline-offset-4 hover:underline">
            Não é você? Sair
          </button>
        </form>
      </div>
      {viewer.target && (
        <p className="text-fg-2">
          Este pedido assina o workspace <strong className="font-semibold text-fg">{viewer.target.workspaceName}</strong>.
        </p>
      )}
      {viewer.memberElsewhere && <p className="text-fg-2">Você participa do workspace de outra pessoa. Este pedido cria um workspace seu, separado.</p>}
    </div>
  );
}

async function Blocked({ order, state, query, editHref }: { order: Order; state: PlanState; query: string; editHref: string }) {
  const message = buildPlanMessage(state, order.quote, `${await appOrigin()}/?${query}`);
  return (
    <section aria-labelledby="bloqueado-titulo" className="mt-8 max-w-2xl rounded-card border border-line bg-card p-6 sm:p-8">
      <p className="label-caps text-fg-2">Assinatura</p>
      <h1 id="bloqueado-titulo" className="display mt-3 text-[clamp(1.9rem,4vw,2.8rem)] text-fg">
        {order.blocked === "empty" ? "Monte o pedido primeiro." : "Esse pedido precisa de um plano."}
      </h1>
      <p className="mt-4 text-[15px] text-fg-2">{order.blocked && BLOCK_MESSAGE[order.blocked]}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={editHref} className={btn.primary}>
          {order.blocked === "empty" ? "Monte seu plano" : "Escolher um plano"}
        </Link>
        {order.blocked !== "empty" && (
          <a href={waLink(message)} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
            <WhatsAppIcon /> Falar com especialista
          </a>
        )}
      </div>
    </section>
  );
}

function AlreadySubscribed({ workspaceName, test }: { workspaceName: string; test: boolean }) {
  return (
    <section aria-labelledby="assinado-titulo" className="mt-8 max-w-2xl rounded-card border border-line bg-card p-6 sm:p-8">
      <p className="label-caps text-fg-2">Assinatura ativa</p>
      <h1 id="assinado-titulo" className="display mt-3 text-[clamp(1.9rem,4vw,2.8rem)] text-fg">
        Você já assina o VYZ.
      </h1>
      <p className="mt-4 text-[15px] text-fg-2">
        O workspace <strong className="font-semibold text-fg">{workspaceName}</strong> já tem uma assinatura ativa. Para mudar de plano, de período ou de
        contas, use a página Plano, no painel.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/painel/plano" className={btn.primary}>
          Ver meu plano
        </Link>
        <Link href="/painel" className={btn.secondary}>
          Ir para o painel
        </Link>
      </div>
      {test && <TestReset className="mt-6" />}
    </section>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14" aria-busy="true" aria-label="Carregando o pedido">
      <div className="space-y-4">
        <div className="h-4 w-28 animate-pulse rounded-control bg-card" />
        <div className="h-24 w-3/4 animate-pulse rounded-control bg-card" />
        <div className="h-12 animate-pulse rounded-[10px] bg-card" />
        <div className="h-12 animate-pulse rounded-[10px] bg-card" />
        <div className="h-12 animate-pulse rounded-[10px] bg-card" />
      </div>
      <div className="order-first h-80 animate-pulse rounded-card bg-card lg:order-none" />
    </div>
  );
}
