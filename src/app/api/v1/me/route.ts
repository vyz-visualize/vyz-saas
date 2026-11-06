// GET /api/v1/me: quem está logado e seus workspaces (com plano). Usado pelo
// app nativo logo depois do login.

import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";

export async function GET(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { db, userId } = session;
  const [profile, members, credits] = await Promise.all([
    db.from("profiles").select("full_name, email, avatar_url, default_workspace_id").eq("id", userId).maybeSingle(),
    db.from("workspace_members").select("role, workspace:workspaces!inner(id, name, onboarding_step)").eq("user_id", userId),
    db.from("credit_balances").select("balance").eq("user_id", userId).maybeSingle(),
  ]);
  const ids = (members.data ?? []).map((m) => m.workspace.id);
  const access = ids.length ? await db.from("workspace_access").select("workspace_id, plan_id, has_access, provider, interval, accounts_quantity, cancel_at_period_end, current_period_end, max_members").in("workspace_id", ids) : { data: [] };
  return apiJson({
    user: { id: userId, email: profile.data?.email ?? session.email, fullName: profile.data?.full_name ?? "", avatarUrl: profile.data?.avatar_url ?? null },
    credits: credits.data?.balance ?? 0,
    defaultWorkspaceId: profile.data?.default_workspace_id ?? ids[0] ?? null,
    workspaces: (members.data ?? []).map((m) => {
      const a = access.data?.find((x) => x.workspace_id === m.workspace.id);
      const source = !a?.plan_id ? null : a.provider === "app_store" || a.provider === "play_store" ? a.provider : "site";
      return {
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
        onboardingDone: m.workspace.onboarding_step === "done",
        plan: a?.plan_id ?? null,
        hasAccess: !!a?.has_access,
        planSource: source,
        period: a?.interval === "year" ? "anual" : a?.interval === "month" ? "mensal" : null,
        accounts: a?.accounts_quantity ?? 0,
        cancelAtPeriodEnd: !!a?.cancel_at_period_end,
        periodEnd: a?.current_period_end ?? null,
        maxMembers: a?.max_members ?? 1,
      };
    }),
  });
}

/** PATCH /api/v1/me { defaultWorkspaceId }: troca o workspace aberto no app (e o padrão do site). */
export async function PATCH(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const body = (await request.json().catch(() => null)) as { defaultWorkspaceId?: unknown } | null;
  const id = typeof body?.defaultWorkspaceId === "string" ? body.defaultWorkspaceId : "";
  const member = await session.db.from("workspace_members").select("workspace_id").eq("user_id", session.userId).eq("workspace_id", id).maybeSingle();
  if (!member.data) return apiJson({ error: { code: "workspace:not_found", message: "Workspace não encontrado." } }, 404);
  const { error } = await session.db.from("profiles").update({ default_workspace_id: id }).eq("id", session.userId);
  if (error) return apiJson({ error: { code: "unknown", message: "Não foi possível trocar o workspace." } }, 500);
  return apiJson({ ok: true });
}
