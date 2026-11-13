// Bancada do painel inteiro: só existe no `next dev` (a extensão .dev.tsx só vira rota fora de
// produção). A moldura de verdade (AppShell) com cada tela e dados de exemplo, sem banco e sem
// conta de teste: /dev/painel?tela=inicio (projetos, dashboards, interno, usuarios, configuracoes…).

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PanelHarness } from "./harness";

export const metadata = { title: "Painel (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <PanelHarness />
    </Suspense>
  );
}
