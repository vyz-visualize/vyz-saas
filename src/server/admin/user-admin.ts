import "server-only";

// Gerenciador de usuários do painel Interno (só admins). Lê pelo cliente de serviço e
// faz as ações que antes eram SQL à mão: dar plano de cortesia, tirar o plano,
// inativar/reativar o login e excluir a conta (o mesmo fluxo da CLI de exclusão).

import postgres from "postgres";
import { countSignIns, grantPeriodEnd, workspaceSlug, projectsOf, type ActionResult, type AdminUserRow, type GrantTier } from "@/features/admin/users";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import { applyPlan, loadPlan, planCode, readTokens, refuseReason, renderPlan, type Db } from "./account-deletion";
import { renderRevocations, revokeAll, type RevokeOutcome } from "./revoke-access";

const LIVE = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];
const BAN_FOREVER = "876000h"; // 100 anos
const msg = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200);

export async function loadAdminUsers(): Promise<AdminUserRow[]> {
  const db = createAdminSupabase();
  const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; banned_until?: string | null }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users as typeof users));
    if (data.users.length < 1000) break;
  }
  const [profiles, members, subs, checkouts, events] = await Promise.all([
    db.from("profiles").select("id, full_name"),
    db.from("workspace_members").select("user_id, role, workspace_id, workspaces(name)"),
    db.from("subscriptions").select("workspace_id, plan_id, status, provider, provider_subscription_id, current_period_end, metadata, created_at").not("status", "in", "(canceled,incomplete_expired)"),
    db.from("checkout_sessions").select("id, user_id, plan_id, created_at").eq("status", "open").order("created_at", { ascending: false }),
    db.from("auth_events").select("user_id").in("event", ["sign_in", "oauth_sign_in"]).limit(100_000),
  ]);
  for (const r of [profiles, members, subs, checkouts, events]) if (r.error) throw r.error;

  const nameOf = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
  const signIns = countSignIns(events.data ?? []);
  const subOf = new Map((subs.data ?? []).map((s) => [s.workspace_id, s]));
  const rank = (role: string) => (role === "owner" ? 0 : role === "admin" ? 1 : 2);
  const wsOf = new Map<string, { id: string; name: string; role: string }>();
  for (const m of [...(members.data ?? [])].sort((a, b) => rank(a.role) - rank(b.role))) {
    if (!wsOf.has(m.user_id)) wsOf.set(m.user_id, { id: m.workspace_id, name: (m.workspaces as { name: string } | null)?.name ?? "", role: m.role });
  }
  const openOf = new Map<string, { id: string; planId: string | null; createdAt: string }>();
  for (const c of checkouts.data ?? []) if (c.user_id && !openOf.has(c.user_id)) openOf.set(c.user_id, { id: c.id, planId: c.plan_id, createdAt: c.created_at });

  return users
    .map((u): AdminUserRow => {
      const ws = wsOf.get(u.id) ?? null;
      const s = ws ? subOf.get(ws.id) : undefined;
      const meta = (s?.metadata ?? {}) as Record<string, unknown>;
      return {
        id: u.id,
        email: u.email ?? "",
        name: nameOf.get(u.id) ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        signIns: signIns.get(u.id) ?? 0,
        banned: !!u.banned_until && Date.parse(u.banned_until) > Date.now(),
        workspace: ws,
        plan: s
          ? { id: s.plan_id, tier: s.plan_id, status: s.status, provider: s.provider, periodEnd: s.current_period_end, courtesy: meta.cortesia === true || meta.cortesia_upgrade === true }
          : null,
        openCheckout: ws ? null : (openOf.get(u.id) ?? null),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Workspace principal da pessoa (dona primeiro), para o histórico das ações de admin. */
export async function primaryWorkspaceOf(userId: string): Promise<string | null> {
  const { data } = await createAdminSupabase().from("workspace_members").select("workspace_id, role").eq("user_id", userId);
  const rows = [...(data ?? [])].sort((a, b) => (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1));
  return rows[0]?.workspace_id ?? null;
}

/** Workspace novo para quem nunca chegou ao checkout: nome do perfil (ou do e-mail), dono = a pessoa. */
async function createWorkspaceFor(db: ReturnType<typeof createAdminSupabase>, userId: string): Promise<string> {
  const { data: u, error: uErr } = await db.auth.admin.getUserById(userId);
  if (uErr || !u.user) throw uErr ?? new Error("usuário não encontrado");
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const name = (profile?.full_name?.trim() || u.user.email?.split("@")[0] || "Workspace").slice(0, 80);
  const { data: ws, error } = await db.from("workspaces").insert({ name, slug: workspaceSlug(name, userId), created_by: userId }).select("id").single();
  if (error) throw error;
  const mem = await db.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
  if (mem.error) throw mem.error;
  await db.from("profiles").update({ default_workspace_id: ws.id }).eq("id", userId).is("default_workspace_id", null);
  return ws.id;
}

/** Workspace em que a pessoa é dona (o primeiro). */
async function ownedWorkspace(db: ReturnType<typeof createAdminSupabase>, userId: string): Promise<string | null> {
  const { data, error } = await db.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("role", "owner").limit(1);
  if (error) throw error;
  return data?.[0]?.workspace_id ?? null;
}

/**
 * Plano de cortesia. Sem workspace e com pedido aberto, conclui o pedido como cortesia
 * (cria o workspace) e zera a fatura. Com assinatura paga de verdade num provedor, recusa.
 */
export async function grantPlan(userId: string, tier: GrantTier, months: number, actor: string): Promise<ActionResult> {
  try {
    const db = createAdminSupabase();
    let ws = await ownedWorkspace(db, userId);
    if (!ws) {
      const { data: open, error } = await db
        .from("checkout_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "open")
        .not("plan_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const checkoutId = open?.[0]?.id;
      if (!checkoutId) {
        // nunca chegou ao checkout: cria o workspace (a pessoa passa pelas boas-vindas no próximo login)
        ws = await createWorkspaceFor(db, userId);
      } else {
        const { data: created, error: fErr } = await db.rpc("fulfill_checkout", { p_checkout_id: checkoutId, p_provider_customer_id: `cortesia-${userId}` });
        if (fErr) throw fErr;
        ws = created as string;
        // cortesia não é receita
        const inv = await db.from("invoices").update({ subtotal_cents: 0, total_cents: 0, amount_paid_cents: 0, description: "Cortesia" }).eq("checkout_session_id", checkoutId);
        if (inv.error) throw inv.error;
        const pay = await db.from("payment_transactions").update({ amount_cents: 0 }).eq("checkout_session_id", checkoutId);
        if (pay.error) throw pay.error;
      }
    }

    const now = new Date();
    const end = grantPeriodEnd(months, now).toISOString();
    const stamp = { cortesia: true, liberado_por: actor, liberado_em: now.toISOString() };
    const { data: live, error: lErr } = await db
      .from("subscriptions")
      .select("id, provider, provider_subscription_id, metadata")
      .eq("workspace_id", ws)
      .in("status", LIVE as never)
      .limit(1);
    if (lErr) throw lErr;
    const sub = live?.[0];
    if (sub?.provider_subscription_id)
      return { ok: false, message: `Esta conta tem assinatura paga (${sub.provider}). Troque ou cancele o plano no provedor; liberar aqui deixaria o banco diferente da cobrança.` };
    if (sub) {
      const { error } = await db
        .from("subscriptions")
        .update({
          plan_id: tier,
          status: "active",
          accounts_quantity: projectsOf(tier),
          current_period_end: end,
          cancel_at_period_end: false,
          metadata: { ...((sub.metadata ?? {}) as Record<string, Json>), ...stamp },
        })
        .eq("id", sub.id);
      if (error) throw error;
    } else {
      const { error } = await db.from("subscriptions").insert({
        workspace_id: ws,
        plan_id: tier,
        status: "active",
        interval: months > 0 && months < 12 ? "month" : "year",
        accounts_quantity: projectsOf(tier),
        provider: "mock",
        current_period_start: now.toISOString(),
        current_period_end: end,
        metadata: stamp,
      });
      if (error) throw error;
    }
    return { ok: true, message: "Plano liberado. A pessoa vê o acesso no próximo carregamento da página." };
  } catch (err) {
    return { ok: false, message: `Não deu para liberar: ${msg(err)}` };
  }
}

/** Tira o plano (só cortesia ou simulado; o pago se cancela no provedor). */
export async function removePlan(userId: string): Promise<ActionResult> {
  try {
    const db = createAdminSupabase();
    const ws = await ownedWorkspace(db, userId);
    if (!ws) return { ok: false, message: "A pessoa não é dona de nenhum workspace." };
    const { data: live, error } = await db
      .from("subscriptions")
      .select("id, provider, provider_subscription_id")
      .eq("workspace_id", ws)
      .in("status", LIVE as never);
    if (error) throw error;
    if (!live?.length) return { ok: false, message: "Não há plano ativo para tirar." };
    if (live.some((s) => s.provider_subscription_id)) return { ok: false, message: "Assinatura paga: cancele no provedor (Stripe ou loja). O site atualiza sozinho pelo webhook." };
    const now = new Date().toISOString();
    const { error: uErr } = await db
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: now, ended_at: now })
      .in(
        "id",
        live.map((s) => s.id),
      );
    if (uErr) throw uErr;
    return { ok: true, message: "Plano retirado. O acesso cai no próximo carregamento." };
  } catch (err) {
    return { ok: false, message: `Não deu para tirar o plano: ${msg(err)}` };
  }
}

/** Inativa (bloqueia o login) ou reativa. A sessão aberta cai quando o token vencer (até 1 h). */
export async function setInactive(userId: string, inactive: boolean): Promise<ActionResult> {
  const db = createAdminSupabase();
  const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: inactive ? BAN_FOREVER : "none" });
  if (error) return { ok: false, message: `Não deu para ${inactive ? "inativar" : "reativar"}: ${msg(error)}` };
  return { ok: true, message: inactive ? "Conta inativada: o login fica bloqueado." : "Conta reativada." };
}

// ---- exclusão total (o mesmo plano da CLI scripts/admin/delete-account-data.ts) ----------

const dbUrl = () => process.env.ADMIN_DB_URL?.trim() || null;

async function withSql<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const url = dbUrl();
  if (!url) throw new Error("Falta ADMIN_DB_URL (conexão direta com o banco) na Vercel.");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const adapter = (tx: { unsafe: (text: string, params?: never[]) => PromiseLike<unknown> }): Db => ({
  query: async <T>(text: string, params: unknown[] = []) => [...((await tx.unsafe(text, params as never[])) as Iterable<T>)],
});

export type DeletionPreview = { ok: true; text: string; code: string; blocked: boolean } | { ok: false; message: string };

/** Simulação: o que sai, o que fica e os bloqueios. Só leitura. */
export async function previewDeletion(email: string): Promise<DeletionPreview> {
  try {
    const plan = await withSql((sql) => sql.begin("read only", (tx) => loadPlan(adapter(tx), email)));
    return { ok: true, text: renderPlan(plan), code: planCode(plan), blocked: plan.blockers.length > 0 };
  } catch (err) {
    return { ok: false, message: msg(err) };
  }
}

/** Apaga de verdade. Refaz o plano na transação e exige o mesmo e-mail e código da simulação. */
export async function applyDeletion(email: string, confirmEmail: string, code: string): Promise<ActionResult> {
  let outcomes: RevokeOutcome[] = [];
  try {
    const plan = await withSql((sql) =>
      sql.begin(async (tx) => {
        const db = adapter(tx);
        const fresh = await loadPlan(db, email);
        const refused = refuseReason(fresh, { email: confirmEmail, code });
        if (refused) throw new Error(refused);
        outcomes = await revokeAll(await readTokens(db, fresh), { metaAppSecret: process.env.META_APP_SECRET });
        await applyPlan(db, fresh);
        return fresh;
      }),
    );
    const files = plan.workspaces.flatMap((w) => w.files);
    const leftovers: string[] = [];
    if (files.length) {
      const storage = createAdminSupabase().storage;
      const byBucket = new Map<string, string[]>();
      for (const f of files) {
        const [bucket, ...rest] = f.split("/");
        byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), rest.join("/")]);
      }
      for (const [bucket, paths] of byBucket) {
        const { error } = await storage.from(bucket).remove(paths);
        if (error) leftovers.push(...paths.map((p) => `${bucket}/${p}`));
      }
    }
    const notRevoked = outcomes.filter((o) => !o.revoked);
    const extra = [notRevoked.length ? `Revogar à mão: ${renderRevocations(notRevoked)}` : "", leftovers.length ? `Arquivos que ficaram: ${leftovers.join(", ")}` : ""].filter(Boolean).join(" ");
    return { ok: true, message: `Conta excluída.${extra ? ` ${extra}` : ""}` };
  } catch (err) {
    const revoked = outcomes.some((o) => o.revoked) ? " Atenção: o acesso na Meta/Google já tinha sido revogado." : "";
    return { ok: false, message: `Nada foi apagado no banco: ${msg(err)}${revoked}` };
  }
}
