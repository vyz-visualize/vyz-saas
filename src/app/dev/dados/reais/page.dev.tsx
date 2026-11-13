// Bancada com dados reais, só no `next dev` e só leitura: um dashboard de modelo de verdade
// (?id=), lido pelo mesmo caminho do painel; ?visual= e ?objetivo= trocam o modelo. ?capa=1 troca a miniatura gravada pela capa
// grande que o próximo sync grava (busca na Meta só com GET; nada é escrito no banco).

import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { parseMetricPrefs } from "@/features/dashboards/metric-prefs";
import { datasetFromWarehouse } from "@/features/metrics/warehouse-dataset";
import { LINKABLE_SOURCES } from "@/features/templates/dashboards/composed";
import { anyDashboardTemplate } from "@/features/templates/live";
import { loadTemplateWarehouse } from "@/server/analytics/queries";
import { readConnectionTokens } from "@/server/integrations/tokens";
import { createAdminSupabase } from "@/server/supabase/admin";
import { AD_CREATIVE_FIELDS } from "@/server/sync/live/meta";
import { RealHarness } from "./harness";

export const metadata = { title: "Dados reais (desenvolvimento)", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Real searchParams={searchParams} />
    </Suspense>
  );
}

async function Real({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const q = await searchParams;
  if (!q.id) return <p className="p-6">Passe ?id= de um dashboard de modelo.</p>;
  const admin = createAdminSupabase();
  const { data: d } = await admin.from("dashboards").select("id, template_id, name, metric_prefs").eq("id", q.id).maybeSingle();
  // ?visual=pulso e ?objetivo=leads: o mesmo dashboard com outro visual ou outro objetivo
  const [visual, ...rest] = (d?.template_id ?? "").split("-");
  const templateId = d ? `${q.visual ?? visual}-${q.objetivo ?? rest.join("-")}` : undefined;
  const template = templateId ? anyDashboardTemplate(templateId) : undefined;
  if (!d || !template) return <p className="p-6">Dashboard não encontrado.</p>;
  const warehouse = await loadTemplateWarehouse(d.id, { platforms: template.composed ? LINKABLE_SOURCES : template.sources, period: "30d", db: admin });
  if (!warehouse) return <p className="p-6">Sem contas ligadas.</p>;
  let sets = warehouse.sets;
  if (q.capa === "1")
    sets = await Promise.all(
      sets.map(async (s) => {
        if (s.platform !== "meta") return s;
        // só os anúncios que aparecem no período (os da aba Criativos)
        const used = new Set(s.adDaily.filter((r) => r.date >= s.current.from && r.date <= s.current.to).map((r) => r.adId));
        const fresh = await biggerCovers(d.id, s.ads.filter((a) => used.has(a.id)));
        const byId = new Map(fresh.map((a) => [a.id, a]));
        return { ...s, ads: s.ads.map((a) => byId.get(a.id) ?? a) };
      }),
    );
  const dataset = datasetFromWarehouse(sets, { profile: template.profile, today: warehouse.today, current: warehouse.current, previous: warehouse.previous });
  return (
    <RealHarness
      dashboard={{ id: d.id, templateId: template.id, name: "Vendas da loja", client: "Lipe", pages: template.pages, settings: { ...DEFAULT_SETTINGS, period: "30d" }, metricPrefs: parseMetricPrefs(d.metric_prefs) }}
      dataset={dataset}
      linkedPlatforms={[...new Set(warehouse.accounts.map((a) => a.platform))] as never}
      page={q.pagina}
    />
  );
}

/** A capa grande (a do próximo sync) dos anúncios com gasto no período, direto da Meta, só leitura. */
async function biggerCovers<T extends { id: string; thumbnailUrl: string | null }>(dashboardId: string, ads: T[]): Promise<T[]> {
  const admin = createAdminSupabase();
  const { data: rows } = await admin.from("ads").select("id, external_id, ad_account_id").in("id", ads.map((a) => a.id));
  const { data: accts } = await admin.from("dashboard_sources").select("account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(id, connection_id, external_id)").eq("dashboard_id", dashboardId);
  const conn = new Map((accts ?? []).map((s) => [s.account?.id, `${s.account?.connection_id}|${s.account?.external_id}`]));
  const byExternal = new Map<string, string>();
  const groups = new Map<string, string[]>();
  for (const r of rows ?? []) {
    const c = conn.get(r.ad_account_id);
    if (!c) continue;
    byExternal.set(r.external_id, r.id);
    groups.set(c, [...(groups.get(c) ?? []), r.external_id]);
  }
  const fresh = new Map<string, string>();
  console.warn("[dev] capas: anúncios", rows?.length ?? 0, "conexões", groups.size);
  const batches: [string, string[]][] = [];
  for (const [connectionId, all] of groups) for (let i = 0; i < all.length; i += 50) batches.push([connectionId, all.slice(i, i + 50)]);
  for (const [connectionId, ids] of batches) {
    const token = (await readConnectionTokens(connectionId.split("|")[0]))?.accessToken;
    if (!token) continue;
    const { createHmac } = await import("node:crypto");
    const secret = process.env.META_APP_SECRET;
    // a mesma aresta do sync (o modificador do tamanho só vale nela), filtrada pelos anúncios
    const [, external] = connectionId.split("|");
    const act = external.startsWith("act_") ? external : `act_${external}`;
    const u = new URL(`https://graph.facebook.com/v26.0/${act}/ads`);
    u.searchParams.set("fields", `id,${AD_CREATIVE_FIELDS}`);
    u.searchParams.set("filtering", JSON.stringify([{ field: "ad.id", operator: "IN", value: ids }]));
    u.searchParams.set("limit", "100");
    if (secret) u.searchParams.set("appsecret_proof", createHmac("sha256", secret).update(token).digest("hex"));
    // o token vai no cabeçalho, nunca na URL (que pode aparecer em log)
    const r = await fetch(u, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const e = (await r.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
      console.warn("[dev] capas", r.status, e?.error?.code, e?.error?.message?.slice(0, 140));
      continue;
    }
    const j = (await r.json()) as { data?: { id: string; creative?: { thumbnail_url?: string } }[] };
    for (const v of j.data ?? []) if (v.creative?.thumbnail_url) fresh.set(byExternal.get(v.id) ?? "", v.creative.thumbnail_url);
  }
  console.warn("[dev] capas grandes:", fresh.size);
  return ads.map((a) => ({ ...a, thumbnailUrl: fresh.get(a.id) ?? a.thumbnailUrl }));
}
