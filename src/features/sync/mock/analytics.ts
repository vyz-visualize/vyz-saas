// GA4 simulado (conexões de teste): sessões por canal com fim de semana mais baixo,
// eventos-chave e compras proporcionais. Determinístico por propriedade e data.

import { dateRange, weekday } from "../dates";
import type { AnalyticsDataset } from "../analytics";
import { between, roundRandom, stream } from "./random";

const CHANNELS: [string, number][] = [
  ["Organic Search", 0.34],
  ["Paid Search", 0.22],
  ["Direct", 0.18],
  ["Paid Social", 0.14],
  ["Organic Social", 0.07],
  ["Referral", 0.05],
];

export function generateAnalyticsData(input: { accountExternalId: string; endDate: string; days: number }): AnalyticsDataset {
  const acc = input.accountExternalId;
  const base = stream("ga4", acc, "base");
  const sessionsDay = between(base, [600, 4200]);
  const keyRate = between(base, [0.015, 0.05]);
  const buyRate = between(base, [0.005, 0.02]);
  const ticket = between(base, [120, 380]);
  const dates = dateRange(input.endDate, input.days);
  const daily = dates.flatMap((date) => {
    const wk = weekday(date);
    const dayFactor = wk === 0 || wk === 6 ? 0.82 : 1;
    return CHANNELS.map(([channel, share]) => {
      const r = stream("ga4", acc, date, channel);
      const sessions = Math.max(0, roundRandom(r, sessionsDay * share * dayFactor * between(r, [0.85, 1.15])));
      const transactions = roundRandom(r, sessions * buyRate);
      return {
        date,
        channel,
        sessions,
        users: Math.round(sessions * between(r, [0.78, 0.92])),
        newUsers: Math.round(sessions * between(r, [0.45, 0.7])),
        engagedSessions: Math.round(sessions * between(r, [0.5, 0.72])),
        keyEvents: roundRandom(r, sessions * keyRate),
        transactions,
        revenue: Math.round(transactions * ticket * between(r, [0.85, 1.15]) * 100) / 100,
      };
    });
  });
  return { platform: "ga4", accountExternalId: acc, range: { from: dates[0], to: dates.at(-1)! }, daily };
}
