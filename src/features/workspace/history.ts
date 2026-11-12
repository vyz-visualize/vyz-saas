// Textos do histórico em Configurações: acessos da conta (auth_events),
// atividade do workspace (activity_events) e mudanças de dados
// (audit_events). Puro: o servidor monta os DTOs com estas funções.

export type AuthEventName =
  | "signup"
  | "sign_in"
  | "sign_in_failed"
  | "sign_out"
  | "oauth_sign_in"
  | "password_reset_requested"
  | "password_updated"
  | "email_changed"
  | "rate_limited";

export type HistoryTone = "ok" | "warn" | "neutral";

const AUTH_EVENTS: Record<AuthEventName, { label: string; tone: HistoryTone }> = {
  signup: { label: "Conta criada", tone: "ok" },
  sign_in: { label: "Entrou", tone: "ok" },
  oauth_sign_in: { label: "Entrou com o Google", tone: "ok" },
  sign_in_failed: { label: "Tentativa de entrar com senha errada", tone: "warn" },
  sign_out: { label: "Saiu", tone: "neutral" },
  password_reset_requested: { label: "Pediu link para nova senha", tone: "neutral" },
  password_updated: { label: "Trocou a senha", tone: "ok" },
  email_changed: { label: "Trocou o e-mail", tone: "neutral" },
  rate_limited: { label: "Bloqueado por muitas tentativas", tone: "warn" },
};

const METHOD_LABEL: Record<string, string> = {
  password: "e-mail e senha",
  google: "Google",
  magic_link: "link por e-mail",
  checkout: "assinatura",
  admin: "suporte",
};

/** "Entrou · e-mail e senha", "Saiu de todos os aparelhos". */
export function authEventLabel(event: string, method: string | null, metadata: Record<string, unknown> = {}): { label: string; tone: HistoryTone } {
  const base = AUTH_EVENTS[event as AuthEventName] ?? { label: "Evento de acesso", tone: "neutral" as const };
  if (event === "sign_out" && metadata.scope === "global") return { label: "Saiu de todos os aparelhos", tone: "neutral" };
  if (event === "password_updated" && metadata.via === "recovery") return { label: "Criou nova senha pelo link do e-mail", tone: "ok" };
  const how = method && event !== "oauth_sign_in" && event !== "sign_out" ? METHOD_LABEL[method] : undefined;
  return how ? { label: `${base.label} · ${how}`, tone: base.tone } : base;
}

const ACTIVITY_LABEL: Record<string, string> = {
  "billing.checkout_completed": "Assinatura paga",
  "onboarding.started": "Começou o primeiro acesso",
  "onboarding.business_chosen": "Primeiro projeto e segmento escolhidos",
  "onboarding.connected": "Primeiro acesso: contas conectadas",
  "onboarding.completed": "Primeiro acesso concluído",
  "onboarding.skipped": "Primeiro acesso pulado (passos pendentes na Início)",
  "onboarding.replayed": "Primeiro acesso refeito",
  "onboarding.step_back": "Voltou um passo no primeiro acesso",
  "billing.plan_changed": "Plano alterado",
  "billing.cancel_scheduled": "Cancelamento agendado",
  "billing.cancel_reverted": "Cancelamento desfeito",
  "integration.connect_started": "Começou a conectar uma plataforma",
  "integration.connected": "Plataforma conectada",
  "integration.connect_canceled": "Conexão cancelada no provedor",
  "integration.connect_failed": "Conexão falhou",
  "integration.disconnected": "Plataforma desconectada",
  "ad_accounts.selection_changed": "Contas ativas alteradas",
  "ad_account.added": "Conta cadastrada pelo ID",
  "ad_account.removed": "Conta removida",
  "sync.finished": "Sincronização concluída",
  "sync.failed": "Sincronização falhou",
  "dashboard.viewed": "Dashboard aberto",
  "dashboard.exported": "Dashboard exportado em PDF",
  "share_link.viewed": "Link compartilhado aberto",
  "report.sent": "Relatório enviado",
  "workspace.logo_updated": "Logo da marca trocado",
  "workspace.logo_removed": "Logo da marca removido",
  "team.invited": "Convite enviado para a equipe",
  "team.invitation_revoked": "Convite cancelado",
  "team.invitation_accepted": "Convite aceito",
  "team.role_changed": "Papel de um membro alterado",
  "team.member_removed": "Membro removido da equipe",
  "landing.leads_exported": "Leads exportados (CSV)",
};

const PROVIDER_LABEL: Record<string, string> = { meta: "Meta Ads", google: "Google Ads" };

/** Rótulo de um activity_events.event; o detalhe vem do metadata quando ajuda. */
export function activityLabel(event: string, metadata: Record<string, unknown> = {}): string {
  const base = ACTIVITY_LABEL[event] ?? event;
  const provider = typeof metadata.provider === "string" ? PROVIDER_LABEL[metadata.provider] : undefined;
  if (provider && event.startsWith("integration.")) return `${base} · ${provider}`;
  return base;
}

/** Atividade com falha ou bloqueio pede atenção. */
export const activityTone = (event: string): HistoryTone => (/\.(failed|connect_failed)$/.test(event) || event.endsWith("_failed") ? "warn" : "neutral");

// O que cada tabela auditada é para quem lê (com artigo).
const TABLE_NOUN: Record<string, string> = {
  workspaces: "o workspace",
  workspace_members: "um membro da equipe",
  workspace_invitations: "um convite",
  workspace_platforms: "uma plataforma do workspace",
  dashboards: "o dashboard",
  dashboard_pages: "uma página de dashboard",
  dashboard_sources: "uma conta de dashboard",
  share_links: "um link compartilhado",
  scheduled_reports: "um relatório agendado",
  scheduled_report_recipients: "um destinatário de relatório",
  landing_pages: "a landing page",
  ad_accounts: "a conta",
  connections: "uma conexão",
  subscriptions: "a assinatura",
  subscription_items: "um item da assinatura",
  invoices: "uma fatura",
  payment_transactions: "um pagamento",
  billing_customers: "os dados de cobrança",
  service_orders: "um pedido de serviço",
  checkout_sessions: "um pedido",
};

const VERB: Record<string, string> = { insert: "Criou", update: "Alterou", delete: "Apagou" };

// Colunas que só o servidor mexe: não viram "alterou" no histórico.
const NOISE = new Set(["updated_at", "last_synced_at", "last_viewed_at", "view_count", "last_run_at", "synced_at"]);

/**
 * "Criou o dashboard “Loja”". null = mudança sem interesse para quem lê
 * (só colunas de batimento do servidor, ou tabela fora do workspace).
 */
export function auditLabel(e: { action: string; table: string; name?: string | null; changedColumns?: string[] | null }): string | null {
  const noun = TABLE_NOUN[e.table];
  const verb = VERB[e.action];
  if (!noun || !verb) return null;
  if (e.table === "workspace_members") return e.action === "insert" ? "Adicionou um membro à equipe" : e.action === "delete" ? "Removeu um membro da equipe" : "Mudou o papel de um membro";
  if (e.action === "update" && e.changedColumns && e.changedColumns.length > 0 && e.changedColumns.every((c) => NOISE.has(c))) return null;
  const name = e.name?.trim();
  // o nome só acompanha o que tem nome próprio ("o dashboard", "a landing page")
  const named = name && /^(o|a) /.test(noun);
  return named ? `${verb} ${noun} “${name}”` : `${verb} ${noun}`;
}

/** "Chrome no macOS", "Safari no iPhone". Sem user agent: "Navegador desconhecido". */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "Navegador desconhecido";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|undici|python|Go-http/i.test(ua)
              ? "Script"
              : "Navegador";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  return os ? `${browser} no ${os}` : browser;
}
