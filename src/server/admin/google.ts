import "server-only";

// Google (conta de serviço, só leitura): GA4 Data API e relatórios do Google
// Play no bucket do Cloud Storage. O bucket cobre a conta de desenvolvedor
// inteira: tudo é filtrado por PLAY_PACKAGE_NAME.

import { createSign } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { addMoney, monthsOf, parseTable, type Ga4Block, type Money, type RevenueBlock, type Source } from "@/features/admin/types";
import { ga4PropertyId, googleServiceAccount, playConfig } from "./credentials";

const TIMEOUT = 20_000;
const tokens = new Map<string, { token: string; exp: number }>();

async function googleToken(scope: string): Promise<string> {
  const hit = tokens.get(scope);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const sa = googleServiceAccount();
  if (!sa) throw new Error("sem conta de serviço");
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b({ alg: "RS256", typ: "JWT" })}.${b({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error(`token do Google recusado (HTTP ${res.status})`);
  tokens.set(scope, { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token;
}

// ---- GA4 --------------------------------------------------------------------------------

type Ga4Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };

async function ga4(body: object): Promise<Ga4Row[]> {
  const id = ga4PropertyId();
  const token = await googleToken("https://www.googleapis.com/auth/analytics.readonly");
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GA4 recusou (HTTP ${res.status})`);
  return ((await res.json()) as { rows?: Ga4Row[] }).rows ?? [];
}

const num = (r: Ga4Row | undefined, i: number) => Number(r?.metricValues?.[i]?.value ?? 0);

export async function loadGa4(): Promise<Source<Ga4Block>> {
  if (!ga4PropertyId() || !googleServiceAccount()) return { ok: false, reason: "GA4 não configurado." };
  try {
    const [d1, d7, d28, sources, cohortRows] = await Promise.all([
      ga4({ dateRanges: [{ startDate: "today", endDate: "today" }], metrics: [{ name: "activeUsers" }] }),
      ga4({ dateRanges: [{ startDate: "6daysAgo", endDate: "today" }], metrics: [{ name: "activeUsers" }] }),
      ga4({ dateRanges: [{ startDate: "27daysAgo", endDate: "today" }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }] }),
      ga4({
        dateRanges: [{ startDate: "27daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionSourceMedium" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 6,
      }),
      ga4({
        dimensions: [{ name: "cohort" }, { name: "cohortNthWeek" }],
        metrics: [{ name: "cohortActiveUsers" }],
        cohortSpec: {
          cohorts: [1, 2, 3, 4, 5].map((w) => ({ name: `semana_${w}`, dimension: "firstSessionDate", dateRange: { startDate: `${w * 7 + 6}daysAgo`, endDate: `${w * 7}daysAgo` } })),
          cohortsRange: { granularity: "WEEKLY", startOffset: 0, endOffset: 4 },
        },
      }).catch(() => [] as Ga4Row[]),
    ]);
    const byCohort = new Map<string, number[]>();
    for (const r of cohortRows) {
      const name = r.dimensionValues?.[0]?.value ?? "";
      const nth = Number(r.dimensionValues?.[1]?.value ?? 0);
      const arr = byCohort.get(name) ?? [0, 0, 0, 0, 0];
      arr[nth] = num(r, 0);
      byCohort.set(name, arr);
    }
    const cohorts = [...byCohort.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([name, arr]) => ({ week: `há ${name.split("_")[1]} sem.`, size: arr[0], weeks: arr.map((v) => (arr[0] ? (v / arr[0]) * 100 : 0)) }));
    return {
      ok: true,
      data: {
        active1: num(d1[0], 0),
        active7: num(d7[0], 0),
        active28: num(d28[0], 0),
        newUsers28: num(d28[0], 1),
        sessions28: num(d28[0], 2),
        topSources: sources.map((r) => ({ source: r.dimensionValues?.[0]?.value ?? "(direto)", users: num(r, 0) })),
        cohorts,
      },
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

// ---- Google Play ------------------------------------------------------------------------

async function gcs(path: string, token: string): Promise<Response> {
  return fetch(`https://storage.googleapis.com/storage/v1/b/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
}

async function listObjects(bucket: string, prefix: string, token: string): Promise<string[]> {
  const names: string[] = [];
  let page: string | undefined;
  for (let i = 0; i < 10; i++) {
    const res = await gcs(`${bucket}/o?prefix=${encodeURIComponent(prefix)}&fields=items(name),nextPageToken${page ? `&pageToken=${page}` : ""}`, token);
    if (res.status === 403) throw new Error("A conta de serviço ainda não tem acesso ao bucket do Play (a permissão leva até 24 h).");
    if (!res.ok) throw new Error(`Play: HTTP ${res.status}`);
    const j = (await res.json()) as { items?: { name: string }[]; nextPageToken?: string };
    names.push(...(j.items ?? []).map((x) => x.name));
    page = j.nextPageToken;
    if (!page) break;
  }
  return names;
}

async function download(bucket: string, name: string, token: string): Promise<Buffer> {
  const res = await gcs(`${bucket}/o/${encodeURIComponent(name)}?alt=media`, token);
  if (!res.ok) throw new Error(`Play: HTTP ${res.status} ao baixar`);
  return Buffer.from(await res.arrayBuffer());
}

/** Primeiro arquivo de um .zip (os relatórios do Play têm um CSV só). */
export function unzipFirst(zip: Buffer): Buffer {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("zip inválido");
  const cd = zip.readUInt32LE(eocd + 16);
  const method = zip.readUInt16LE(cd + 10);
  const size = zip.readUInt32LE(cd + 20);
  const local = zip.readUInt32LE(cd + 42);
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(start, start + size);
  return method === 8 ? inflateRawSync(data) : Buffer.from(data);
}

/** Texto de um CSV do Play (alguns vêm em UTF-16). */
function decode(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  return buf.toString("utf8");
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function loadGooglePlay(): Promise<Source<RevenueBlock>> {
  const cfg = playConfig();
  if (!cfg || !googleServiceAccount()) return { ok: false, reason: "Google Play não configurado." };
  try {
    const token = await googleToken("https://www.googleapis.com/auth/devstorage.read_only");
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const since = Date.now() - 30 * 86_400_000;

    // vendas (atualizado todo dia): sales/salesreport_YYYYMM.zip
    let revenue30: Money = {};
    let refunds30: Money = {};
    let refundCount30 = 0;
    for (const m of [monthKey(prev), monthKey(now)]) {
      const names = await listObjects(cfg.bucket, `sales/salesreport_${m}`, token);
      for (const name of names) {
        const rows = parseTable(decode(unzipFirst(await download(cfg.bucket, name, token))), ",");
        for (const r of rows) {
          if ((r["Product ID"] ?? r["Package ID"]) !== cfg.pkg) continue;
          const when = Date.parse(r["Order Charged Date"] ?? r["Transaction Date"] ?? "");
          if (!Number.isFinite(when) || when < since) continue;
          const cur = r["Currency of Sale"] || "BRL";
          const amount = Number((r["Charged Amount"] ?? r["Item Price"] ?? "0").replace(/,/g, ""));
          if (/refund/i.test(r["Financial Status"] ?? "")) {
            refunds30 = addMoney(refunds30, cur, Math.abs(amount));
            refundCount30++;
          } else revenue30 = addMoney(revenue30, cur, amount);
        }
      }
    }

    // assinaturas: financial-stats/subscriptions/subscriptions_<pacote>_<sku>_<YYYYMM>_country.csv
    let subscribers = 0;
    let churned30 = 0;
    let mrr: Money = {};
    const subFiles = (await listObjects(cfg.bucket, `financial-stats/subscriptions/subscriptions_${cfg.pkg}_`, token)).filter((n) => n.includes(monthKey(now)) || n.includes(monthKey(prev)));
    const latestBySku = new Map<string, string>();
    for (const n of subFiles.sort()) latestBySku.set(n.replace(/_\d{6}.*$/, ""), n);
    for (const name of latestBySku.values()) {
      const rows = parseTable(decode(await download(cfg.bucket, name, token)), ",");
      const last = rows.at(-1);
      if (!last) continue;
      const active = Number(last["Active Subscriptions"] ?? 0);
      subscribers += active;
      churned30 += rows.reduce((s, r) => s + Number(r["Cancelled Subscriptions"] ?? 0), 0);
      const sku = name.split(`subscriptions_${cfg.pkg}_`)[1] ?? "";
      const price = (await skuPrice(sku)) ?? null;
      if (price) mrr = addMoney(mrr, "BRL", (active * price.cents) / 100 / price.months);
    }
    return { ok: true, data: { mrr, subscribers, revenue30, churned30, churnRate: null, refunds30, refundCount30, note: "Vendas e reembolsos do relatório do Play; MRR estimado pelo preço do plano." } };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Preço do plano pelo ID do produto (vyz_<plano>_<período>_ate<n>), em centavos. */
async function skuPrice(sku: string): Promise<{ cents: number; months: number } | null> {
  const { parseStorePlan, STORE_PLAN_PRICE } = await import("@vyz/shared");
  const plan = parseStorePlan(sku.split("_country")[0]);
  if (!plan) return null;
  return { cents: STORE_PLAN_PRICE[plan.tier][plan.period], months: monthsOf(plan.period === "anual" ? "year" : "month") };
}
