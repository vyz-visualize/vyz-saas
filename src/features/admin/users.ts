// Gerenciador de usuários do painel Interno: tipos e regras puras (testáveis).

import { PLAN_PROJECTS } from "@/features/pricing/pricing";

export type GrantTier = "base" | "pro" | "avancado" | "personalizado";
export const GRANT_TIERS: GrantTier[] = ["base", "pro", "avancado", "personalizado"];
export const GRANT_LABEL: Record<GrantTier, string> = { base: "Básico", pro: "Padrão", avancado: "Avançado", personalizado: "Personalizado" };
/** Prazos da cortesia, em meses (0 = sem prazo). */
export const GRANT_MONTHS = [1, 3, 6, 12, 0] as const;

/** Projetos (contas) de cada plano; o banco aceita de 1 a 30. */
export const projectsOf = (tier: GrantTier) => (tier === "personalizado" ? 30 : PLAN_PROJECTS[tier]);

export type UserStatus = "ativo" | "inativado" | "sem_plano" | "parou_no_pagamento";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  /** Logins registrados (auth_events: sign_in e oauth_sign_in). */
  signIns: number;
  banned: boolean;
  workspace: { id: string; name: string; role: string } | null;
  plan: { id: string; tier: string; status: string; provider: string; periodEnd: string | null; courtesy: boolean } | null;
  /** Pedido aberto (escolheu o plano e parou no pagamento). */
  openCheckout: { id: string; planId: string | null; createdAt: string } | null;
};

export function statusOf(u: Pick<AdminUserRow, "banned" | "plan" | "openCheckout">): UserStatus {
  if (u.banned) return "inativado";
  if (u.plan && ["active", "trialing", "past_due"].includes(u.plan.status)) return "ativo";
  if (u.openCheckout) return "parou_no_pagamento";
  return "sem_plano";
}

export const STATUS_LABEL: Record<UserStatus, string> = { ativo: "Com plano", inativado: "Inativado", sem_plano: "Sem plano", parou_no_pagamento: "Parou no pagamento" };

/** Fim do período da cortesia (meses = 0: 100 anos, na prática sem prazo). */
export function grantPeriodEnd(months: number, now = new Date()): Date {
  const end = new Date(now);
  end.setMonth(end.getMonth() + (months > 0 ? months : 1200));
  return end;
}

/** Conta logins por usuário a partir das linhas de auth_events. */
export function countSignIns(rows: { user_id: string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
  return m;
}

/** Busca por e-mail, nome ou workspace, sem acento e sem caixa. */
export function matchesUser(u: AdminUserRow, query: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  return [u.email, u.name ?? "", u.workspace?.name ?? ""].some((s) => norm(s).includes(q));
}

/** Slug único e válido (^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$): nome + 6 caracteres do id. */
export function workspaceSlug(name: string, id: string): string {
  const base = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  const suffix = id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6) || "ws";
  return base ? `${base}-${suffix}` : `ws-${suffix}`;
}

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
