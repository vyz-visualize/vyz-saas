import type { Metadata } from "next";
import { canArrangeLayout } from "@/features/dashboards/layout/model";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LockedPages } from "@/features/dashboards/LockedPages";
import { EmptyState } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { parseCreativesQuery } from "@/features/analytics/creatives/query";
import { parseFilters } from "@/features/analytics/filters";
import { sampleCreatives, sampleExtras } from "@/features/analytics/creatives/sample";
import { LiveDashboard, LiveDashboardSkeleton } from "@/features/analytics/LiveDashboard";
import { brandVars } from "@/features/dashboards/brand";
import { DashboardActions } from "@/features/dashboards/DashboardActions";
import { periodFromQuery } from "@/features/dashboards/model";
import { BrandMark } from "@/features/dashboards/DashboardBody";
import { PeriodNav } from "@/features/dashboards/PeriodNav";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import { DashboardSkeleton } from "@/features/dashboards/BuildingDashboard";
import { anyDashboardTemplate } from "@/features/templates/live";
import { FocusBarActions } from "@/features/workspace/FocusBarActions";
import { hasRole } from "@/features/workspace/session";
import { requireWorkspace } from "@/server/auth/workspace";
import { getDashboard } from "@/server/dashboards/queries";
import { loadDashboardData } from "@/server/dashboards/real-data";
import { getMyGuides } from "@/server/guides/queries";
import { createServerSupabase } from "@/server/supabase/server";
import { tourPending } from "@/features/onboarding/guides";
import { DashboardTour } from "@/features/onboarding/DashboardTour";
import { SampleNotice } from "@/features/dashboards/SampleNotice";
import { SyncStamp } from "@/features/dashboards/SyncStamp";
import { isSamePageNavigation } from "@/server/http/request";
import { logActivity } from "@/server/history/log";
import { hasCoverSkin } from "@/features/dashboards/skins/blocks";
import { loadCoverData } from "@/server/dashboards/cover";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page({ params, searchParams }: PageProps<"/painel/dashboards/[id]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Ver params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// Sessão, banco e ?periodo= são dados da requisição. Trocar o período navega
// (?periodo=…&dias=…) e o servidor desenha de novo; os números vêm do cache por conta.
async function Ver({ params, searchParams }: Pick<PageProps<"/painel/dashboards/[id]">, "params" | "searchParams">) {
  await connection();
  const { id } = await params;
  const session = await requireWorkspace({ next: `/painel/dashboards/${id}` });
  const [d, query] = await Promise.all([getDashboard(id), searchParams]);
  if (!d)
    return (
      <EmptyState
        title="Dashboard não encontrado"
        text="Ele pode ter sido apagado ou ser de outro workspace."
        action={
          <Link href="/painel/dashboards" className={btn.small}>
            Ver meus dashboards
          </Link>
        }
      />
    );

  const { period, customDays } = periodFromQuery(query, d.settings);
  const filters = parseFilters(query);
  // só a abertura da página conta: filtrar, limpar e trocar o período não
  if (!(await isSamePageNavigation(`/painel/dashboards/${d.id}`))) {
    await logActivity({
      workspaceId: session.workspace.id,
      actorId: session.user.id,
      event: "dashboard.viewed",
      entityType: "dashboard",
      entityId: d.id,
      metadata: { period, live: d.live },
    });
  }
  const canEdit = hasRole(session.role, "member");
  // tour do primeiro dashboard: uma vez por pessoa (user_guides); sem a tabela no banco, não aparece
  const tour = tourPending(await getMyGuides(session.user.id));
  const ws = session.workspace;
  const whiteLabel = !!session.access.entitlements?.whiteLabel;
  // logo e cor da empresa em todos os planos; cor própria por dashboard e "ocultar VYZ" só no Personalizado
  const color = (whiteLabel && d.brand?.color) || ws.brandColor || null;
  const brand = { color: color ?? "", logo: ws.brandLogoUrl ?? undefined, hideVyz: whiteLabel && (ws.hideVyzBrand || !!d.brand?.hideVyz) };
  const q = parseCreativesQuery(query);
  const access = { tier: session.access.tier, tab: q.tab, ads: q.ads, upsell: true };
  const actions = canEdit ? <DashboardActions dashboard={{ id: d.id, name: d.name, live: d.live }} period={period} pages={d.pages.length} editInPlace /> : undefined;

  // páginas do layout que o plano ainda não libera: vitrine borrada no fim
  const upsell = <LockedPages templateId={d.templateId} tier={session.access.tier} pagesTier={session.access.entitlements?.pages ?? null} />;

  if (d.live) {
    return (
      <div style={brandVars(color)}>
        {/* editar, compartilhar e exportar ficam na barra do topo da tela, não no dashboard */}
        <FocusBarActions>{actions}</FocusBarActions>
        <Suspense key={`${period}:${customDays}`} fallback={<LiveDashboardSkeleton />}>
          <LiveDashboard
            dashboardId={d.id}
            period={period}
            customDays={customDays}
            pageIds={d.pages}
            initialPage={q.page}
            creatives={access}
            metricPrefs={d.metricPrefs}
            filters={filters}
            canCustomize={canEdit}
            toolbar={<PeriodNav period={period} customDays={customDays} />}
            logo={<BrandMark brand={brand} />}
            autoRefresh
          />
        </Suspense>
        {upsell}
        {tour && <DashboardTour />}
      </div>
    );
  }

  const template = anyDashboardTemplate(d.templateId);
  // contas ligadas: o modelo desenha com os dados reais delas; sem nenhuma, a amostra (com o aviso fixo)
  const { realData, linkedPlatforms, sourceExtras, sync } = await loadDashboardData(d, template, { period, customDays });
  const sample = !realData;
  // "Conectar" no aviso: com conta ativa no workspace, liga ao dashboard (editar); sem nenhuma, conecta em Contas
  const hasEnabledAccounts = sample ? await workspaceHasEnabledAccounts(session.workspace.id) : false;
  // visuais com capa: a imagem, o endereço e a planilha do lançamento
  const coverData = hasCoverSkin(template?.skin) ? await loadCoverData(await createServerSupabase(), d.id, session.workspace.id) : undefined;
  return (
    <>
      {sample && <SampleNotice connectHref={hasEnabledAccounts ? `/painel/dashboards/${d.id}/editar` : "/painel/contas"} canConnect={canEdit} />}
      <SampleDashboard
        realData={realData}
        sampleOnly={sample}
        linkedPlatforms={linkedPlatforms}
        sourceExtras={sourceExtras}
        syncStamp={sync?.lastSyncedAt ? <SyncStamp dashboardId={d.id} lastSyncedAt={sync.lastSyncedAt} timeZone={sync.timeZone} autoRefresh /> : undefined}
        dashboard={{
          id: d.id,
          templateId: d.templateId,
          name: d.name,
          client: d.client,
          pages: d.pages,
          settings: { ...d.settings, period, customDays },
          metricPrefs: d.metricPrefs,
          layout: d.layout,
          metricGoals: d.metricGoals,
        }}
        brand={brand}
        canEdit={canEdit}
        coverData={coverData}
        canArrange={canArrangeLayout(session.access.tier)}
        assemble={query.novo === "1"}
        initialPage={q.page}
        initialFilters={filters}
        backHref="/painel/dashboards"
        creatives={
          template && !realData ? sampleCreatives(template, { name: d.name, client: d.client, settings: d.settings }, d.pages, access, { period, customDays, filters }) : undefined
        }
        extraMetrics={template && !realData ? sampleExtras(template, { name: d.name, client: d.client, settings: d.settings }, { period, customDays, filters }) : undefined}
      />
      {/* no modelo que toma a tela toda, a vitrine ganha de volta o respiro da página (globals.css) */}
      <div className="focus-extra">{upsell}</div>
      {tour && <DashboardTour />}
    </>
  );
}

/** O workspace tem alguma conta ativa (só para o destino do "Conectar" do aviso de dados de exemplo). */
async function workspaceHasEnabledAccounts(workspaceId: string): Promise<boolean> {
  const db = await createServerSupabase();
  const { count } = await db.from("ad_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("is_enabled", true).not("connection_id", "is", null);
  return (count ?? 0) > 0;
}
