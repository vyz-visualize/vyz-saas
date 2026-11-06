import "server-only";

// Erros do banco viram mensagens para o usuário. Os gatilhos e funções levantam
// SQLSTATE P0001 com message "<grupo>:<motivo>" e, às vezes, um hint em
// português (ex.: "Seu plano permite até 10 dashboards.").

import type { PostgrestError } from "@supabase/supabase-js";

export type ActionError = { code: string; message: string; fields?: Record<string, string> };
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
  toAction(): ActionError {
    return { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}) };
  }
}

const MESSAGES: Record<string, string> = {
  "auth:required": "Entre na sua conta para continuar.",
  forbidden: "Você não tem permissão para fazer isso neste workspace.",
  not_found: "Não encontramos o que você procurou.",
  conflict: "Isso já existe.",
  validation: "Confira os campos destacados.",
  rate_limited: "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.",
  "plan:inactive": "A assinatura deste workspace não está ativa.",
  "plan:template": "Este template é de um plano acima do seu.",
  "plan:page": "Esta página é de um plano acima do seu.",
  "plan:platform": "Esta plataforma é de um plano acima do seu. No Básico, contrate a plataforma extra.",
  "plan:white_label": "Marca própria é do plano Personalizado.",
  "plan:unknown": "Não encontramos o seu plano.",
  "limit:dashboards": "Você chegou ao limite de dashboards do seu plano.",
  "limit:landing_pages": "Você chegou ao limite de landing pages publicadas do seu plano.",
  "limit:accounts": "Este projeto já tem o máximo de contas desta plataforma no seu plano.",
  "limit:projects": "Você chegou ao limite de projetos do seu plano. Contrate mais projetos em Plano.",
  "limit:projects_in_use": "Há mais projetos ativos do que o novo plano permite. Arquive alguns antes.",
  "dashboard:source_project": "Essa conta é de outro projeto.",
  "project:not_found": "Projeto não encontrado.",
  "limit:members": "Você chegou ao limite de usuários do seu plano.",
  "limit:members_in_use": "Há mais pessoas na equipe do que o novo plano permite. Remova algumas antes.",
  "workspace:last_owner": "O workspace precisa de pelo menos um dono.",
  "dashboard:source_platform": "Essa conta não é de uma plataforma deste dashboard.",
  "dashboard:template_unavailable": "Este template não está disponível.",
  "dashboard:page_template_only": "Esta página só existe no template que a traz.",
  "dashboard:no_pages": "O dashboard precisa de pelo menos uma página.",
  "dashboard:not_found": "Dashboard não encontrado.",
  "landing:template_unavailable": "Este template não está disponível.",
  "checkout:not_found": "Pedido não encontrado.",
  "checkout:not_open": "Este pedido já foi concluído ou expirou.",
  "checkout:not_owner": "Só o dono do workspace pode assinar por ele.",
  "integration:missing_token": "A conexão não devolveu um token válido.",
  "integration:not_found": "Conexão não encontrada.",
  "invitation:invalid": "Este convite expirou ou já foi usado.",
  "invitation:email_mismatch": "Este convite é de outro e-mail.",
  "auth:invalid_credentials": "E-mail ou senha incorretos.",
  "auth:google_disabled": "Login com Google precisa ser ativado no Supabase.",
  "auth:apple_disabled": "Login com Apple precisa ser ativado no Supabase.",
  "auth:recovery_expired": "O link de nova senha expirou. Peça outro.",
  "auth:reauthentication": "Por segurança, saia e entre de novo antes de trocar a senha.",
  "account:not_connected": "Só contas conectadas e ativas podem ser ligadas.",
  "dashboard:source_disabled": "Ative a conta antes de usá-la num dashboard.",
  "landing:slug_retired": "Esse endereço foi usado por outra conta há pouco tempo. Escolha outro.",
  "checkout:invalid_order": "O pedido não fecha com os itens. Monte o pedido de novo.",
  "checkout:already_subscribed": "Este workspace já tem uma assinatura ativa. Troque o plano em Plano.",
  "checkout:email_exists": "Já existe uma conta com este e-mail. Entre para continuar.",
  "checkout:over_limit": "Mais de 200 projetos é sob consulta: fale com um especialista.",
  "checkout:recurring_without_plan": "Itens mensais precisam de um plano.",
  "checkout:empty": "O pedido está vazio.",
  "checkout:no_user": "Entre na sua conta para concluir o pedido.",
  "billing:customer_in_use": "Este cliente do provedor de pagamento já é de outro workspace.",
  "billing:not_configured": "A cobrança real ainda não está configurada.",
  "billing:card_declined": "O cartão foi recusado. Tente outro cartão.",
  "billing:insufficient_funds": "O cartão não tem limite para esta compra.",
  "billing:expired_card": "O cartão está vencido.",
  "limit:accounts_in_use": "Há mais contas ativas do que o novo plano permite. Desative algumas antes.",
  "limit:dashboards_in_use": "Há mais dashboards do que o novo plano permite. Apague alguns antes.",
  "limit:landing_pages_in_use": "Há mais landing pages publicadas do que o novo plano permite. Despublique algumas antes.",
  "plan:platform_in_use": "Há contas de plataformas que o novo plano não inclui. Desative-as antes.",
  "integration:platform_mismatch": "A conta não é da plataforma desta conexão.",
  "integration:invalid_accounts": "A lista de contas veio num formato inválido.",
  "sync:running": "Esta conta já está sincronizando. Espere terminar.",
  "sync:account_disabled": "Ative a conta antes de sincronizar.",
  "sync:not_configured": "A sincronização real ainda não está configurada.",
  "onboarding:step": "Este passo ainda não chegou. Recarregue a página.",
  "onboarding:business_unavailable": "Este tipo de negócio ainda não está disponível. Por enquanto, o VYZ atende e-commerce.",
  "onboarding:no_platforms": "Escolha pelo menos uma plataforma disponível no seu plano.",
  "onboarding:no_accounts": "Conecte uma plataforma e ative pelo menos uma conta para continuar.",
  unknown: "Algo deu errado. Tente de novo em instantes.",
};

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.unknown;
}

export function appError(code: string, message?: string, fields?: Record<string, string>): AppError {
  return new AppError(code, message ?? messageFor(code), fields);
}

/** Traduz um erro do PostgREST/Postgres. */
export function fromPostgrest(error: PostgrestError): AppError {
  if (error.code === "P0001" && /^[a-z_]+:[a-z_]+$/.test(error.message)) {
    return new AppError(error.message, error.hint || messageFor(error.message));
  }
  switch (error.code) {
    case "23505":
      return appError("conflict");
    case "23503":
    case "23514":
    case "22P02":
      return appError("validation");
    case "42501":
      return appError("forbidden");
    case "PGRST116":
      return appError("not_found");
    default:
      return appError("unknown");
  }
}

/** Lança se houver erro; devolve os dados tipados. */
export function unwrap<T>(result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw fromPostgrest(result.error);
  return result.data;
}

/** Converte qualquer erro em ActionResult (para Server Actions). */
export function toActionError(err: unknown): { ok: false; error: ActionError } {
  if (err instanceof AppError) return { ok: false, error: err.toAction() };
  // redirect()/notFound() do Next lançam erros próprios: quem chama deve relançá-los.
  console.error("[vyz] erro inesperado", err);
  return { ok: false, error: { code: "unknown", message: messageFor("unknown") } };
}
