import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { SettingsPage } from "@/features/workspace/SettingsPage";
import { requireWorkspace } from "@/server/auth/workspace";
import { getSettingsData } from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando as configurações" blocks={[44, 32, 56, 40]} />}>
      <Configuracoes />
    </Suspense>
  );
}

// Perfil, senha e histórico não dependem do plano: abrem mesmo sem assinatura
// ativa (logo e cor pedem um plano ativo; esconder a VYZ, o Personalizado).
async function Configuracoes() {
  await requireWorkspace({ access: false, onboarding: false, next: "/painel/configuracoes" });
  return <SettingsPage data={await getSettingsData()} />;
}
