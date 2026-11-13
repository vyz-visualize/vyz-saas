// Bancada da página de Configurações: só existe no `next dev` (a extensão .dev.tsx só vira
// rota fora de produção). Sessão e dados de exemplo, sem banco e sem conta de teste.

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsHarness } from "./harness";

export const metadata = { title: "Configurações (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <SettingsHarness />
    </Suspense>
  );
}
