// Migra os dashboards dos modelos antigos para os modelos novos (visual + objetivo):
// o visual vem do visual próprio do modelo antigo (os outros viram o padrão VYZ), o
// objetivo vem do perfil, e as páginas saem das contas ligadas (composePages).
// Visual acima do plano do workspace cai para o padrão VYZ.
//   npx tsx --conditions=react-server --env-file=.env.local scripts/db/migrate-to-composed.ts          (simulação)
//   npx tsx --conditions=react-server --env-file=.env.local scripts/db/migrate-to-composed.ts --apply  (grava)

import { createAdminSupabase } from "@/server/supabase/admin";
import { anyDashboardTemplate } from "@/features/templates/live";
import { composedId, composePages, VISUALS, type ObjectiveId, type VisualId } from "@/features/templates/dashboards/composed";
import { canUse } from "@/features/pricing/entitlements";
import { parsePlanDbId } from "@/features/pricing/pricing";
import type { Profile } from "@/features/metrics/definitions";
import { PAGES } from "@/features/templates/pages";

const OBJ: Record<Profile, ObjectiveId> = { ecommerce: "ecommerce", marketplace: "ecommerce", executivo: "ecommerce", site: "ecommerce", midia: "ecommerce", pesquisa: "ecommerce", video: "ecommerce", leads: "leads", imob: "imob", local: "local", infoproduto: "infoproduto", saude: "saude", educacao: "educacao", agencia: "agencia" };
const apply = process.argv.includes("--apply");

async function main() {
  const db = createAdminSupabase();
  const { data: dashes, error } = await db.from("dashboards").select("id, name, workspace_id, template_id, sources:dashboard_sources(account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(platform_id, is_enabled))");
  if (error) throw error;
  const { data: access } = await db.from("workspace_access").select("workspace_id, plan_id, has_access");
  const tierOf = new Map((access ?? []).map((a) => [a.workspace_id, a.has_access ? (parsePlanDbId(a.plan_id)?.tier ?? "base") : "base"]));
  let n = 0;
  for (const d of dashes ?? []) {
    const t = anyDashboardTemplate(d.template_id);
    if (!t || t.composed) continue;
    const tier = tierOf.get(d.workspace_id) ?? "base";
    const wanted = (VISUALS.find((v) => v.skin && v.skin === t.skin)?.id ?? "vyz") as VisualId;
    const visual = canUse(tier as never, VISUALS.find((v) => v.id === wanted)!.tier) ? wanted : "vyz";
    const to = composedId(visual, OBJ[t.profile]);
    const platforms = [...new Set((d.sources ?? []).map((s: { account: { platform_id: string; is_enabled: boolean } | null }) => s.account?.platform_id).filter(Boolean) as string[])];
    // só as páginas que o plano libera (Público e Termos são do Padrão)
    const pages = composePages(platforms).filter((pg) => canUse(tier as never, PAGES[pg].tier));
    console.log(`${d.template_id} → ${to} | ${d.name.slice(0, 28)} | contas: ${platforms.join(",") || "-"} | páginas: ${pages.join(",")}`);
    n++;
    if (!apply) continue;
    const up = await db.from("dashboards").update({ template_id: to }).eq("id", d.id);
    if (up.error) throw up.error;
    const pg = await db.rpc("set_dashboard_pages", { p_dashboard_id: d.id, p_page_type_ids: pages });
    if (pg.error) throw pg.error;
  }
  console.log(`${n} dashboard(s) ${apply ? "migrados" : "a migrar (simulação)"}`);
}
main();
