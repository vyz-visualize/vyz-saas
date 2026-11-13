import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import { connectResult } from "@/features/integrations/results";
import { requireWorkspace } from "@/server/auth/workspace";
import { canSeeTestBadges } from "@/server/env";
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
  return (
    <AccountsPage
      state={state}
      manual={manual}
      imported={imported}
      result={connectResult(query)}
      now={new Date().toISOString()}
      timeZone={session.workspace.timezone}
      showTestBadges={canSeeTestBadges(session.user.email)}
    />
  );
}

function AccountsSkeleton() {
  const block = "animate-pulse bg-surface-2 motion-reduce:animate-none";
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Carregando as contas">
      <div className="space-y-3">
        <div className={`h-8 w-64 max-w-full rounded-control ${block}`} />
        <div className={`h-4 w-[32rem] max-w-full rounded-control ${block}`} />
      </div>
      <div className={`h-28 rounded-card ${block}`} />
      <div className="space-y-3.5">
        <div className={`h-5 w-32 rounded-control ${block}`} />
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-36 rounded-card ${block}`} />
          ))}
        </div>
      </div>
      <div className="space-y-3.5">
        <div className={`h-5 w-24 rounded-control ${block}`} />
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          <div className={`h-36 rounded-card ${block}`} />
        </div>
      </div>
    </div>
  );
}
