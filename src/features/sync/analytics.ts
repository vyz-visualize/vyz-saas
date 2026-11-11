// GA4 no formato do armazém: o que a sincronização grava em analytics_daily.
// Vale para o gerador simulado e para a Data API do GA4.
//
// Convenções: datas "YYYY-MM-DD" no fuso da propriedade; uma linha por dia e canal
// (sessionDefaultChannelGroup); usuários do dia no canal (não somam entre linhas).

export const ANALYTICS_PLATFORMS = ["ga4"] as const;
export type AnalyticsPlatform = (typeof ANALYTICS_PLATFORMS)[number];
export const isAnalyticsSyncPlatform = (value: unknown): value is AnalyticsPlatform => (ANALYTICS_PLATFORMS as readonly unknown[]).includes(value);

export type AnalyticsDay = {
  date: string;
  channel: string;
  sessions: number;
  users: number;
  newUsers: number;
  engagedSessions: number;
  /** Eventos-chave (conversões marcadas no GA4). */
  keyEvents: number;
  transactions: number;
  /** Receita de compras, na moeda da propriedade. */
  revenue: number;
};

export type AnalyticsDataset = {
  platform: AnalyticsPlatform;
  accountExternalId: string;
  range: { from: string; to: string };
  daily: AnalyticsDay[];
};

/** Linha para o banco (snake_case), sem os ids internos. */
export const analyticsDayRow = (d: AnalyticsDay) => ({
  date: d.date,
  channel: d.channel.slice(0, 80) || "(not set)",
  sessions: Math.max(0, Math.round(d.sessions)),
  users: Math.max(0, Math.round(d.users)),
  new_users: Math.max(0, Math.round(d.newUsers)),
  engaged_sessions: Math.max(0, Math.round(d.engagedSessions)),
  key_events: Math.max(0, Math.round(d.keyEvents * 100) / 100),
  transactions: Math.max(0, Math.round(d.transactions)),
  revenue: Math.max(0, Math.round(d.revenue * 100) / 100),
});

/** "20261108" (Data API) → "2026-11-08". */
export const ga4Date = (v: string) => (/^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);
