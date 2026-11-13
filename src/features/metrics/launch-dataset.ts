// Planilha do lançamento por cima do Dataset: os números do funil de vendas (leads,
// atendimentos, visitas, propostas e vendas) passam a ser os da planilha, dia a dia, e
// tudo o que lê o Dataset acompanha (capa, cards, funil, CRM). O investimento, as
// impressões e os cliques continuam vindo das plataformas de anúncio.
//
// O que a planilha não traz não é inventado: dia fora dela fica zerado e etapa sem
// coluna sai do funil.

import type { LaunchColumn, LaunchRow } from "@/features/import/launch-sheet";
import { addDays } from "@/features/sync/dates";
import { isSalesProfile, type Profile } from "./definitions";
import type { CrmStage, Dataset, DayRow, FunnelStep, LaunchInfo } from "./source";

type DaySum = { leads: number; attended: number; visits: number; proposals: number; sales: number; value: number };
const ZERO: DaySum = { leads: 0, attended: 0, visits: 0, proposals: 0, sales: 0, value: 0 };

/**
 * Qual número da planilha é o resultado do objetivo: no imobiliário, o lead qualificado
 * (atendido); em venda, a venda; em agendamento (saúde), a visita; nos outros, o lead.
 * Sem a coluna na planilha, o lead.
 */
function resultKey(profile: Profile, has: (c: LaunchColumn) => boolean): keyof DaySum {
  if (isSalesProfile(profile) || profile === "educacao") return has("sales") ? "sales" : "leads";
  if (profile === "imob") return has("attended") ? "attended" : "leads";
  if (profile === "saude") return has("visits") ? "visits" : "leads";
  return "leads";
}

const STAGES: { key: keyof DaySum; column: LaunchColumn; label: string }[] = [
  { key: "leads", column: "leads", label: "Leads" },
  { key: "attended", column: "attended", label: "Atendimentos" },
  { key: "visits", column: "visits", label: "Visitas" },
  { key: "proposals", column: "proposals", label: "Propostas" },
  { key: "sales", column: "sales", label: "Vendas" },
];

/**
 * O Dataset com o funil da planilha. `today` (YYYY-MM-DD) é o dia de referência do
 * Dataset (o `ago` de cada linha conta a partir dele). `missing`: as colunas opcionais
 * que a planilha não trouxe (LaunchSummary.missing).
 */
export function withLaunchSheet(ds: Dataset, rows: readonly LaunchRow[], opts: { today: string; missing?: readonly LaunchColumn[] }): Dataset {
  if (!rows.length) return ds;
  const has = (c: LaunchColumn) => !opts.missing?.includes(c);
  const profile = ds.spec.profile;
  const result = resultKey(profile, has);

  const byDate = new Map<string, DaySum>();
  for (const r of rows) {
    const d = byDate.get(r.date) ?? { ...ZERO };
    d.leads += r.leads;
    d.attended += r.attended;
    d.visits += r.visits;
    d.proposals += r.proposals;
    d.sales += r.sales;
    d.value += r.value;
    byDate.set(r.date, d);
  }
  const dateOf = (d: DayRow) => addDays(opts.today, -d.ago);
  const apply = (d: DayRow): DayRow => {
    const s = byDate.get(dateOf(d)) ?? ZERO;
    return {
      ...d,
      leads: s.leads,
      qualified: has("attended") ? s.attended : 0,
      visits: has("visits") ? s.visits : 0,
      conversions: s[result],
      // receita só nos objetivos de venda (nos outros, o valor vendido fica na etapa Vendas)
      revenue: isSalesProfile(profile) && has("value") ? Math.round(s.value * 100) : d.revenue,
      // a planilha já traz o dia fechado: nada "em maturação"
      maturing: false,
    };
  };
  const current = ds.current.map(apply);
  const previous = ds.previous.map(apply);

  // totais do período atual, para o funil, as etapas e a origem
  const dates = new Set(ds.current.map(dateOf));
  const total = { ...ZERO };
  const origins = new Map<string, { name: string; leads: number; sales: number }>();
  for (const r of rows) {
    if (!dates.has(r.date)) continue;
    total.leads += r.leads;
    total.attended += r.attended;
    total.visits += r.visits;
    total.proposals += r.proposals;
    total.sales += r.sales;
    total.value += r.value;
    const key = r.origin.toLowerCase();
    const o = origins.get(key) ?? { name: r.origin, leads: 0, sales: 0 };
    o.leads += r.leads;
    o.sales += r.sales;
    origins.set(key, o);
  }

  const stages = STAGES.filter((s) => has(s.column));
  const top = total.leads;
  const funnel: FunnelStep[] = stages.map((s) => ({ label: s.label, count: total[s.key], pct: top > 0 ? (total[s.key] / top) * 100 : 0 }));
  const crm: CrmStage[] = stages.map((s) => ({ stage: s.label, count: total[s.key], value: s.key === "sales" && has("value") ? Math.round(total.value * 100) : 0 }));
  const sorted = [...current].sort((a, b) => b.ago - a.ago);
  const launch: LaunchInfo = {
    from: sorted.length ? dateOf(sorted[0]) : opts.today,
    to: sorted.length ? dateOf(sorted[sorted.length - 1]) : opts.today,
    origins: [...origins.values()].filter((o) => o.leads > 0 || o.sales > 0).sort((a, b) => b.leads - a.leads),
    proposals: has("proposals") ? total.proposals : 0,
    sales: has("sales") ? total.sales : 0,
    value: has("value") ? Math.round(total.value * 100) : 0,
  };
  // com um funil só de leads (planilha só com data e leads), fica o funil do modelo
  return { ...ds, current, previous, funnel: funnel.length > 1 ? funnel : ds.funnel, crm: crm.length > 1 ? crm : ds.crm, launch };
}
