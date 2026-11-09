import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY, classifyWorkspace, normalizeEmail, planCode, refuseReason, REMOVED_WITH_USER, renderPlan, SHELL_KEEPS, SHELL_PURGE_ORDER, type DeletionPlan, type WorkspacePlan } from "./account-deletion";

const ws = (over: Partial<WorkspacePlan> = {}): WorkspacePlan => ({ id: "w1", name: "Loja", role: "owner", members: 1, mode: "delete", invoices: 0, payments: 0, liveSubscriptions: [], counts: {}, files: [], ...over });
const plan = (over: Partial<DeletionPlan> = {}): DeletionPlan => ({ email: "pessoa@exemplo.com", userId: "u1", workspaces: [ws()], userRows: {}, kept: {}, revocations: [], blockers: [], warnings: [], ...over });

describe("o que acontece com cada workspace", () => {
  it("com outros membros, fica com a equipe", () => {
    expect(classifyWorkspace(2, 0, 0)).toBe("leave");
    expect(classifyWorkspace(3, 5, 5)).toBe("leave");
  });
  it("sozinho e sem registro financeiro, apaga por inteiro", () => {
    expect(classifyWorkspace(1, 0, 0)).toBe("delete");
  });
  it("sozinho e com fatura ou pagamento, vira casca: o restrict e a lei seguram", () => {
    expect(classifyWorkspace(1, 1, 0)).toBe("shell");
    expect(classifyWorkspace(1, 0, 1)).toBe("shell");
  });
});

describe("a confirmação explícita", () => {
  const code = planCode(plan());
  it("sem o e-mail repetido ou sem o código, não apaga", () => {
    expect(refuseReason(plan(), {})).toMatch(/--confirmar/);
    expect(refuseReason(plan(), { email: "outra@exemplo.com", code })).toMatch(/--confirmar/);
    expect(refuseReason(plan(), { email: "pessoa@exemplo.com" })).toMatch(/código não confere/);
    expect(refuseReason(plan(), { email: "pessoa@exemplo.com", code: "errado" })).toMatch(/código não confere/);
  });
  it("com os dois certos, pode (e-mail sem diferenciar maiúsculas)", () => {
    expect(refuseReason(plan(), { email: " Pessoa@Exemplo.com ", code })).toBeNull();
  });
  it("com bloqueio, não apaga nem com a confirmação certa", () => {
    const blocked = plan({ blockers: ["assinatura viva"] });
    expect(refuseReason(blocked, { email: blocked.email, code: planCode(blocked) })).toMatch(/bloqueios/);
  });
  it("o código muda se o destino de um workspace mudar", () => {
    expect(planCode(plan({ workspaces: [ws({ mode: "shell", invoices: 1 })] }))).not.toBe(code);
    expect(planCode(plan({ workspaces: [ws({ id: "w2" })] }))).not.toBe(code);
    expect(planCode(plan({ userId: "u2" }))).not.toBe(code);
  });
  it("o código não muda porque a sincronização trouxe mais métricas", () => {
    expect(planCode(plan({ workspaces: [ws({ counts: { insights_ad_daily: 99 } })] }))).toBe(code);
  });
  it("normaliza o e-mail", () => {
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
  });
});

describe("o relatório da simulação", () => {
  const text = renderPlan(
    plan({
      userRows: { push_tokens: 2, whatsapp_subscriptions: 1 },
      kept: { invoices: 3, auth_events: 9 },
      workspaces: [
        ws({ counts: { insights_ad_daily: 10, ad_accounts: 1, dashboards: 2, projects: 1, optimization_runs: 4, tasks: 5, connections: 1, invoices: 3 }, files: ["brand-assets/w1/logo.png"] }),
        ws({ id: "w2", name: "Equipe", mode: "leave", members: 3 }),
      ],
    }),
  );
  it("mostra o que será apagado, por tipo", () => {
    for (const label of ["Perfil e login", "Tokens de push: 2", "WhatsApp: 1", "Métricas e contas de anúncio: 11", "Dashboards: 2", "Projetos: 1", "Otimizações: 4", "Tarefas: 5", "Tokens e conexões: 1", "Arquivos no Storage: 1"]) {
      expect(text, label).toContain(label);
    }
  });
  it("mostra o que fica, com o motivo", () => {
    expect(text).toContain("O QUE FICA");
    expect(text).toMatch(/3 em invoices: .*legislação tributária/);
    expect(text).toMatch(/9 em auth_events: .*Marco Civil/);
    expect(text).toContain("audit_events");
  });
  it("o fiscal e os registros de acesso aparecem mesmo zerados", () => {
    const empty = renderPlan(plan());
    expect(empty).toMatch(/0 em invoices/);
    expect(empty).toMatch(/0 em payment_transactions/);
    expect(empty).toMatch(/0 em auth_events: .*Marco Civil/);
  });
  it("não conta a fatura entre o que é apagado", () => {
    expect(text).not.toMatch(/Sem classificação \(invoices\)/);
  });
  it("o workspace com equipe aparece como fica", () => {
    expect(text).toMatch(/"Equipe"[^]*FICA com a equipe/);
  });
  it("mostra os bloqueios", () => {
    expect(renderPlan(plan({ blockers: ["assinatura viva"] }))).toMatch(/BLOQUEIOS[^]*assinatura viva/);
  });
});

// Lê as migrações: tabela nova com workspace_id precisa dizer o que acontece com ela aqui.
const sqlFiles = () => {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8").replace(/--[^\n]*/g, ""));
};

function tablesWithWorkspaceId() {
  const out = new Set<string>();
  for (const sql of sqlFiles()) {
    for (const m of sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\)/g)) {
      if (/^\s*workspace_id\s/m.test(m[2])) out.add(m[1]);
    }
  }
  return out;
}

/** O que sai em cascata por um pai da lista, sem precisar estar nela. */
const CASCADED = new Set([
  "ad_campaigns", "ads", "ad_products", "insights_account_daily", "insights_ad_daily", "insights_breakdown_daily", "insights_campaign_daily", "insights_product_daily", "insights_search_term_daily",
  "dashboard_pages", "dashboard_sources", "share_links", "scheduled_reports", "scheduled_report_recipients", "landing_page_versions", "landing_page_submissions", "connection_secrets", "subscription_items",
]);

describe("a cobertura do banco", () => {
  const purge: readonly string[] = SHELL_PURGE_ORDER;
  const keeps: readonly string[] = SHELL_KEEPS;
  const withUser: readonly string[] = REMOVED_WITH_USER;

  it("toda tabela com workspace_id tem destino: apagar, cascata, ficar ou sair com a pessoa", () => {
    const missing = [...tablesWithWorkspaceId()].filter((t) => !purge.includes(t) && !keeps.includes(t) && !withUser.includes(t) && !CASCADED.has(t));
    expect(missing).toEqual([]);
  });

  it("as duas tabelas com on delete restrict ficam: nunca entram na lista de apagar", () => {
    const restricted = sqlFiles().flatMap((sql) => [...sql.matchAll(/alter table public\.(\w+) add constraint \w+\s+foreign key \(workspace_id\) references public\.workspaces \(id\) on delete restrict/g)].map((m) => m[1]));
    expect(restricted.sort()).toEqual(["invoices", "payment_transactions"]);
    for (const t of restricted) {
      expect(purge).not.toContain(t);
      expect(keeps).toContain(t);
    }
  });

  it("as regras do banco não mudaram: nenhuma migração nova para isso", () => {
    const code = readFileSync(join(process.cwd(), "src/server/admin/account-deletion.ts"), "utf8");
    expect(code).not.toMatch(/disable trigger|session_replication_role|alter table|drop constraint/i);
  });

  it("toda tabela apagada tem rótulo no relatório", () => {
    for (const t of [...purge, ...CASCADED]) {
      if (t === "workspace_platforms" || t in CATEGORY) continue;
      expect.fail(`sem rótulo: ${t}`);
    }
  });

  it("os dados fiscais nunca são apagados: nem invoices, nem pagamentos, em nenhum comando", () => {
    const code = readFileSync(join(process.cwd(), "src/server/admin/account-deletion.ts"), "utf8");
    expect(code).not.toMatch(/delete from public\.(invoices|payment_transactions|billing_customers)/);
  });
});

describe("o script não aponta para o banco por acidente", () => {
  const cli = readFileSync(join(process.cwd(), "scripts/admin/delete-account-data.ts"), "utf8").replace(/\/\/[^\n]*/g, "");
  it("não lê o .env.local e usa uma variável só dele", () => {
    expect(cli).not.toMatch(/loadEnvFile|SUPABASE_DB_URL/);
    expect(cli).toContain("process.env.DELETE_ACCOUNT_DB_URL");
  });
  it("sem --apply, a transação é só de leitura", () => {
    expect(cli).toMatch(/sql\.begin\("read only"/);
    expect(cli).toMatch(/values\.apply \? apply\(\) : simulate\(\)/);
  });
  it("com --apply, o plano é refeito na transação e passa pela confirmação antes de apagar", () => {
    const body = cli.slice(cli.indexOf("async function apply"));
    expect(body.indexOf("refuseReason")).toBeLessThan(body.indexOf("applyPlan"));
    expect(body.indexOf("loadPlan")).toBeLessThan(body.indexOf("refuseReason"));
  });
});
