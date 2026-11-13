// Carga do histórico do MMM (docs/MMM.md). Liga, pausa e mostra a fila; quem anda com ela é
// o /api/cron/sync (3 trabalhos por vez, no tempo que sobra da sincronização).
//
//   npm run mmm:backfill -- --status            a fila por status e se está ligada
//   npm run mmm:backfill -- --enqueue           monta a fila (37 meses fechados por conta Meta/Google ativa)
//   npm run mmm:backfill -- --start             liga (o próximo cron começa)
//   npm run mmm:backfill -- --pause             pausa (o que está rodando termina; nada novo sai)
//
// --enqueue não liga a fila; repetir não duplica. Precisa da migration 20261117090000 aplicada.

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

process.loadEnvFile?.(".env.local");

const { values } = parseArgs({ options: { status: { type: "boolean" }, enqueue: { type: "boolean" }, start: { type: "boolean" }, pause: { type: "boolean" }, months: { type: "string", default: "37" } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
const db = createClient<Database>(url, key, { auth: { persistSession: false } });
const ok = <T,>(fn: string, r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(`${fn}: ${r.error.message}`);
  return r.data;
};

async function main() {
  if (values.enqueue) console.log("trabalhos novos na fila:", ok("mmm_enqueue_backfill", await db.rpc("mmm_enqueue_backfill", { p_months: Number(values.months) })));
  if (values.start && values.pause) throw new Error("--start ou --pause, não os dois");
  const ativo = values.start ? true : values.pause ? false : undefined;
  console.log(JSON.stringify(ok("mmm_backfill_control", await db.rpc("mmm_backfill_control", ativo === undefined ? {} : { p_ativo: ativo })), null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
