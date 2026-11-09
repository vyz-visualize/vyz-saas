// Exclusão total de uma conta, para os pedidos de /exclusao-de-dados.
// Passo a passo: docs/EXCLUSAO-DE-DADOS.md
//
//   Simulação (só lê, o padrão):
//     DELETE_ACCOUNT_DB_URL=... npm run admin:delete-account -- --email pessoa@exemplo.com
//
//   Exclusão (exige o e-mail repetido e o código que a simulação mostrou):
//     DELETE_ACCOUNT_DB_URL=... DELETE_ACCOUNT_SUPABASE_URL=... DELETE_ACCOUNT_SERVICE_ROLE_KEY=... \
//     DELETE_ACCOUNT_META_APP_SECRET=... \
//       npm run admin:delete-account -- --email pessoa@exemplo.com --apply \
//       --confirmar pessoa@exemplo.com --codigo abcd1234
//
// De propósito, não lê o .env.local: o banco é sempre escolhido na hora, por uma variável
// só deste script, e o endereço aparece antes de qualquer coisa.

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { applyPlan, loadPlan, planCode, readTokens, refuseReason, renderPlan, type Db } from "../../src/server/admin/account-deletion";
import { renderRevocations, revokeAll, type RevokeOutcome } from "../../src/server/admin/revoke-access";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    apply: { type: "boolean", default: false },
    confirmar: { type: "string" },
    codigo: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const email = values.email?.trim();
if (!email) fail("Informe a conta: --email pessoa@exemplo.com");
const url = process.env.DELETE_ACCOUNT_DB_URL;
if (!url) fail("Defina DELETE_ACCOUNT_DB_URL com o banco a usar. Este script não lê o .env.local, de propósito.");

// o erro de uma URL inválida traz a URL, com a senha: não deixa estourar na tela
const host = URL.canParse(url) ? new URL(url).hostname : fail("DELETE_ACCOUNT_DB_URL não é uma URL válida.");
console.log(`\nBanco: ${host}`);
console.log(values.apply ? "Modo: EXCLUSÃO\n" : "Modo: simulação (só lê; nada é apagado)\n");

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const adapter = (tx: { unsafe: (text: string, params?: never[]) => PromiseLike<unknown> }): Db => ({
  query: async <T,>(text: string, params: unknown[] = []) => [...((await tx.unsafe(text, params as never[])) as Iterable<T>)],
});

async function simulate() {
  const plan = await sql.begin("read only", (tx) => loadPlan(adapter(tx), email!));
  console.log(renderPlan(plan));
  if (plan.blockers.length) {
    console.log("Resolva os bloqueios e rode a simulação de novo.\n");
    return;
  }
  console.log(`Código desta simulação: ${planCode(plan)}`);
  console.log(`Para apagar: --apply --confirmar ${plan.email} --codigo ${planCode(plan)}\n`);
}

/** O que já foi revogado na origem, para aparecer mesmo se o banco desfizer a transação. */
let outcomes: RevokeOutcome[] = [];

async function apply() {
  // o plano é refeito dentro da transação: o código garante que é o mesmo que foi lido
  const plan = await sql.begin(async (tx) => {
    const db = adapter(tx);
    const fresh = await loadPlan(db, email!);
    const refused = refuseReason(fresh, { email: values.confirmar, code: values.codigo });
    if (refused) throw new Refused(refused);
    // antes de apagar os tokens, tenta revogar o acesso do app na Meta e no Google; falha não para a exclusão
    outcomes = await revokeAll(await readTokens(db, fresh), { metaAppSecret: process.env.DELETE_ACCOUNT_META_APP_SECRET });
    await applyPlan(db, fresh);
    return fresh;
  });
  console.log(`Banco: exclusão concluída para ${plan.email}.\n`);
  console.log(`${renderRevocations(outcomes)}\n`);
  if (outcomes.some((o) => !o.revoked)) process.exitCode = 2;
  const files = plan.workspaces.flatMap((w) => w.files);
  // daqui em diante o banco já foi: um erro não pode dizer que nada foi apagado
  await removeFiles(files).catch((err) => listLeftovers(`não deu para falar com o Storage (${err instanceof Error ? err.message : String(err)})`, files));
}

class Refused extends Error {}

function listLeftovers(reason: string, files: string[]) {
  console.log(`\nATENÇÃO: o banco já foi apagado, mas faltou remover estes arquivos: ${reason}. Remova à mão:`);
  for (const f of files) console.log(`  ${f}`);
  process.exitCode = 2;
}

/** Os arquivos saem pela API do Storage, depois da transação: no pior caso, a lista fica na tela. */
async function removeFiles(files: string[]) {
  if (!files.length) return console.log("Nenhum arquivo no Storage.\n");
  const baseUrl = process.env.DELETE_ACCOUNT_SUPABASE_URL;
  const key = process.env.DELETE_ACCOUNT_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) return listLeftovers("sem DELETE_ACCOUNT_SUPABASE_URL e DELETE_ACCOUNT_SERVICE_ROLE_KEY", files);
  const client = createClient(baseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const byBucket = new Map<string, string[]>();
  for (const f of files) {
    const [bucket, ...rest] = f.split("/");
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), rest.join("/")]);
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    const { error } = await client.storage.from(bucket).remove(paths);
    if (error) listLeftovers(`erro em ${bucket} (${error.message})`, paths.map((p) => `${bucket}/${p}`));
    else removed += paths.length;
  }
  if (removed) console.log(`Storage: ${removed} arquivo(s) removido(s).\n`);
}

// qualquer erro desfaz a transação inteira; a revogação, se já aconteceu, não volta
(values.apply ? apply() : simulate())
  .catch((err) => {
    if (outcomes.some((o) => o.revoked)) console.error(`\nO banco desfez a exclusão, mas a revogação na origem já tinha acontecido:\n${renderRevocations(outcomes)}`);
    fail(err instanceof Refused ? err.message : `Nada foi apagado no banco. ${err instanceof Error ? err.message : String(err)}`);
  })
  .finally(() => sql.end({ timeout: 5 }));
