import "server-only";

// Abertura de um link público (/r/<token>), sem sessão. Ordem: limite por IP,
// formato do token, busca pelo hash com a chave de serviço (o visitante não tem
// RLS), validade (não revogado, não expirado, workspace com assinatura ativa).
// Só depois disso a página usa o admin para ler o dashboard. O contador de
// visitas e o histórico são gravados depois da resposta.

import { after } from "next/server";
import type { DashboardDetail } from "@/features/dashboards/model";
import type { Tier } from "@/features/pricing/entitlements";
import { parsePlanDbId } from "@/features/pricing/pricing";
import { isShareToken, linkStatus } from "@/features/share/links";
import { publicAssetUrl } from "@/lib/supabase/storage";
import { fromJoined, DASHBOARD_SELECT, type JoinedDashboard } from "@/server/dashboards/queries";
import { logActivity } from "@/server/history/log";
import { requestContext } from "@/server/http/request";
import { hitRateLimit } from "@/server/security/rate-limit";
import { createAdminSupabase } from "@/server/supabase/admin";
import type { DB } from "@/server/supabase/server";
import { hashShareToken } from "./token";

export type PublicBrand = { color: string | null; logoUrl: string | null; hideVyz: boolean };

export type SharedDashboard =
  | { kind: "ok"; db: DB; linkId: string; hideSpend: boolean; dashboard: DashboardDetail; brand: PublicBrand; tier: Tier | null }
  | { kind: "invalid" | "expired" | "revoked" | "unavailable" | "rate_limited" };

export async function openSharedDashboard(token: string): Promise<SharedDashboard> {
  const { ip } = await requestContext();
  if (!(await hitRateLimit("share_view_ip", ip))) return { kind: "rate_limited" };
  if (!isShareToken(token)) return { kind: "invalid" };

  const admin = createAdminSupabase();
  const { data: link, error } = await admin
    .from("share_links")
    .select("id, workspace_id, dashboard_id, hide_spend, expires_at, revoked_at, view_count")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (error) {
    console.error("[vyz] link público", error.message);
    return { kind: "unavailable" };
  }
  if (!link) return { kind: "invalid" };
  const status = linkStatus({ revokedAt: link.revoked_at, expiresAt: link.expires_at }, new Date());
  if (status !== "active") return { kind: status };

  const [dash, access, ws] = await Promise.all([
    admin.from("dashboards").select(DASHBOARD_SELECT).eq("id", link.dashboard_id).eq("workspace_id", link.workspace_id).maybeSingle(),
    admin.from("workspace_access").select("has_access, plan_id, white_label, hide_vyz_brand_effective").eq("workspace_id", link.workspace_id).maybeSingle(),
    admin.from("workspaces").select("brand_color, brand_logo_path").eq("id", link.workspace_id).maybeSingle(),
  ]);
  if (dash.error || access.error || ws.error) {
    console.error("[vyz] link público", dash.error?.message ?? access.error?.message ?? ws.error?.message);
    return { kind: "unavailable" };
  }
  if (!dash.data) return { kind: "invalid" };
  // assinatura parada: o link não mostra dados até voltar
  if (!access.data?.has_access) return { kind: "unavailable" };

  const dashboard = fromJoined(dash.data as unknown as JoinedDashboard);
  const whiteLabel = !!access.data.white_label;
  const brand: PublicBrand = {
    color: whiteLabel ? dashboard.brand?.color || ws.data?.brand_color || null : null,
    logoUrl: whiteLabel ? publicAssetUrl(ws.data?.brand_logo_path) : null,
    hideVyz: !!access.data.hide_vyz_brand_effective || (whiteLabel && !!dashboard.brand?.hideVyz),
  };

  // Contador (batimento do servidor, sem auditoria) e histórico: depois da resposta
  after(async () => {
    const { error: e } = await admin.from("share_links").update({ view_count: link.view_count + 1, last_viewed_at: new Date().toISOString() }).eq("id", link.id);
    if (e) console.error("[vyz] contador do link", e.message);
  });
  await logActivity({ workspaceId: link.workspace_id, event: "share_link.viewed", entityType: "share_link", entityId: link.id, metadata: { dashboard_id: dashboard.id } });

  return { kind: "ok", db: admin, linkId: link.id, hideSpend: link.hide_spend, dashboard, brand, tier: parsePlanDbId(access.data.plan_id)?.tier ?? null };
}
