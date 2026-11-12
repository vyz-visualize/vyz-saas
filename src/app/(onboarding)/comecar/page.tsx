import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { connectResult } from "@/features/integrations/results";
import { AskAdmin, OnboardingFlow, OnboardingSkeleton } from "@/features/onboarding/OnboardingFlow";
import { requireWorkspace } from "@/server/auth/workspace";
import { getOnboardingState } from "@/server/onboarding/queries";

export const metadata: Metadata = { title: "Começar" };

export default function Page({ searchParams }: PageProps<"/comecar">) {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <Comecar searchParams={searchParams} />
    </Suspense>
  );
}

// Sessão, passo salvo no banco e ?conectado=/?erro= (volta do login da Meta e
// do Google) são dados da requisição. connection(): o status das contas e da
// importação muda a todo momento.
async function Comecar({ searchParams }: { searchParams: PageProps<"/comecar">["searchParams"] }) {
  await connection();
  const session = await requireWorkspace({ onboarding: false, next: "/comecar" });
  if (session.workspace.onboardingStep === "done") redirect("/painel");

  const query = await searchParams;
  const state = await getOnboardingState(session);
  if (!state.canManage) return <AskAdmin workspaceName={state.workspaceName} />;

  return <OnboardingFlow state={state} result={state.step === "connect" ? connectResult(query) : null} now={new Date().toISOString()} timeZone={session.workspace.timezone} />;
}
