// O que falta para o MMM de cada cliente (projeto). Enquanto o modelo de verdade não existe, a
// tela mostra esta lista, com o histórico real de investimento por canal e mês. Puro: o servidor
// junta os números e a tela desenha; os testes cobrem os quatro critérios.
//
//   1. 2 canais ou mais com gasto;
//   2. 6 meses ou mais com gasto em cada canal (faltando: quantos e a partir de quando cumpre);
//   3. resultado de fonte independente (GA4, CRM ou planilha do lançamento) com 6 meses ou mais.
//      A conversão da própria plataforma não serve: o modelo explicaria a plataforma com ela mesma;
//   4. verba com variação em cada canal (verba sempre igual não deixa medir o efeito do canal).

export const MMM_MIN_CHANNELS = 2;
export const MMM_MIN_MONTHS = 6;
/** Abaixo disso (desvio ÷ média), a verba é "sempre igual". */
export const MMM_MIN_VARIATION = 0.1;
/** Dias com gasto para dizer algo sobre a variação. */
const MIN_DAYS_FOR_VARIATION = 30;

export type OutcomeSource = "ga4" | "crm" | "planilha";
export const OUTCOME_LABEL: Record<OutcomeSource, string> = { ga4: "GA4 (site)", crm: "CRM", planilha: "Planilha do lançamento" };

/** Investimento de uma conta num mês (em reais): o total, os dias com gasto e a soma dos quadrados do gasto diário. */
export type MonthSpend = { projectId: string; platform: string; month: string; spend: number; days: number; sumSq: number };
/** Os meses (AAAA-MM) com resultado de uma fonte do cliente; connected: há conta dessa fonte ligada. */
export type OutcomeMonths = { projectId: string; source: OutcomeSource; months: string[]; connected: boolean };

export type ChannelReadiness = {
  platform: string;
  months: number;
  first: string | null;
  last: string | null;
  /** Mês (AAAA-MM) em que passa a ter 6 meses, se continuar investindo; null: já cumpre ou não está investindo agora. */
  readyOn: string | null;
  /** O canal investiu no mês atual ou no anterior (sem isso, não há previsão). */
  active: boolean;
  variation: "ok" | "constante" | "pouco-dado";
  /** Investimento por mês (reais), do mais antigo ao mais recente. */
  monthly: { month: string; spend: number }[];
};

export type Criterion = { id: "canais" | "historico" | "resultado" | "variacao"; ok: boolean };

export type ProjectReadiness = {
  projectId: string;
  name: string;
  channels: ChannelReadiness[];
  outcomes: { source: OutcomeSource; months: number; connected: boolean }[];
  criteria: Criterion[];
  ready: boolean;
};

const ym = (iso: string) => iso.slice(0, 7);
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function channelOf(platform: string, rows: readonly MonthSpend[], today: string): ChannelReadiness {
  const byMonth = new Map<string, { spend: number; days: number; sumSq: number }>();
  for (const r of rows) {
    const k = ym(r.month);
    const cur = byMonth.get(k) ?? { spend: 0, days: 0, sumSq: 0 };
    byMonth.set(k, { spend: cur.spend + r.spend, days: cur.days + r.days, sumSq: cur.sumSq + r.sumSq });
  }
  const monthly = [...byMonth.entries()].filter(([, v]) => v.spend > 0).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, spend: v.spend }));
  const months = monthly.length;
  const now = ym(today);
  const active = monthly.some((m) => m.month === now || m.month === addMonths(now, -1));
  const spendsNow = monthly.some((m) => m.month === now);
  // previsão: cada mês seguinte com gasto conta um; o mês atual, se ainda não teve gasto, também
  const readyOn = months >= MMM_MIN_MONTHS || !active ? null : addMonths(now, MMM_MIN_MONTHS - months - (spendsNow ? 0 : 1));
  // variação: o gasto diário (desvio ÷ média nos dias com gasto) e o mensal; as duas quase paradas = constante
  const days = [...byMonth.values()].reduce((a, v) => a + v.days, 0);
  const total = [...byMonth.values()].reduce((a, v) => a + v.spend, 0);
  const sumSq = [...byMonth.values()].reduce((a, v) => a + v.sumSq, 0);
  let variation: ChannelReadiness["variation"] = "pouco-dado";
  if (days >= MIN_DAYS_FOR_VARIATION && total > 0) {
    const mean = total / days;
    const dailyCv = Math.sqrt(Math.max(0, sumSq / days - mean * mean)) / mean;
    const mMean = total / Math.max(1, months);
    const monthlyCv = months >= 2 ? Math.sqrt(monthly.reduce((a, m) => a + (m.spend - mMean) ** 2, 0) / months) / mMean : 0;
    variation = dailyCv < MMM_MIN_VARIATION && monthlyCv < MMM_MIN_VARIATION ? "constante" : "ok";
  }
  return { platform, months, first: monthly[0]?.month ?? null, last: monthly.at(-1)?.month ?? null, readyOn, active, variation, monthly };
}

/**
 * A lista de cada cliente. Contas sem projeto ficam num bloco "Sem cliente". Cada conta conta só
 * no projeto dela (a mesma conta de anúncio ligada em dois workspaces são duas contas, cada uma no
 * seu projeto, e não se somam).
 */
export function mmmReadiness(projects: readonly { id: string; name: string }[], spend: readonly MonthSpend[], outcomes: readonly OutcomeMonths[], today: string): ProjectReadiness[] {
  return projects.map((p) => {
    const mine = spend.filter((r) => r.projectId === p.id);
    const platforms = [...new Set(mine.map((r) => r.platform))].sort();
    const channels = platforms.map((pl) => channelOf(pl, mine.filter((r) => r.platform === pl), today)).filter((c) => c.months > 0);
    const out = (["ga4", "crm", "planilha"] as const).map((source) => {
      const list = outcomes.filter((o) => o.projectId === p.id && o.source === source);
      return { source, months: new Set(list.flatMap((o) => o.months.map(ym))).size, connected: list.some((o) => o.connected) };
    });
    const criteria: Criterion[] = [
      { id: "canais", ok: channels.length >= MMM_MIN_CHANNELS },
      { id: "historico", ok: channels.length > 0 && channels.every((c) => c.months >= MMM_MIN_MONTHS) },
      { id: "resultado", ok: out.some((o) => o.months >= MMM_MIN_MONTHS) },
      { id: "variacao", ok: channels.length > 0 && channels.every((c) => c.variation === "ok") },
    ];
    return { projectId: p.id, name: p.name, channels, outcomes: out, criteria, ready: criteria.every((c) => c.ok) };
  });
}

/** O que a tela recebe: cada cliente e se o histórico inclui a carga do MMM (false: só o do app, desde a primeira sincronização). */
export type MmmReadinessData = { projects: ProjectReadiness[]; fullHistory: boolean; today: string };
