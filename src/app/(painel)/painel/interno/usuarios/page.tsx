import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { UsersManager } from "@/features/admin/UsersManager";
import { requireAdmin } from "@/server/admin/report";
import { loadAdminUsers } from "@/server/admin/user-admin";

// Gerenciador de usuários do Interno: só admins (ADMIN_EMAILS); os demais recebem 404.
export const metadata: Metadata = { title: "Usuários · Interno", robots: { index: false, follow: false, nocache: true } };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-card motion-reduce:animate-none" aria-busy="true" aria-label="Carregando" />}>
      <Usuarios />
    </Suspense>
  );
}

async function Usuarios() {
  await connection();
  await requireAdmin();
  return <UsersManager users={await loadAdminUsers()} />;
}
