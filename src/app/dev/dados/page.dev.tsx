// Bancada dos dashboards de modelo com dados no formato do armazém: só existe no `next dev`
// (a extensão .dev.tsx só vira rota fora de produção). Serve para conferir o funil de compra
// da Meta e o selo "Atualizando…" sem conta nem banco. ?visual=noturno troca o visual.

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DataHarness } from "./harness";

export const metadata = { title: "Dados (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <DataHarness />
    </Suspense>
  );
}
