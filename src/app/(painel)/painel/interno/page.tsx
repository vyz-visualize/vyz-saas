import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { loadAdminReport, requireAdmin } from "@/server/admin/report";

// Aba "Interno" do painel: só os admins da Vyzualize (ADMIN_EMAILS). Os demais
// nem veem a aba e, pelo endereço, recebem 404. Fora dos buscadores.
export const metadata: Metadata = { title: "Interno", robots: { index: false, follow: false, nocache: true } };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-card motion-reduce:animate-none" aria-busy="true" aria-label="Carregando" />}>
      <Interno />
    </Suspense>
  );
}

async function Interno() {
  await connection();
  await requireAdmin();
  return <AdminDashboard report={await loadAdminReport()} />;
}
