"use server";

// Ações de conexões e contas (Server Actions). O papel é conferido aqui e de
// novo no banco (RLS e gatilhos do plano). A chave de serviço só entra onde o
// usuário não tem escrita no banco: apagar a conexão (os tokens ficam no Vault).
// Mudanças de dado caem na auditoria (gatilhos); o uso, em activity_events.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { buildManualAccount, isManualPlatform } from "@/features/accounts/manual";
import { PLATFORM_ORDER, PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { isProviderId, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { SyncOutcome } from "@/features/integrations/types";
import { canUse } from "@/features/pricing/entitlements";
import { authorize } from "@/server/auth/workspace";
import { isMockIntegrations } from "@/server/env";
import { logActivity } from "@/server/history/log";
import { requestContext } from "@/server/http/request";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { createServerSupabase } from "@/server/supabase/server";
import { syncAdAccount } from "@/server/sync/run";
import { providerForConnection } from "./providers";
import { readConnectionTokens } from "./tokens";

const Id = z.uuid();
const Platform = z.enum(PLATFORM_ORDER as [PlatformId, ...PlatformId[]]);
const SYNC_FAILED = "Não foi possível importar os dados agora. Tente Sincronizar em instantes.";

async function runSync(adAccountId: string, trigger: "initial" | "manual", actorId: string): Promise<SyncOutcome> {
  try {
    const r = await syncAdAccount(adAccountId, trigger, { actorId });
    return { adAccountId, ok: r.ok, rowsWritten: r.rowsWritten, ...(r.ok ? {} : { error: r.error || SYNC_FAILED }) };
  } catch (err) {
    console.error("[vyz] sincronização", adAccountId, err instanceof Error ? err.message : "erro desconhecido");
    return { adAccountId, ok: false, rowsWritten: 0, error: SYNC_FAILED };
  }
}

/** Duas contas por vez: rápido no simulado sem pesar no banco. */
async function runSyncs(ids: string[], trigger: "initial" | "manual", actorId: string): Promise<SyncOutcome[]> {
  const out: SyncOutcome[] = [];
  for (let i = 0; i < ids.length; i += 2) out.push(...(await Promise.all(ids.slice(i, i + 2).map((id) => runSync(id, trigger, actorId)))));
  return out;
}

export type EnabledAccountsResult = {
  enabledCount: number;
  /** Sincronizações iniciais já concluídas (modo simulado). */
  synced: SyncOutcome[];
  /** Sincronização seguindo depois da resposta (API real). */
  syncing: boolean;
};

/**
 * Define as contas ativas de uma plataforma (admin). O limite do plano vale no
 * banco (gatilho): passou, nada muda e volta a mensagem do plano. As contas
 * recém-ativadas fazem a sincronização inicial (90 dias).
 */
export async function setEnabledAccounts(platformId: string, adAccountIds: string[], projectOf: Record<string, string> = {}): Promise<ActionResult<EnabledAccountsResult>> {
  try {
    const parsed = z
      .object({ platformId: Platform, ids: z.array(Id).max(500), projects: z.record(Id, Id) })
      .safeParse({ platformId, ids: adAccountIds, projects: projectOf });
    if (!parsed.success) throw appError("validation");
    const session = await authorize("admin");
    const ws = session.workspace.id;
    const platform = parsed.data.platformId;
    const ids = [...new Set(parsed.data.ids)];
    const supabase = await createServerSupabase();

    // A lista do navegador é só a escolha: o que existe e o estado de cada conta vêm do banco.
    const rows = unwrap(await supabase.from("ad_accounts").select("id, name, status, is_enabled, connection_id, project_id").eq("workspace_id", ws).eq("platform_id", platform)) ?? [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (ids.some((id) => !byId.has(id))) throw appError("not_found", "Alguma das contas escolhidas não está neste workspace.");
    const blocked = ids.map((id) => byId.get(id)!).find((r) => !r.connection_id || r.status !== "active");
    if (blocked) {
      const why = blocked.connection_id ? "o login conectado não dá mais acesso a ela" : "ela está sem conexão; reconecte o login";
      throw appError("account:not_connected", `“${blocked.name}” não pode ser ativada: ${why}.`);
    }

    // projeto de cada conta escolhida: as que saem do projeto saem antes (liberam espaço), depois as que entram
    const moves = ids.filter((id) => parsed.data.projects[id] && parsed.data.projects[id] !== byId.get(id)!.project_id);
    for (const id of moves) unwrap(await supabase.from("ad_accounts").update({ project_id: parsed.data.projects[id] }).eq("id", id).eq("workspace_id", ws));

    const before = new Set(rows.filter((r) => r.is_enabled).map((r) => r.id));
    const enabledCount = unwrap(await supabase.rpc("set_enabled_ad_accounts", { p_workspace_id: ws, p_platform_id: platform, p_ad_account_ids: ids })) ?? 0;
    const added = ids.filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !ids.includes(id));
    if (added.length || removed.length) {
      await logActivity({ workspaceId: ws, actorId: session.user.id, event: "ad_accounts.selection_changed", metadata: { platform, enabled: added, disabled: removed, total: enabledCount } });
    }

    let synced: SyncOutcome[] = [];
    const mock = isMockIntegrations();
    if (added.length && mock) synced = await runSyncs(added, "initial", session.user.id);
    else if (added.length) after(() => runSyncs(added, "initial", session.user.id));

    refresh();
    return { ok: true, data: { enabledCount, synced, syncing: !mock && added.length > 0 } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Revoga no provedor (melhor esforço): a conexão sai do VYZ de qualquer jeito. */
async function revokeAtProvider(admin: DB, conn: { id: string; provider: ProviderId; is_mock: boolean }) {
  try {
    const provider = providerForConnection(conn);
    const tokens = await readConnectionTokens(conn.id, admin);
    if (tokens && provider.revoke) await provider.revoke({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    console.error("[vyz] revogação no provedor", conn.provider, err instanceof Error ? err.message : "erro desconhecido");
  }
}

/**
 * Desconecta um login (admin): revoga no provedor, apaga a conexão e os tokens
 * (Vault) e tira as contas dela do ar. Os dados já importados ficam. Não exige
 * assinatura ativa: tirar o acesso nunca depende de pagar.
 */
export async function disconnect(connectionId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(connectionId).success) throw appError("validation");
    const session = await authorize("admin", { access: false });
    const ws = session.workspace.id;
    const supabase = await createServerSupabase();
    const conn = unwrap(await supabase.from("connections").select("id, provider, is_mock").eq("id", connectionId).eq("workspace_id", ws).maybeSingle());
    if (!conn) throw appError("integration:not_found");
    const { count } = await supabase.from("ad_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("connection_id", conn.id).eq("is_enabled", true);

    // Chave de serviço: conexões e tokens não têm escrita para usuários (o Vault só abre
    // para o servidor). O papel admin neste workspace foi conferido acima.
    const ctx = await requestContext();
    const admin = createAdminSupabase({ actorId: session.user.id, forwardHeaders: ctx.forwardHeaders });
    await revokeAtProvider(admin, conn);
    unwrap(await admin.from("connections").delete().eq("id", conn.id).eq("workspace_id", ws));

    await logActivity({
      workspaceId: ws,
      actorId: session.user.id,
      event: "integration.disconnected",
      entityType: "connection",
      entityId: conn.id,
      metadata: { provider: conn.provider, accounts_disabled: count ?? 0, mock: conn.is_mock },
    });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Sincroniza agora os últimos 7 dias de uma conta ativa (member). */
export async function resyncAccount(adAccountId: string): Promise<ActionResult<SyncOutcome & { syncing: boolean }>> {
  try {
    if (!Id.safeParse(adAccountId).success) throw appError("validation");
    const session = await authorize("member");
    const supabase = await createServerSupabase();
    const account = unwrap(await supabase.from("ad_accounts").select("id, is_enabled, connection_id").eq("id", adAccountId).eq("workspace_id", session.workspace.id).maybeSingle());
    if (!account) throw appError("not_found", "Conta não encontrada.");
    if (!account.is_enabled || !account.connection_id) throw appError("integration:account_inactive", "Ative a conta antes de sincronizar.");

    if (!isMockIntegrations()) {
      after(() => runSync(account.id, "manual", session.user.id));
      return { ok: true, data: { adAccountId: account.id, ok: true, rowsWritten: 0, syncing: true } };
    }
    const result = await runSync(account.id, "manual", session.user.id);
    refresh();
    if (!result.ok) return { ok: false, error: { code: "sync:failed", message: result.error ?? SYNC_FAILED } };
    return { ok: true, data: { ...result, syncing: false } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

const ManualInput = z
  .object({
    platformId: z.string().max(32),
    name: z.string().max(200).optional(),
    values: z.record(z.string().max(32), z.string().max(200)),
  })
  .strict();

export type ManualAccountInput = z.input<typeof ManualInput>;

/**
 * Cadastra uma conta pelo ID (admin), para as plataformas sem login no VYZ.
 * Fica "Aguardando conexão" (status pending): não sincroniza nem conta no limite.
 */
export async function addManualAccount(input: ManualAccountInput): Promise<ActionResult<{ id: string; name: string; platformId: PlatformId }>> {
  try {
    const parsed = ManualInput.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const { platformId, name, values } = parsed.data;
    if (isProviderId(platformId)) throw appError("integration:use_oauth", `${PROVIDERS[platformId].name} entra pelo botão Conectar, com o login da plataforma.`);
    if (!isManualPlatform(platformId)) throw appError("validation");

    const session = await authorize("admin");
    if (!canUse(session.access.tier ?? "base", PLATFORMS[platformId].tier)) throw appError("plan:platform");
    const check = buildManualAccount({ platformId, name, values });
    if (!check.ok) throw appError("validation", undefined, check.errors);

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("ad_accounts")
      .insert({ ...check.row, workspace_id: session.workspace.id, status: "pending" })
      .select("id, name")
      .single();
    if (error) throw error.code === "23505" ? appError("conflict", "Essa conta já está cadastrada neste workspace.") : fromPostgrest(error);

    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "ad_account.added", entityType: "ad_account", entityId: data.id, metadata: { platform: platformId, manual: true } });
    refresh();
    return { ok: true, data: { id: data.id, name: data.name, platformId } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/**
 * Remove uma conta sem conexão (admin): cadastrada pelo ID ou que ficou de uma
 * conexão desfeita. Apaga também os dados importados dela e a tira dos
 * dashboards. As contas de um login conectado saem pelo liga/desliga.
 */
export async function removeAdAccount(adAccountId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(adAccountId).success) throw appError("validation");
    const session = await authorize("admin", { access: false });
    const supabase = await createServerSupabase();
    const account = unwrap(await supabase.from("ad_accounts").select("id, platform_id, connection_id").eq("id", adAccountId).eq("workspace_id", session.workspace.id).maybeSingle());
    if (!account) throw appError("not_found", "Conta não encontrada.");
    if (account.connection_id) throw appError("integration:account_connected", "Esta conta vem de um login conectado: desative-a ou desconecte o login.");

    unwrap(await supabase.from("ad_accounts").delete().eq("id", account.id).eq("workspace_id", session.workspace.id));
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "ad_account.removed", entityType: "ad_account", entityId: account.id, metadata: { platform: account.platform_id } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
