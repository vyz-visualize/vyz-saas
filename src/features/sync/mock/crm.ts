// CRM simulado (conexões de teste e amostra): leads por dia com fim de semana mais
// baixo, parte vira negócio, os negócios recentes ainda abertos nas etapas do funil e
// os antigos fechados (ganhos ou perdidos). Determinístico por conta e data.

import { dateRange, diffDays, weekday } from "../dates";
import { CRM_TOTAL, type CrmDataset, type CrmDay, type CrmPlatform } from "../crm";
import { between, roundRandom, stream } from "./random";

export const MOCK_CRM_STAGES = ["Novo", "Qualificado", "Proposta", "Negociação"] as const;

export function generateCrmData(input: { platform?: CrmPlatform; accountExternalId: string; endDate: string; days: number }): CrmDataset {
  const acc = input.accountExternalId;
  const platform = input.platform ?? "hubspot";
  const base = stream("crm", acc, "base");
  const leadsDay = between(base, [12, 70]);
  const dealRate = between(base, [0.25, 0.45]);
  const winRate = between(base, [0.18, 0.35]);
  const ticket = between(base, [900, 4800]);
  const dates = dateRange(input.endDate, input.days);
  const daily: CrmDay[] = [];
  for (const date of dates) {
    const r = stream("crm", acc, date);
    const wk = weekday(date);
    const leads = Math.max(0, roundRandom(r, leadsDay * (wk === 0 || wk === 6 ? 0.6 : 1) * between(r, [0.75, 1.25])));
    const deals = roundRandom(r, leads * dealRate);
    const value = Math.round(deals * ticket * between(r, [0.8, 1.2]) * 100) / 100;
    // os negócios criados há pouco ainda estão abertos; os mais antigos, quase todos fechados
    const age = diffDays(date, input.endDate);
    const openShare = Math.max(0.05, 1 - age / 30);
    const open = Math.round(deals * openShare);
    const won = roundRandom(r, Math.max(0, deals - open) * winRate * 1.6);
    const lost = Math.max(0, roundRandom(r, (deals - open) * (1 - winRate)));
    daily.push({ date, stage: CRM_TOTAL, stageOrder: 0, deals, value, won, wonValue: Math.round(won * ticket * between(r, [0.85, 1.2]) * 100) / 100, lost, leads });
    let left = open;
    MOCK_CRM_STAGES.forEach((stage, i) => {
      // etapa mais avançada fica com menos negócios, e os recentes ficam nas primeiras
      const n = i === MOCK_CRM_STAGES.length - 1 ? left : Math.min(left, Math.round(left * between(r, [0.35, 0.6]) * (age < 7 ? 1.3 : 0.8)));
      left -= n;
      if (n > 0) daily.push({ date, stage, stageOrder: i + 1, deals: n, value: Math.round(n * ticket * between(r, [0.8, 1.2]) * 100) / 100, won: 0, wonValue: 0, lost: 0, leads: 0 });
    });
  }
  return { platform, accountExternalId: acc, range: { from: dates[0], to: dates.at(-1)! }, daily };
}
