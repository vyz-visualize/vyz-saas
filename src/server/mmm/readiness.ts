import "server-only";

// O que falta para o MMM de cada cliente de um dashboard (tela "MMM em construção"). Só leitura,
// com a chave de serviço: quem chama já conferiu que a pessoa pode ver o dashboard (painel ou link
// público). O histórico de investimento vem do schema mmm (a carga dos 37 meses, pela função
// public.mmm_historico_investimento) e das tabelas do app (os meses recentes); sem a função no
// banco, só as do app, e a tela diz isso.

import { isAdPlatform, PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { mmmReadiness, type MmmReadinessData, type MonthSpend, type OutcomeMonths } from "@/features/mmm/readiness";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import { createAdminSupabase } from "@/server/supabase/admin";

export type { MmmReadinessData };

type Acc = { id: string; platform_id: string; project_id: string | null };
const PAGE = 1000;
const month = (iso: string) => `${iso.slice(0, 7)}-01`;

/** Lê tudo em páginas de 1000 (o teto de linhas da API). */
async function paged<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export async function loadMmmReadiness(dashboardId: string, today: string): Promise<MmmReadinessData | null> {
  const db = createAdminSupabase();
  const { data: src, error } = await db.from("dashboard_sources").select("ad_account_id").eq("dashboard_id", dashboardId);
  if (error) throw error;
  const sourceIds = (src ?? []).map((s) => s.ad_account_id);
  if (!sourceIds.length) return null;
  const { data: linked } = await db.from("ad_accounts").select("id, platform_id, project_id").in("id", sourceIds);
  const accounts = (linked ?? []) as Acc[];
  const projectIds = [...new Set(accounts.map((a) => a.project_id).filter((p): p is string => !!p))];
  const { data: projectRows } = projectIds.length ? await db.from("projects").select("id, name").in("id", projectIds) : { data: [] };
  const projects = [...(projectRows ?? []).map((p) => ({ id: p.id, name: p.name })), ...(accounts.some((a) => !a.project_id) ? [{ id: "sem-projeto", name: "Sem cliente" }] : [])];
  const projectOf = (a: Acc) => a.project_id ?? "sem-projeto";

  // mídia: as contas de anúncio do dashboard
  const ads = accounts.filter((a) => a.platform_id in PLATFORMS && isAdPlatform(a.platform_id as PlatformId));
  const byId = new Map(ads.map((a) => [a.id, a]));
  const perMonth = new Map<string, MonthSpend>();
  // a mesma conta e mês nas duas fontes: fica a que tem o mês mais completo (o 1º mês do app começa no meio)
  const put = (a: Acc, m: string, spend: number, days: number, sumSq: number) => {
    const k = `${a.id}|${m}`;
    const cur = perMonth.get(k);
    if (cur && cur.days >= days) return;
    perMonth.set(k, { projectId: projectOf(a), platform: a.platform_id, month: m, spend, days, sumSq });
  };
  // 1. o que o app sincroniza (os meses recentes, completos e iguais ao resto do dashboard)
  const app = ads.length
    ? await paged((f, t) => db.from("insights_account_daily").select("ad_account_id, date, spend").in("ad_account_id", ads.map((a) => a.id)).gt("spend", 0).order("ad_account_id").order("date").range(f, t))
    : [];
  const appMonths = new Map<string, { spend: number; days: number; sumSq: number }>();
  for (const r of app) {
    const k = `${r.ad_account_id}|${month(r.date)}`;
    const v = appMonths.get(k) ?? { spend: 0, days: 0, sumSq: 0 };
    const s = Number(r.spend);
    appMonths.set(k, { spend: v.spend + s, days: v.days + 1, sumSq: v.sumSq + s * s });
  }
  for (const [k, v] of appMonths) {
    const [id, m] = k.split("|");
    const a = byId.get(id);
    if (a) put(a, m, v.spend, v.days, v.sumSq);
  }
  // 2. a carga do histórico do MMM (os meses que o app não tem)
  let fullHistory = true;
  if (ads.length) {
    const r = await db.rpc("mmm_historico_investimento", { p_ad_account_ids: ads.map((a) => a.id) });
    if (r.error) fullHistory = false;
    else
      for (const row of r.data ?? []) {
        const a = byId.get(row.ad_account_id);
        if (a) put(a, month(row.mes), Number(row.investimento), row.dias_com_gasto, Number(row.soma_quadrados));
      }
  }

  // resultado independente: GA4, CRM (os do projeto, ligados a este ou a outro dashboard) e a planilha deste
  const { data: projectAccounts } = projectIds.length
    ? await db.from("ad_accounts").select("id, platform_id, project_id, is_enabled").in("project_id", projectIds).in("platform_id", ["ga4", ...CRM_PLATFORMS])
    : { data: [] };
  const outcomeAccounts = [...((projectAccounts ?? []) as (Acc & { is_enabled: boolean })[]), ...accounts.filter((a) => !a.project_id && (a.platform_id === "ga4" || (CRM_PLATFORMS as readonly string[]).includes(a.platform_id))).map((a) => ({ ...a, is_enabled: true }))];
  const outcomes: OutcomeMonths[] = [];
  const ga4 = outcomeAccounts.filter((a) => a.platform_id === "ga4");
  if (ga4.length) {
    const rows = await paged((f, t) => db.from("analytics_daily").select("ad_account_id, date, key_events, transactions, revenue").in("ad_account_id", ga4.map((a) => a.id)).order("ad_account_id").order("date").range(f, t));
    for (const a of ga4) outcomes.push({ projectId: projectOf(a), source: "ga4", connected: a.is_enabled, months: rows.filter((r) => r.ad_account_id === a.id && (Number(r.key_events) > 0 || r.transactions > 0 || Number(r.revenue) > 0)).map((r) => r.date.slice(0, 7)) });
  }
  const crm = outcomeAccounts.filter((a) => (CRM_PLATFORMS as readonly string[]).includes(a.platform_id));
  if (crm.length) {
    const rows = await paged((f, t) => db.from("crm_daily").select("ad_account_id, date, leads, won").in("ad_account_id", crm.map((a) => a.id)).eq("stage", "*").order("ad_account_id").order("date").range(f, t));
    for (const a of crm) outcomes.push({ projectId: projectOf(a), source: "crm", connected: a.is_enabled, months: rows.filter((r) => r.ad_account_id === a.id && (r.leads > 0 || r.won > 0)).map((r) => r.date.slice(0, 7)) });
  }
  // a planilha do lançamento é do dashboard: vale para cada cliente dele
  const { data: sheet } = await db.from("dashboard_launch_sheets").select("rows").eq("dashboard_id", dashboardId).maybeSingle();
  const sheetRows = Array.isArray(sheet?.rows) ? (sheet.rows as { date?: unknown }[]) : [];
  const sheetMonths = sheetRows.map((r) => (typeof r.date === "string" ? r.date.slice(0, 7) : "")).filter(Boolean);
  if (sheet) for (const p of projects) outcomes.push({ projectId: p.id, source: "planilha", connected: true, months: sheetMonths });

  return { projects: mmmReadiness(projects, [...perMonth.values()], outcomes, today), fullHistory, today };
}
