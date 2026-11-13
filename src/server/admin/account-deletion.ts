// Exclusão total de uma conta, para atender os pedidos de /exclusao-de-dados. Usado pela
// CLI scripts/admin/delete-account-data.ts; o passo a passo está em docs/EXCLUSAO-DE-DADOS.md.
//
// O nó: invoices e payment_transactions seguram o workspace (on delete restrict) e a lei
// manda guardá-los. Então, para cada workspace em que a pessoa é o único membro:
//   - sem registro financeiro: apaga o workspace, e o resto sai em cascata;
//   - com registro financeiro: apaga tudo o que há nele, menos o fiscal, e anonimiza a linha
//     do workspace, que fica como casca para segurar as faturas até o fim do prazo legal.
// Nenhuma regra do banco muda e nenhum gatilho é desligado. Tudo roda numa transação só;
// se a conferência final achar sobra, nada é apagado.

import { createHash } from "node:crypto";
import { providerLabel, type AccessToRevoke, type StoredTokens } from "./revoke-access";

/** O mínimo de um banco: postgres (na CLI) ou um Postgres de teste. */
export type Db = { query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]> };

export type WorkspaceMode = "delete" | "shell" | "leave";

export type WorkspacePlan = {
  id: string;
  name: string;
  role: string;
  members: number;
  mode: WorkspaceMode;
  invoices: number;
  payments: number;
  /** Assinaturas vivas num provedor de verdade: apagar não cancela a cobrança lá. */
  liveSubscriptions: { id: string; provider: string; status: string }[];
  /** Linhas por tabela neste workspace. */
  counts: Record<string, number>;
  /** Arquivos no Storage (bucket/caminho), removidos depois da transação. */
  files: string[];
};

export type DeletionPlan = {
  email: string;
  userId: string | null;
  workspaces: WorkspacePlan[];
  /** Linhas ligadas à pessoa, fora dos workspaces que ela leva junto. */
  userRows: Record<string, number>;
  /** Linhas que ficam, por obrigação legal ou histórico imutável. */
  kept: Record<string, number>;
  /** Conexões reais nos workspaces que saem: o acesso do app é revogado na origem antes de apagar. */
  revocations: AccessToRevoke[];
  blockers: string[];
  warnings: string[];
};

/** Filhos diretos do workspace, apagados quando ele fica como casca. O resto sai em cascata. */
export const SHELL_PURGE_ORDER = [
  "workspace_invitations",
  "whatsapp_subscriptions",
  "task_automation_runs",
  "tasks",
  "task_groups",
  "optimization_runs",
  "optimization_autopilot",
  "report_deliveries",
  "dashboard_exports",
  "dashboards",
  "landing_waitlist",
  "landing_waitlist_visits",
  "landing_pages",
  "sync_runs",
  // MMM: eventos e resultados ficam pendurados no workspace (o resto do mmm sai com ad_accounts)
  "mmm.eventos",
  "mmm.outcomes_daily",
  "connections",
  "ad_accounts",
  "projects",
  "service_orders",
  "subscriptions",
  "store_customers",
  "oauth_states",
  "workspace_platforms",
] as const;

/** O que fica na casca: o fiscal, e os históricos que nem a chave de serviço altera. */
export const SHELL_KEEPS = ["invoices", "payment_transactions", "billing_customers", "checkout_sessions", "audit_events", "activity_events", "subscription_changes"] as const;

/** Tabelas com workspace_id que saem junto com a pessoa (auth.users em cascata). */
export const REMOVED_WITH_USER = ["workspace_members", "project_members", "product_events"] as const;

/** Rótulo de cada tabela no relatório. Tabela nova sem rótulo aparece como "sem classificação". */
export const CATEGORY: Record<string, string> = {
  connections: "Tokens e conexões", connection_secrets: "Tokens e conexões", oauth_states: "Tokens e conexões",
  ad_accounts: "Métricas e contas de anúncio", ad_campaigns: "Métricas e contas de anúncio", ads: "Métricas e contas de anúncio", ad_products: "Métricas e contas de anúncio", sync_runs: "Métricas e contas de anúncio", insights_account_daily: "Métricas e contas de anúncio", insights_ad_daily: "Métricas e contas de anúncio", insights_breakdown_daily: "Métricas e contas de anúncio", insights_campaign_daily: "Métricas e contas de anúncio", insights_product_daily: "Métricas e contas de anúncio", insights_search_term_daily: "Métricas e contas de anúncio", organic_daily: "Métricas e contas de anúncio", organic_posts: "Métricas e contas de anúncio", analytics_daily: "Métricas e contas de anúncio", crm_daily: "Métricas e contas de anúncio",
  dashboards: "Dashboards", dashboard_pages: "Dashboards", dashboard_sources: "Dashboards", dashboard_launch_sheets: "Dashboards", dashboard_exports: "Dashboards", share_links: "Dashboards", scheduled_reports: "Dashboards", scheduled_report_recipients: "Dashboards", report_deliveries: "Dashboards",
  projects: "Workspaces",
  "mmm.raw_insights": "Base de MMM", "mmm.media_daily": "Base de MMM", "mmm.outcomes_daily": "Base de MMM", "mmm.eventos": "Base de MMM", "mmm.daily": "Base de MMM", "mmm.backfill_jobs": "Base de MMM",
  optimization_runs: "Otimizações", optimization_autopilot: "Otimizações",
  tasks: "Tarefas", task_groups: "Tarefas", task_automation_runs: "Tarefas",
  whatsapp_subscriptions: "WhatsApp", whatsapp_messages: "WhatsApp", whatsapp_verification_codes: "WhatsApp",
  push_tokens: "Tokens de push",
  landing_pages: "Landing pages e leads", landing_page_versions: "Landing pages e leads", landing_page_submissions: "Landing pages e leads", landing_waitlist: "Landing pages e leads", landing_waitlist_visits: "Landing pages e leads",
  subscriptions: "Assinatura", subscription_items: "Assinatura", service_orders: "Assinatura", store_customers: "Assinatura",
  workspace_members: "Membros e convites", project_members: "Membros e convites", workspace_invitations: "Membros e convites", workspace_platforms: "Membros e convites",
  profiles: "Perfil", credit_ledger: "Créditos", product_events: "Histórico de produtos",
};

/** O que fica, com o motivo e o prazo, para o relatório e para a resposta ao titular. */
export const KEPT_REASON: Record<string, string> = {
  invoices: "faturas: legislação tributária (em geral, 5 anos)",
  payment_transactions: "pagamentos: legislação tributária (em geral, 5 anos)",
  billing_customers: "dados fiscais do cliente nas organizações com fatura: legislação tributária",
  checkout_sessions: "compras concluídas (com CPF ou CNPJ): legislação tributária",
  auth_events: "registros de acesso: Marco Civil (mínimo de 6 meses); apagados em 2 anos",
  activity_events: "atividade: histórico imutável, apagado em 13 meses",
  audit_events: "auditoria, com cópia das linhas apagadas: histórico imutável, apagado em 5 anos",
  legal_acceptances: "aceites de termos: prova de consentimento, histórico imutável",
  subscription_changes: "mudanças de assinatura: histórico imutável",
};

const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"];

/** Só entra em SQL dinâmico o que veio do catálogo do banco e tem cara de nome de tabela. */
/** "tabela" (public) ou "mmm.tabela": só os schemas de dados de cliente. */
const ident = (name: string) => {
  const [schema, table] = name.includes(".") ? name.split(".") : ["public", name];
  if (!["public", "mmm"].includes(schema) || !/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`Nome de tabela inesperado: ${name}`);
  return `${schema}."${table}"`;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** O que fazer com um workspace, pelos membros e pelos registros financeiros. */
export function classifyWorkspace(members: number, invoices: number, payments: number): WorkspaceMode {
  if (members > 1) return "leave";
  return invoices + payments > 0 ? "shell" : "delete";
}

/**
 * Código da simulação: muda se o plano mudar de forma relevante (quem, quais workspaces, o que
 * acontece com cada um). As contagens de métricas ficam de fora: a sincronização as altera.
 */
export function planCode(plan: DeletionPlan): string {
  const shape = {
    email: plan.email,
    userId: plan.userId,
    workspaces: plan.workspaces.map((w) => [w.id, w.mode, w.invoices, w.payments, w.liveSubscriptions.map((s) => s.id).sort()]).sort(),
    blockers: plan.blockers,
  };
  return createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 8);
}

export type Confirmation = { email?: string; code?: string };

/** Por que não pode apagar (null = pode). Exige o e-mail e o código da simulação que foi lida. */
export function refuseReason(plan: DeletionPlan, confirm: Confirmation): string | null {
  if (plan.blockers.length) return `Há bloqueios: ${plan.blockers.join(" ")}`;
  if (!confirm.email || normalizeEmail(confirm.email) !== plan.email) return "Confirme com --confirmar e o mesmo e-mail da conta.";
  const code = planCode(plan);
  if (confirm.code !== code) return `O código não confere: rode a simulação de novo e leia o que mudou (código atual: ${code}).`;
  return null;
}

async function tablesWith(db: Db, column: string): Promise<string[]> {
  const rows = await db.query<{ name: string }>(
    // public e mmm (a base do MMM também é dado do cliente); no mmm, o nome vem com o schema
    `select case when n.nspname = 'public' then c.relname else n.nspname || '.' || c.relname end as name
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attname = $1 and not a.attisdropped
      where n.nspname in ('public', 'mmm') and c.relkind in ('r', 'p') and not c.relispartition
      order by 1`,
    [column],
  );
  return rows.map((r) => r.name);
}

const countOf = async (db: Db, text: string, params: unknown[]) => (await db.query<{ n: number }>(`select count(*)::int as n from ${text}`, params))[0].n;

/** Monta o plano só com leituras. */
export async function loadPlan(db: Db, rawEmail: string): Promise<DeletionPlan> {
  const email = normalizeEmail(rawEmail);
  const user = (await db.query<{ id: string }>(`select id::text as id from auth.users where lower(email) = $1`, [email]))[0];
  const userId = user?.id ?? null;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const workspaces: WorkspacePlan[] = [];
  const userRows: Record<string, number> = {};
  const withWorkspace = await tablesWith(db, "workspace_id");

  if (userId) {
    const memberships = await db.query<{ id: string; name: string; role: string; members: number }>(
      `select w.id::text as id, w.name, m.role::text as role,
              (select count(*)::int from public.workspace_members o where o.workspace_id = w.id) as members
         from public.workspace_members m
         join public.workspaces w on w.id = m.workspace_id
        where m.user_id = $1::uuid
        order by w.created_at`,
      [userId],
    );
    for (const m of memberships) {
      const invoices = await countOf(db, `public.invoices where workspace_id = $1::uuid`, [m.id]);
      const payments = await countOf(db, `public.payment_transactions where workspace_id = $1::uuid`, [m.id]);
      const mode = classifyWorkspace(m.members, invoices, payments);
      const plan: WorkspacePlan = { ...m, mode, invoices, payments, liveSubscriptions: [], counts: {}, files: [] };
      if (mode === "leave") {
        if (m.role === "owner") warnings.push(`"${m.name}": a propriedade passa a outro membro. Os dados fiscais da organização continuam em nome de quem contratou; avise a equipe.`);
      } else {
        plan.liveSubscriptions = await db.query<{ id: string; provider: string; status: string }>(
          `select id::text as id, provider::text as provider, status::text as status
             from public.subscriptions
            where workspace_id = $1::uuid and provider::text <> 'mock' and status::text = any($2::text[])`,
          [m.id, LIVE_STATUSES],
        );
        for (const s of plan.liveSubscriptions) {
          blockers.push(`"${m.name}" tem assinatura viva (${s.provider}, ${s.status}). Cancele no provedor e rode de novo: apagar aqui não para a cobrança lá.`);
        }
        for (const table of withWorkspace) {
          const n = await countOf(db, `${ident(table)} where workspace_id = $1::uuid`, [m.id]);
          if (n) plan.counts[table] = n;
        }
        plan.files = (await db.query<{ path: string }>(`select bucket_id || '/' || name as path from storage.objects where name like $1 order by 1`, [`${m.id}/%`])).map((r) => r.path);
      }
      workspaces.push(plan);
    }
    const taken = workspaces.filter((w) => w.mode !== "leave").map((w) => w.id);
    for (const table of ["push_tokens", "whatsapp_subscriptions", "credit_ledger", "product_events", "landing_waitlist"]) {
      // o que está num workspace que sai junto já aparece nele: não conta duas vezes
      const outside = withWorkspace.includes(table);
      const n = await countOf(db, `${ident(table)} where user_id = $1::uuid${outside ? ` and (workspace_id is null or workspace_id <> all($2::uuid[]))` : ""}`, outside ? [userId, taken] : [userId]);
      if (n) userRows[table] = n;
    }
  }

  // o que aponta para a pessoa só pelo e-mail ou pelo telefone
  const invitations = await countOf(db, `public.workspace_invitations where lower(email) = $1`, [email]);
  if (invitations) userRows["Convites para este e-mail"] = invitations;
  const open = await countOf(db, `public.checkout_sessions where lower(email) = $1 and status::text <> 'completed'`, [email]);
  if (open) userRows["Compras não concluídas"] = open;
  const addresses = await contactAddresses(db, email, userId);
  const recipients = await countOf(db, `public.scheduled_report_recipients where address = any($1::text[])`, [addresses]);
  if (recipients) userRows["Destinatários de relatório"] = recipients;

  const kept: Record<string, number> = {};
  const fiscal = workspaces.filter((w) => w.mode === "shell");
  for (const table of ["invoices", "payment_transactions", "billing_customers"]) {
    const n = fiscal.reduce((sum, w) => sum + (w.counts[table] ?? 0), 0);
    if (n) kept[table] = n;
  }
  const completed = await countOf(db, `public.checkout_sessions where lower(email) = $1 and status::text = 'completed'`, [email]);
  if (completed) kept.checkout_sessions = completed;
  // estes registram também pelo e-mail: valem mesmo sem conta (tentativa de login, por exemplo)
  const auth = await countOf(db, `public.auth_events where user_id = $1::uuid or lower(email) = $2`, [userId, email]);
  if (auth) kept.auth_events = auth;
  const legal = await countOf(db, `public.legal_acceptances where user_id = $1::uuid or lower(email) = $2`, [userId, email]);
  if (legal) kept.legal_acceptances = legal;
  if (userId) {
    // sem chave estrangeira, de propósito: ficam mesmo quando o workspace é apagado
    const taken = workspaces.filter((w) => w.mode !== "leave").map((w) => w.id);
    for (const table of ["audit_events", "activity_events", "subscription_changes"]) {
      const n = await countOf(db, `${ident(table)} where actor_id = $1::uuid or workspace_id = any($2::uuid[])`, [userId, taken]);
      if (n) kept[table] = n;
    }
  }
  const revocations = await loadRevocations(db, workspaces);
  if (userId) warnings.push(...(await sharedAccessWarnings(db, userId, workspaces, revocations)));
  if (!userId) warnings.push("Nenhuma conta com este e-mail. Só o que aponta para o e-mail seria apagado.");
  return { email, userId, workspaces, userRows, kept, revocations, blockers, warnings };
}

/** As conexões reais (não simuladas) dos workspaces que saem junto com a pessoa. */
async function loadRevocations(db: Db, workspaces: WorkspacePlan[]): Promise<AccessToRevoke[]> {
  const taken = workspaces.filter((w) => w.mode !== "leave");
  if (!taken.length) return [];
  const rows = await db.query<{ connectionId: string; workspaceId: string; provider: string; account: string }>(
    `select c.id::text as "connectionId", c.workspace_id::text as "workspaceId", c.provider::text as provider,
            coalesce(c.external_user_name, c.external_user_email, c.external_user_id) as account
       from public.connections c
      where c.workspace_id = any($1::uuid[]) and not c.is_mock
      order by c.connected_at, c.id`,
    [taken.map((w) => w.id)],
  );
  return rows.map((r) => ({ ...r, workspaceName: taken.find((w) => w.id === r.workspaceId)?.name ?? "" }));
}

/**
 * Conexões que ficam com uma equipe e dependem do acesso da pessoa: feitas por ela, ou do mesmo
 * login que vai ser revogado (a Meta revoga o app para o login inteiro, não por workspace).
 */
async function sharedAccessWarnings(db: Db, userId: string, workspaces: WorkspacePlan[], revocations: AccessToRevoke[]): Promise<string[]> {
  const staying = workspaces.filter((w) => w.mode === "leave");
  if (!staying.length) return [];
  const revoked = new Set(revocations.map((r) => r.connectionId));
  const rows = await db.query<{ workspaceId: string; provider: string; account: string; mine: boolean; sameLogin: boolean }>(
    `select c.workspace_id::text as "workspaceId", c.provider::text as provider,
            coalesce(c.external_user_name, c.external_user_email, c.external_user_id) as account,
            c.connected_by = $2::uuid as mine,
            exists (select 1 from public.connections o
                     where o.id = any($3::uuid[]) and o.provider = c.provider and o.external_user_id = c.external_user_id) as "sameLogin"
       from public.connections c
      where c.workspace_id = any($1::uuid[]) and not c.is_mock
        and (c.connected_by = $2::uuid or exists (select 1 from public.connections o
              where o.id = any($3::uuid[]) and o.provider = c.provider and o.external_user_id = c.external_user_id))
      order by c.connected_at`,
    [staying.map((w) => w.id), userId, [...revoked]],
  );
  return rows.map((r) => {
    const name = staying.find((w) => w.id === r.workspaceId)?.name ?? r.workspaceId;
    const why = r.sameLogin ? "é do mesmo login que será revogado: ela para de sincronizar" : "foi feita pela pessoa e continua usando o acesso dela";
    return `"${name}": a conexão ${providerLabel(r.provider)} (${r.account}) ${why}. Avise a equipe para reconectar com outra conta.`;
  });
}

/** Os tokens de cada conexão a revogar, lidos do Vault pela função do banco. Nunca imprima. */
export async function readTokens(db: Db, plan: DeletionPlan): Promise<{ item: AccessToRevoke; tokens: StoredTokens | null }[]> {
  const out: { item: AccessToRevoke; tokens: StoredTokens | null }[] = [];
  for (const item of plan.revocations) {
    const row = (await db.query<{ access_token: string | null; refresh_token: string | null }>(`select access_token, refresh_token from public.connection_tokens_read($1::uuid)`, [item.connectionId]))[0];
    out.push({ item, tokens: row ? { accessToken: row.access_token, refreshToken: row.refresh_token } : null });
  }
  return out;
}

async function contactAddresses(db: Db, email: string, userId: string | null): Promise<string[]> {
  if (!userId) return [email];
  const phones = await db.query<{ phone: string }>(
    `select phone from public.whatsapp_subscriptions where user_id = $1::uuid
     union select phone from public.profiles where id = $1::uuid and phone is not null`,
    [userId],
  );
  // os destinatários guardam o telefone com ou sem o "+"
  return [email, ...phones.flatMap((p) => [p.phone, p.phone.replace(/^\+/, "")])];
}

/** Apaga, dentro da transação de quem chama. Se a conferência final falhar, lança e nada fica. */
export async function applyPlan(db: Db, plan: DeletionPlan): Promise<void> {
  if (plan.blockers.length) throw new Error(`Há bloqueios: ${plan.blockers.join(" ")}`);
  const { email, userId } = plan;
  const addresses = await contactAddresses(db, email, userId);

  // 1. o que aponta para a pessoa só pelo e-mail ou pelo telefone, inclusive em workspaces de outros
  await db.query(`delete from public.workspace_invitations where lower(email) = $1`, [email]);
  await db.query(`delete from public.scheduled_report_recipients where address = any($1::text[])`, [addresses]);

  if (userId) {
    // 2. passa a propriedade dos workspaces com equipe, encerra a assinatura e tira a pessoa dos outros
    await db.query(`select public.prepare_account_deletion($1::uuid)`, [userId]);

    for (const w of plan.workspaces) {
      if (w.mode === "delete") {
        // 3a. sem registro financeiro: nada segura o workspace; o resto sai em cascata
        await db.query(`delete from public.workspaces where id = $1::uuid`, [w.id]);
      } else if (w.mode === "shell") {
        // 3b. com registro financeiro: apaga o conteúdo e anonimiza a casca, que segura as faturas
        for (const table of SHELL_PURGE_ORDER) await db.query(`delete from ${ident(table)} where workspace_id = $1::uuid`, [w.id]);
        await db.query(
          `update public.workspaces
              set name = 'Conta excluída', slug = 'excluida-' || left(replace(id::text, '-', ''), 16),
                  brand_logo_path = null, hide_vyz_brand = false, business_type_id = null
            where id = $1::uuid`,
          [w.id],
        );
      }
    }
  }

  // 4. compras não concluídas; as concluídas ficam, sem o vínculo com a pessoa
  await db.query(`delete from public.checkout_sessions where lower(email) = $1 and status::text <> 'completed'`, [email]);

  // 5. a pessoa: perfil, login, membros, WhatsApp, push e créditos saem em cascata
  if (userId) await db.query(`delete from auth.users where id = $1::uuid`, [userId]);

  await verify(db, plan, addresses);
}

/** A conferência final, dentro da transação: qualquer sobra desfaz tudo. */
async function verify(db: Db, plan: DeletionPlan, addresses: string[]): Promise<void> {
  const left: string[] = [];
  const { email, userId } = plan;
  const check = async (label: string, text: string, params: unknown[]) => {
    const n = await countOf(db, text, params);
    if (n) left.push(`${label}: ${n}`);
  };
  await check("convites", `public.workspace_invitations where lower(email) = $1`, [email]);
  await check("destinatários", `public.scheduled_report_recipients where address = any($1::text[])`, [addresses]);
  await check("compras não concluídas", `public.checkout_sessions where lower(email) = $1 and status::text <> 'completed'`, [email]);
  if (userId) {
    await check("login", `auth.users where id = $1::uuid`, [userId]);
    for (const table of await tablesWith(db, "user_id")) {
      // estes guardam o id sem chave estrangeira, de propósito: é histórico
      if (["auth_events", "legal_acceptances"].includes(table)) continue;
      await check(table, `${ident(table)} where user_id = $1::uuid`, [userId]);
    }
  }
  const keeps: readonly string[] = SHELL_KEEPS;
  const tables = await tablesWith(db, "workspace_id");
  for (const w of plan.workspaces) {
    if (w.mode === "delete") await check(`workspace ${w.id}`, `public.workspaces where id = $1::uuid`, [w.id]);
    if (w.mode === "leave") continue;
    for (const table of tables) {
      if (keeps.includes(table) || table === "workspaces") continue;
      await check(`${table} da organização ${w.id}`, `${ident(table)} where workspace_id = $1::uuid`, [w.id]);
    }
  }
  if (left.length) throw new Error(`Sobrou dado depois da exclusão, nada foi apagado: ${left.join("; ")}`);
}

function totals(counts: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [table, n] of Object.entries(counts)) {
    const keeps: readonly string[] = SHELL_KEEPS;
    if (keeps.includes(table)) continue;
    const label = CATEGORY[table] ?? `Sem classificação (${table})`;
    out[label] = (out[label] ?? 0) + n;
  }
  return out;
}

const MODE_LABEL: Record<WorkspaceMode, string> = {
  delete: "APAGADO por inteiro (único membro, sem registro financeiro)",
  shell: "CONTEÚDO APAGADO e nome anonimizado; a casca fica para segurar as faturas",
  leave: "FICA com a equipe; só a pessoa sai",
};

/** O relatório da simulação. */
export function renderPlan(plan: DeletionPlan): string {
  const out: string[] = [`Conta: ${plan.email}${plan.userId ? ` (${plan.userId})` : " (não encontrada)"}`, ""];
  out.push("O QUE SERÁ APAGADO", "");
  if (plan.userId) out.push("  Perfil e login da pessoa");
  for (const [key, n] of Object.entries(plan.userRows)) out.push(`  ${CATEGORY[key] ?? key}: ${n}`);
  out.push("");
  out.push("WORKSPACES", "");
  if (!plan.workspaces.length) out.push("  Nenhum.");
  for (const w of plan.workspaces) {
    out.push(`  "${w.name}" (${w.id})`, `    ${MODE_LABEL[w.mode]}`);
    if (w.mode === "leave") {
      out.push(`    ${w.members} membros; papel: ${w.role}`);
    } else {
      for (const [label, n] of Object.entries(totals(w.counts))) out.push(`    ${label}: ${n}`);
      if (w.files.length) out.push(`    Arquivos no Storage: ${w.files.length}`);
    }
    out.push("");
  }
  out.push("ACESSO A REVOGAR NA ORIGEM (antes de apagar os tokens)", "");
  if (!plan.revocations.length) out.push("  Nenhuma conexão real (Meta ou Google) nas organizações que saem.");
  for (const r of plan.revocations) out.push(`  ${providerLabel(r.provider)} · ${r.account} (workspace "${r.workspaceName}")`);
  out.push("");
  out.push("O QUE FICA (obrigação legal ou histórico imutável)", "");
  // o fiscal e os registros de acesso aparecem sempre, mesmo zerados: a ausência também é resposta
  for (const [table, n] of Object.entries({ invoices: 0, payment_transactions: 0, auth_events: 0, ...plan.kept })) {
    out.push(`  ${n} em ${table}: ${KEPT_REASON[table] ?? "histórico"}`);
  }
  out.push("  Também ficam as cópias em audit_events das linhas apagadas agora, por 5 anos.", "");
  if (plan.warnings.length) {
    out.push("AVISOS", "");
    for (const w of plan.warnings) out.push(`  ${w}`);
    out.push("");
  }
  if (plan.blockers.length) {
    out.push("BLOQUEIOS (nada será apagado enquanto existirem)", "");
    for (const b of plan.blockers) out.push(`  ${b}`);
    out.push("");
  }
  return out.join("\n");
}
