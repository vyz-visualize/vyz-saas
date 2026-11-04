import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { parseCreativesQuery } from "@/features/analytics/creatives/query";
import { sampleCreatives, sampleExtras } from "@/features/analytics/creatives/sample";
import { LiveDashboard, LiveDashboardSkeleton } from "@/features/analytics/LiveDashboard";
import { periodFromQuery } from "@/features/dashboards/model";
import { PeriodNav } from "@/features/dashboards/PeriodNav";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import { anyDashboardTemplate } from "@/features/templates/live";
import { PublicShell, ShareMessage } from "@/features/share/SharedDashboard";
import { openSharedDashboard } from "@/server/share/public";

// Sem título com o nome do dashboard: o link pode circular.
export const metadata: Metadata = { title: "Dashboard compartilhado", referrer: "no-referrer" };

// Bloqueante de propósito (sem Suspense em volta): o token é conferido antes de
// a resposta começar, para o link inválido responder 404 de verdade. Os dados
// do dashboard continuam chegando por streaming, dentro do LiveDashboard.
export const instant = false;

// O token só é conferido no servidor (hash, validade, limite por IP). Depois de
// validado, o dashboard é lido com a chave de serviço, só leitura.
export default async function Page({ params, searchParams }: PageProps<"/r/[token]">) {
  await connection();
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const shared = await openSharedDashboard(token);
  if (shared.kind === "invalid") notFound();
  if (shared.kind !== "ok") return <ShareMessage kind={shared.kind} />;

  const d = shared.dashboard;
  const { period, customDays } = periodFromQuery(query, d.settings);
  const q = parseCreativesQuery(query);
  // o link mostra o que o plano do dono cobre, sem oferta de plano para o cliente final
  const access = { tier: shared.tier, tab: q.tab, ads: q.ads, upsell: false };
  const note = d.live ? "Somente leitura · dados das contas conectadas" : "Somente leitura · dados de exemplo";

  if (d.live) {
    return (
      <PublicShell brand={shared.brand} note={note}>
        <Suspense key={`${period}:${customDays}`} fallback={<LiveDashboardSkeleton />}>
          <LiveDashboard
            dashboardId={d.id}
            period={period}
            customDays={customDays}
            pageIds={d.pages}
            initialPage={q.page}
            creatives={access}
            metricPrefs={d.metricPrefs}
            hideSpend={shared.hideSpend}
            db={shared.db}
            toolbar={<PeriodNav period={period} customDays={customDays} />}
          />
        </Suspense>
      </PublicShell>
    );
  }

  const template = anyDashboardTemplate(d.templateId);
  return (
    <PublicShell brand={shared.brand} note={note}>
      <SampleDashboard
        dashboard={{ id: d.id, templateId: d.templateId, name: d.name, client: d.client, pages: d.pages, settings: { ...d.settings, period, customDays }, metricPrefs: d.metricPrefs }}
        brand={{ color: shared.brand.color ?? "", logo: undefined, hideVyz: true }}
        hideSpend={shared.hideSpend}
        initialPage={q.page}
        creatives={template ? sampleCreatives(template, { name: d.name, client: d.client, settings: d.settings }, d.pages, access, { period, customDays, hideSpend: shared.hideSpend }) : undefined}
        extraMetrics={template ? sampleExtras(template, { name: d.name, client: d.client, settings: d.settings }, { period, customDays, hideSpend: shared.hideSpend }) : undefined}
      />
    </PublicShell>
  );
}
