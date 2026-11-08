import { connection } from "next/server";
import { Suspense } from "react";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { loadAdminReport, requireAdmin } from "@/server/admin/report";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-fg-2">Carregando…</p>}>
      <Interno />
    </Suspense>
  );
}

async function Interno() {
  await connection();
  await requireAdmin();
  return <AdminDashboard report={await loadAdminReport()} />;
}
