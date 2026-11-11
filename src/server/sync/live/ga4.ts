import "server-only";

// Importação real do GA4 (Data API, runReport): por dia e canal padrão
// (sessionDefaultChannelGroup), com paginação por offset. O token é o do login do GA4.
// Docs: developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport

import { analyticsDayRow, ga4Date, type AnalyticsDataset, type AnalyticsDay } from "@/features/sync/analytics";
import type { SyncRange } from "@/features/sync/dates";
import { bearer } from "@/server/integrations/providers/oauth2";
import { fetchJson } from "@/server/integrations/providers/http";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";

const DATA = "https://analyticsdata.googleapis.com/v1beta";
export const GA4_METRICS = ["sessions", "totalUsers", "newUsers", "engagedSessions", "keyEvents", "transactions", "purchaseRevenue"] as const;
const PAGE = 10_000;
const MAX_PAGES = 20;

type Report = { rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]; rowCount?: number };

const n = (v: string | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export async function fetchGa4Dataset(account: SyncAccount, range: SyncRange): Promise<AnalyticsDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const property = account.externalId.replace(/^properties\//, "");
  const daily: AnalyticsDay[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchJson<Report>(`${DATA}/properties/${property}:runReport`, {
      method: "POST",
      headers: { ...bearer(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: range.from, endDate: range.to }],
        dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
        metrics: GA4_METRICS.map((name) => ({ name })),
        limit: PAGE,
        offset: page * PAGE,
        keepEmptyRows: false,
      }),
      label: "GA4: relatório diário",
      rejectCode: "provedor_recusou",
      timeoutMs: 45_000,
    });
    for (const row of res.rows ?? []) {
      const date = ga4Date(row.dimensionValues?.[0]?.value ?? "");
      if (!date) continue;
      const m = row.metricValues ?? [];
      daily.push({
        date,
        channel: row.dimensionValues?.[1]?.value || "(not set)",
        sessions: n(m[0]?.value),
        users: n(m[1]?.value),
        newUsers: n(m[2]?.value),
        engagedSessions: n(m[3]?.value),
        keyEvents: n(m[4]?.value),
        transactions: n(m[5]?.value),
        revenue: n(m[6]?.value),
      });
    }
    if (!res.rows?.length || (page + 1) * PAGE >= (res.rowCount ?? 0)) break;
  }
  // a chave do banco é (propriedade, dia, canal): canais repetidos (raro) somam
  const merged = new Map<string, AnalyticsDay>();
  for (const d of daily) {
    const key = `${d.date}|${analyticsDayRow(d).channel}`;
    const cur = merged.get(key);
    if (!cur) merged.set(key, { ...d });
    else for (const k of ["sessions", "users", "newUsers", "engagedSessions", "keyEvents", "transactions", "revenue"] as const) cur[k] += d[k];
  }
  return { platform: "ga4", accountExternalId: account.externalId, range: { from: range.from, to: range.to }, daily: [...merged.values()] };
}
