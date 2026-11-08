import "server-only";

// Usuários do site (Supabase Auth, cliente de serviço): cadastros, ativos
// (último login) e retenção por coorte semanal de cadastro.

import type { Source, UsersBlock } from "@/features/admin/types";
import { createAdminSupabase } from "@/server/supabase/admin";

const DAY = 86_400_000;

export type AuthUserLite = { created_at: string; last_sign_in_at: string | null };

/** Os números a partir da lista de usuários (puro, testável). */
export function summarizeUsers(users: AuthUserLite[], workspacesWithPlan: number, now = Date.now()): UsersBlock {
  const created = (u: AuthUserLite) => Date.parse(u.created_at);
  const seen = (u: AuthUserLite) => (u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0);
  const within = (t: number, days: number) => t >= now - days * DAY;
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) byDay.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0);
  for (const u of users) {
    const d = u.created_at.slice(0, 10);
    if (byDay.has(d)) byDay.set(d, byDay.get(d)! + 1);
  }
  // coortes: semanas de cadastro (8 últimas fechadas); voltou = entrou de novo 7+ dias depois do cadastro
  const cohorts: UsersBlock["cohorts"] = [];
  for (let w = 8; w >= 1; w--) {
    const from = now - (w + 1) * 7 * DAY;
    const to = now - w * 7 * DAY;
    const group = users.filter((u) => created(u) >= from && created(u) < to);
    cohorts.push({ week: new Date(from).toISOString().slice(0, 10), size: group.length, returned: group.filter((u) => seen(u) - created(u) >= 7 * DAY).length });
  }
  return {
    total: users.length,
    new7: users.filter((u) => within(created(u), 7)).length,
    new30: users.filter((u) => within(created(u), 30)).length,
    newPrev7: users.filter((u) => created(u) >= now - 14 * DAY && created(u) < now - 7 * DAY).length,
    active7: users.filter((u) => within(seen(u), 7)).length,
    active30: users.filter((u) => within(seen(u), 30)).length,
    workspacesWithPlan,
    signupsByDay: [...byDay.entries()].map(([date, n]) => ({ date, n })),
    cohorts,
  };
}

export async function loadUsers(): Promise<Source<UsersBlock>> {
  try {
    const db = createAdminSupabase();
    const users: AuthUserLite[] = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...data.users.map((u) => ({ created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null })));
      if (data.users.length < 1000) break;
    }
    const { count } = await db.from("workspace_access").select("workspace_id", { count: "exact", head: true }).eq("has_access", true);
    return { ok: true, data: summarizeUsers(users, count ?? 0) };
  } catch (err) {
    return { ok: false, reason: `Supabase: ${(err as Error).message.slice(0, 120)}` };
  }
}
