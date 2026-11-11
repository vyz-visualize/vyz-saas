// Confere, contra a API de verdade, que todas as consultas GAQL do VYZ ainda são aceitas
// pelo Google Ads (campos renomeados ou removidos numa versão nova quebram a importação
// inteira). Só leitura, LIMIT 1, numa conta real conectada (a primeira ativa, ou --conta).
//   npm run check:google-ads            (usa o .env.local)
//   npm run check:google-ads -- --conta "Nome da conta"
// Sai com código 1 se alguma consulta for recusada.

import { readFileSync } from "node:fs";
import { createAdminSupabase } from "@/server/supabase/admin";
import { getValidAccessToken } from "@/server/integrations/tokens";
import { ADS, adsHeaders } from "@/server/integrations/providers/google";

const FILES = ["src/server/sync/live/google.ts", "src/server/integrations/providers/google.ts"];

async function main() {
  const i = process.argv.indexOf("--conta");
  const name = i > 0 ? process.argv[i + 1] : null;
  let q = createAdminSupabase().from("ad_accounts").select("name, external_id, connection_id, connections!inner(is_mock)").eq("platform_id", "google").eq("is_enabled", true).eq("connections.is_mock", false).limit(1);
  if (name) q = q.ilike("name", `%${name}%`);
  const { data, error } = await q;
  if (error) throw error;
  const a = data?.[0];
  if (!a?.connection_id) throw new Error("Nenhuma conta real do Google conectada para testar.");
  const token = await getValidAccessToken(a.connection_id);
  const customer = a.external_id.replace(/-/g, "");
  const queries = FILES.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/[`"](SELECT [^`"]+)[`"]/g)].map((m) => m[1]));
  let failed = 0;
  console.log(`Conta: ${a.name} · ${queries.length} consultas\n`);
  for (const raw of queries) {
    const query = `${raw.replace(/\$\{during\}/g, "segments.date DURING LAST_7_DAYS").replace(/\$\{[^}]+\}/g, "0")} LIMIT 1`;
    const res = await fetch(`${ADS}/customers/${customer}/googleAds:search`, { method: "POST", headers: adsHeaders(token, { "login-customer-id": customer, "Content-Type": "application/json" }), body: JSON.stringify({ query }) });
    const body = (await res.json().catch(() => ({}))) as { error?: { details?: { errors?: { message?: string }[] }[] } };
    const why = body.error?.details?.flatMap((d) => d.errors ?? []).map((e) => e.message).join(" | ");
    if (!res.ok) failed++;
    console.log(`${res.ok ? "ok  " : "ERRO"} ${raw.slice(0, 90)}${why ? `\n     ${why}` : ""}`);
  }
  console.log(failed ? `\n${failed} consulta(s) recusada(s): corrija antes de subir.` : "\nTodas aceitas.");
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
