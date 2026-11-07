import type { Metadata } from "next";
import { Suspense } from "react";
import { WhatsappPage } from "@/features/whatsapp/WhatsappPage";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getWhatsappData } from "@/server/whatsapp/queries";

export const metadata: Metadata = { title: "WhatsApp" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando o WhatsApp" blocks={[44, 40, 56]} />}>
      <Whatsapp />
    </Suspense>
  );
}

// Abre sem assinatura ativa (mostra o bloqueio); o envio confere o plano.
async function Whatsapp() {
  const session = await requireWorkspace({ access: false, onboarding: false, next: "/painel/whatsapp" });
  return <WhatsappPage data={await getWhatsappData(session)} />;
}
