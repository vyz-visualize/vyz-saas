import "server-only";

// App Store Connect (chave só Financeiro): relatórios de vendas, de
// assinaturas e de eventos de assinatura, diários. Cobrem o time inteiro:
// fica só o que é do app da Vyzualize (Apple ID ou produto vyz_*).

import { createPrivateKey, createSign } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { addMoney, monthsOf, parseTable, type Money, type RevenueBlock, type Source } from "@/features/admin/types";
import { APP_STORE_APP_ID, appStoreKey } from "./credentials";

const DAY = 86_400_000;

function token(k: NonNullable<ReturnType<typeof appStoreKey>>): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b({ alg: "ES256", kid: k.keyId, typ: "JWT" })}.${b({ iss: k.issuerId, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" })}`;
  const sig = createSign("SHA256").update(unsigned).sign({ key: createPrivateKey(k.p8), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${unsigned}.${sig}`;
}

type Kind = { type: "SALES" | "SUBSCRIPTION" | "SUBSCRIPTION_EVENT"; version: string };
const SALES: Kind = { type: "SALES", version: "1_1" };
const SUBS: Kind = { type: "SUBSCRIPTION", version: "1_4" };
const EVENTS: Kind = { type: "SUBSCRIPTION_EVENT", version: "1_4" };

class NoReports extends Error {}

/** Um relatório diário, ou [] quando a Apple ainda não tem o dia. */
async function report(k: NonNullable<ReturnType<typeof appStoreKey>>, jwt: string, kind: Kind, date: string): Promise<Record<string, string>[]> {
  const q = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportType]": kind.type,
    "filter[reportSubType]": kind.type === "SALES" ? "SUMMARY" : "SUMMARY",
    "filter[vendorNumber]": k.vendor,
    "filter[reportDate]": date,
    "filter[version]": kind.version,
  });
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${q}`, { headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { errors?: { detail?: string }[] } | null)?.errors?.[0]?.detail ?? "";
    // conta sem nenhum relatório ainda: a Apple responde "vendor number inválido"
    if (/vendor number/i.test(detail)) throw new NoReports();
    throw new Error(`App Store: HTTP ${res.status}`);
  }
  return parseTable(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"), "\t");
}

const isOurs = (r: Record<string, string>) =>
  r["Apple Identifier"] === APP_STORE_APP_ID || r["App Apple ID"] === APP_STORE_APP_ID || (r["SKU"] ?? "").startsWith("vyz_") || (r["Parent Identifier"] ?? "").startsWith("app.vyz");

const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function loadAppStore(): Promise<Source<RevenueBlock>> {
  const k = appStoreKey();
  if (!k) return { ok: false, reason: "App Store não configurada." };
  try {
    const jwt = token(k);
    // a Apple publica o dia anterior por volta das 8h de Brasília: começa em D-1
    const days = Array.from({ length: 30 }, (_, i) => dayStr(Date.now() - (i + 1) * DAY));
    const sales = (await Promise.all(days.map((d) => report(k, jwt, SALES, d)))).flat().filter(isOurs);
    let revenue30: Money = {};
    let refunds30: Money = {};
    let refundCount30 = 0;
    for (const r of sales) {
      const units = Number(r["Units"] ?? 0);
      const proceeds = Number(r["Developer Proceeds"] ?? 0) * units;
      const cur = r["Currency of Proceeds"] || "USD";
      if (units < 0) {
        refunds30 = addMoney(refunds30, cur, Math.abs(proceeds));
        refundCount30 += Math.abs(units);
      } else revenue30 = addMoney(revenue30, cur, proceeds);
    }

    // assinantes e MRR: o relatório de assinaturas mais recente que existir
    let subs: Record<string, string>[] = [];
    for (const d of days.slice(0, 5)) {
      subs = (await report(k, jwt, SUBS, d)).filter(isOurs);
      if (subs.length) break;
    }
    let subscribers = 0;
    let trials = 0;
    let mrr: Money = {};
    for (const r of subs) {
      const active = Number(r["Active Standard Price Subscriptions"] ?? 0) + Number(r["Active Promotional Offer Subscriptions"] ?? 0);
      subscribers += active;
      trials += Number(r["Active Free Trial Introductory Offer Subscriptions"] ?? 0);
      const months = monthsOf(r["Standard Subscription Duration"]);
      mrr = addMoney(mrr, r["Proceeds Currency"] || "USD", (Number(r["Developer Proceeds"] ?? 0) * active) / months);
    }

    const events = (await Promise.all(days.map((d) => report(k, jwt, EVENTS, d)))).flat().filter(isOurs);
    const churned30 = events.filter((e) => /^cancel/i.test(e["Event"] ?? "")).reduce((s, e) => s + Number(e["Quantity"] ?? 1), 0);
    const churnRate = subscribers + churned30 > 0 ? (churned30 / (subscribers + churned30)) * 100 : null;
    return { ok: true, data: { mrr, subscribers, revenue30, churned30, churnRate, refunds30, refundCount30, trials, note: "Valores líquidos (o que a Apple repassa)." } };
  } catch (err) {
    if (err instanceof NoReports) return { ok: false, reason: "A Apple ainda não gerou nenhum relatório para a conta (aparece depois da primeira venda)." };
    return { ok: false, reason: (err as Error).message };
  }
}
