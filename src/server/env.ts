import "server-only";

// Variáveis do servidor, validadas na primeira leitura. Pagamento e OAuth
// simulados (mock) não sobem para produção sem ALLOW_MOCKS_IN_PRODUCTION=true:
// um checkout simulado em produção criaria contas sem cobrança.

import { z } from "zod";

const optional = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

const Schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    BILLING_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
    INTEGRATIONS_MODE: z.enum(["mock", "live"]).default("mock"),
    ALLOW_MOCKS_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
    /**
     * Pagamento simulado em produção: só estes e-mails (separados por vírgula)
     * assinam sem pagar. Vazio = ninguém. Fora de produção, todos.
     */
    BILLING_FREE_EMAILS: z.string().default(""),
    /** Bearer da sincronização agendada (/api/cron/sync). */
    CRON_SECRET: z
      .string()
      .trim()
      .transform((v) => v || undefined)
      .pipe(z.string().min(16).optional())
      .optional(),
    STRIPE_SECRET_KEY: optional,
    /** Segredo do webhook do RevenueCat (compras no app). */
    REVENUECAT_WEBHOOK_SECRET: optional,
    /** Chave secreta da API do RevenueCat (sk_...): lê o estado da assinatura da loja. */
    REVENUECAT_SECRET_API_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    META_APP_ID: optional,
    META_APP_SECRET: optional,
    META_LOGIN_CONFIG_ID: optional,
    GOOGLE_OAUTH_CLIENT_ID: optional,
    GOOGLE_OAUTH_CLIENT_SECRET: optional,
    GOOGLE_ADS_DEVELOPER_TOKEN: optional,
  })
  .superRefine((env, ctx) => {
    const mocks = env.BILLING_PROVIDER === "mock" || env.INTEGRATIONS_MODE === "mock";
    if (env.NODE_ENV === "production" && mocks && env.ALLOW_MOCKS_IN_PRODUCTION !== "true") {
      ctx.addIssue({ code: "custom", message: "Pagamento ou integrações simulados em produção. Configure as credenciais reais ou defina ALLOW_MOCKS_IN_PRODUCTION=true." });
    }
    if (env.BILLING_PROVIDER === "stripe" && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)) {
      ctx.addIssue({ code: "custom", message: "BILLING_PROVIDER=stripe exige STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET." });
    }
    if (env.INTEGRATIONS_MODE === "live" && (!env.META_APP_ID || !env.META_APP_SECRET || !env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET)) {
      ctx.addIssue({ code: "custom", message: "INTEGRATIONS_MODE=live exige as credenciais do Meta e do Google." });
    }
  });

export type ServerEnv = z.infer<typeof Schema>;

let cached: ServerEnv | null = null;

// Nomes alternativos aceitos (usados no handoff e na Vercel): o nome oficial
// vence quando os dois existem.
const ALIASES: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  REVENUECAT_WEBHOOK_SECRET: "REVENUECAT_WEBHOOK_AUTH",
};

function withAliases(env: NodeJS.ProcessEnv) {
  const out: Record<string, string | undefined> = { ...env };
  for (const [name, alias] of Object.entries(ALIASES)) {
    if (!out[name]?.trim() && out[alias]?.trim()) out[name] = out[alias];
  }
  return out;
}

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = Schema.safeParse(withAliases(process.env));
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${parsed.error.issues.map((i) => `- ${i.path.join(".") || "env"}: ${i.message}`).join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

export const isMockBilling = () => serverEnv().BILLING_PROVIDER === "mock";

/**
 * Este e-mail pode concluir um pedido? Com cobrança real, sempre. Com o
 * pagamento simulado em produção, só quem está em BILLING_FREE_EMAILS (o
 * acesso de teste; o resto do público vê "pagamento em breve").
 */
export function canCheckout(email: string | null | undefined): boolean {
  const env = serverEnv();
  if (env.BILLING_PROVIDER !== "mock" || env.NODE_ENV !== "production") return true;
  const list = env.BILLING_FREE_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.trim().toLowerCase());
}

export const CHECKOUT_CLOSED_MESSAGE = "O pagamento online abre em breve. Fale com um especialista no WhatsApp para assinar agora.";
export const isMockIntegrations = () => serverEnv().INTEGRATIONS_MODE === "mock";
