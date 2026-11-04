import "server-only";

// Leituras das landing pages. No painel, com o RLS de quem está logado (membros
// leem). A página pública lê com a chave de serviço só a LP publicada daquele
// endereço, em cache por endereço (as actions expiram a tag ao mudar).

import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { landingDefaults, landingTemplate, type LandingContent } from "@/features/templates/landing-pages";
import type { WorkspaceSession } from "@/features/workspace/session";
import type { Tracking } from "@/features/workspace/types";
import { columnsToTracking, readStoredContent, type LandingPageDTO, type LandingStatus, type LandingVersionDTO, type StoredContent } from "@/features/landing-pages/model";
import type { Tables } from "@/lib/supabase/database.types";
import { publicAssetUrl } from "@/lib/supabase/storage";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

export const LANDING_SELECT =
  "id, workspace_id, template_id, name, slug, content, gtm_container_id, meta_pixel_id, google_ads_conversion, ga4_measurement_id, status, published_at, created_at, updated_at";

export type LandingRow = Pick<
  Tables<"landing_pages">,
  | "id"
  | "workspace_id"
  | "template_id"
  | "name"
  | "slug"
  | "content"
  | "gtm_container_id"
  | "meta_pixel_id"
  | "google_ads_conversion"
  | "ga4_measurement_id"
  | "status"
  | "published_at"
  | "created_at"
  | "updated_at"
>;

/** Tag do cache da página pública. */
export const publicLandingTag = (slug: string) => `landing:${slug}`;

/** Conteúdo do banco (com logoPath) → conteúdo do renderer (com a URL do logo). */
export function toRenderContent(templateId: string, raw: unknown): { content: LandingContent; stored: StoredContent } {
  const t = landingTemplate(templateId);
  const fallback = t ? landingDefaults(t) : landingDefaults(landingTemplate("captura-leads")!);
  const stored = readStoredContent(raw, fallback);
  const { logoPath, ...rest } = stored;
  return { stored, content: { ...rest, logo: publicAssetUrl(logoPath) ?? undefined } };
}

export function toLandingDTO(r: LandingRow): LandingPageDTO {
  const { content } = toRenderContent(r.template_id, r.content);
  // A publicação grava updated_at e published_at na mesma transação (mesmo now()).
  const changed = r.status === "published" && !!r.published_at && Date.parse(r.updated_at) - Date.parse(r.published_at) > 1000;
  return {
    id: r.id,
    templateId: r.template_id,
    name: r.name,
    slug: r.slug,
    content,
    tracking: columnsToTracking(r),
    status: r.status as LandingStatus,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hasUnpublishedChanges: changed,
  };
}

async function currentSession() {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  return session;
}

/** LPs do workspace aberto, as mais recentes primeiro. */
export const listLandingPages = cache(async (): Promise<LandingPageDTO[]> => {
  const session = await currentSession();
  const supabase = await createServerSupabase();
  const rows =
    unwrap(await supabase.from("landing_pages").select(LANDING_SELECT).eq("workspace_id", session.workspace.id).neq("status", "archived").order("updated_at", { ascending: false })) ?? [];
  return rows.map(toLandingDTO);
});

/** Uma LP do workspace aberto (null se não existe ou é de outro workspace). */
export const getLandingPage = cache(async (id: string): Promise<LandingPageDTO | null> => {
  const session = await currentSession();
  const supabase = await createServerSupabase();
  const row = unwrap(await supabase.from("landing_pages").select(LANDING_SELECT).eq("workspace_id", session.workspace.id).eq("id", id).maybeSingle());
  return row ? toLandingDTO(row) : null;
});

/** Versões publicadas (a mais nova primeiro) com o nome de quem publicou, quando visível. */
export async function listLandingVersions(id: string, limit = 20): Promise<LandingVersionDTO[]> {
  const session = await currentSession();
  const supabase = await createServerSupabase();
  const rows =
    unwrap(
      await supabase
        .from("landing_page_versions")
        .select("version, published_at, published_by")
        .eq("workspace_id", session.workspace.id)
        .eq("landing_page_id", id)
        .order("version", { ascending: false })
        .limit(limit),
    ) ?? [];
  const ids = [...new Set(rows.map((r) => r.published_by).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of data ?? []) names.set(p.id, p.full_name || p.email || "");
  }
  return rows.map((r) => ({ version: r.version, publishedAt: r.published_at, publishedBy: (r.published_by && names.get(r.published_by)) || null }));
}

export type RenderableLanding = {
  id: string;
  slug: string;
  templateId: string;
  content: LandingContent;
  tracking: Tracking;
  hideBadge: boolean;
  status: LandingStatus;
};

/**
 * LP publicada pelo endereço, para visitantes sem login. Chave de serviço
 * porque o visitante não tem acesso ao banco; o filtro status = published é a
 * autorização. Só sai o necessário para renderizar (sem ids de quem criou).
 */
export async function getPublishedLanding(slug: string): Promise<RenderableLanding | null> {
  "use cache";
  cacheTag(publicLandingTag(slug));
  cacheLife("hours");
  const admin = createAdminSupabase();
  const { data: row, error } = await admin.from("landing_pages").select(LANDING_SELECT).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) {
    console.error("[vyz] LP pública", error.code);
    return null;
  }
  if (!row) return null;
  const [access, version] = await Promise.all([
    admin.from("workspace_access").select("has_access, hide_vyz_brand_effective").eq("workspace_id", row.workspace_id).maybeSingle(),
    // No ar fica a última versão publicada; o rascunho editado depois só entra ao republicar.
    admin.from("landing_page_versions").select("content, tracking").eq("landing_page_id", row.id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Sem assinatura ativa a página sai do ar (o dado fica; volta ao reativar).
  if (!access.data?.has_access) return null;
  const v = version.data;
  const { content } = toRenderContent(row.template_id, v?.content ?? row.content);
  const t = v?.tracking && typeof v.tracking === "object" && !Array.isArray(v.tracking) ? (v.tracking as Record<string, unknown>) : null;
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    id: row.id,
    slug: row.slug,
    templateId: row.template_id,
    content,
    tracking: t ? { gtm: str(t.gtm), pixel: str(t.pixel), adsConversion: str(t.adsConversion), ga4: str(t.ga4) } : columnsToTracking(row),
    hideBadge: !!access.data.hide_vyz_brand_effective,
    status: "published",
  };
}

/** Prévia do rascunho para quem é do workspace (RLS: membros de qualquer papel leem). */
export async function getLandingPreview(slug: string): Promise<RenderableLanding | null> {
  const session = await getWorkspaceSession();
  if (!session) return null;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase.from("landing_pages").select(LANDING_SELECT).eq("slug", slug).maybeSingle();
  if (!row) return null;
  const { data: access } = await supabase.from("workspace_access").select("hide_vyz_brand_effective").eq("workspace_id", row.workspace_id).maybeSingle();
  const { content } = toRenderContent(row.template_id, row.content);
  return {
    id: row.id,
    slug: row.slug,
    templateId: row.template_id,
    content,
    tracking: columnsToTracking(row),
    hideBadge: !!access?.hide_vyz_brand_effective,
    status: row.status as LandingStatus,
  };
}

/** Quem está logado já entrou na lista de espera deste workspace? (RLS: só a própria inscrição) */
export async function isOnLandingWaitlist(session: Pick<WorkspaceSession, "workspace" | "user">): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("landing_waitlist").select("id").eq("workspace_id", session.workspace.id).eq("user_id", session.user.id).maybeSingle();
  if (error) throw fromPostgrest(error);
  return !!data;
}
