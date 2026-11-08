import "server-only";

// Painel interno: quem pode ver e o relatório completo (com cache curto para
// não estourar as cotas das APIs). Todas as fontes rodam juntas; a que falha
// vira um aviso, sem derrubar as outras.

import { notFound } from "next/navigation";
import type { AdminReport } from "@/features/admin/types";
import { getSessionUser } from "@/server/auth/session";
import { loadAppStore } from "./appstore";
import { adminEmails } from "./credentials";
import { loadGa4, loadGooglePlay } from "./google";
import { loadRevenueCat, loadStripe } from "./revenue";
import { loadUsers } from "./users";

/** E-mail é admin do painel interno? */
export const isAdminEmail = (email: string | null | undefined) => !!email && adminEmails().includes(email.trim().toLowerCase());

/** Para a página: quem não é admin vê 404 (a rota nem parece existir). */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  return { id: user.id, email: user.email! };
}

const TTL = 15 * 60 * 1000;
let cached: { at: number; report: Promise<AdminReport> } | null = null;

export function loadAdminReport(opts: { fresh?: boolean } = {}): Promise<AdminReport> {
  if (!opts.fresh && cached && Date.now() - cached.at < TTL) return cached.report;
  const report = (async () => {
    const [users, ga4, stripe, appStore, googlePlay, revenueCat] = await Promise.all([loadUsers(), loadGa4(), loadStripe(), loadAppStore(), loadGooglePlay(), loadRevenueCat()]);
    return { generatedAt: new Date().toISOString(), users, ga4, stripe, appStore, googlePlay, revenueCat };
  })();
  cached = { at: Date.now(), report };
  report.catch(() => (cached = null));
  return report;
}
