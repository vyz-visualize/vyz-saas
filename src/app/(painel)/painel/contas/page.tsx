import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import { connectResult } from "@/features/integrations/results";
import { requireWorkspace } from "@/server/auth/workspace";
import { getConnectState, listAdAccounts } from "@/server/integrations/queries";

export const metadata: Metadata = { title: "Contas" };

export default function Page({ searchParams }: PageProps<"/painel/contas">) {
  return (
    <Suspense fallback={<AccountsSkeleton />}>
      <Contas searchParams={searchParams} />
    </Suspense>
  );
}

// Sessão, banco e ?conectado=/?erro= são dados da requisição: dentro do Suspense.
// connection(): o status das contas e da sincronização muda a todo momento e
// não entra no prefetch (a validação do JWT também compara com a hora atual).
async function Contas({ searchParams }: { searchParams: PageProps<"/painel/contas">["searchParams"] }) {
  await connection();
  const session = await requireWorkspace({ next: "/painel/contas" });
  const [state, manual, imported, query] = await Promise.all([getConnectState(), listAdAccounts({ manual: true }), listAdAccounts({ imported: true }), searchParams]);
  return <AccountsPage state={state} manual={manual} imported={imported} result={connectResult(query)} now={new Date().toISOString()} timeZone={session.workspace.timezone} />;
}

function AccountsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando as contas">
      <div className="space-y-2">
        <div className="h-4 w-20 animate-pulse rounded-control bg-card motion-reduce:animate-none" />
        <div className="h-10 w-72 max-w-full animate-pulse rounded-control bg-card motion-reduce:animate-none" />
      </div>
      <div className="h-16 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="h-44 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="h-44 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
    </div>
  );
}
