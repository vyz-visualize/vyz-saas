// Logins que conectam plataformas (OAuth) e o que cada um pede. Compartilhado
// entre o servidor (rotas de conexão, provedores) e a interface (botões, tela
// simulada). Só dados: pode ir para o navegador.

import type { PlatformId } from "@/features/accounts/platforms";

export const PROVIDER_IDS = ["meta", "google", "ga4", "tiktok", "linkedin", "mercado", "rdstation", "hubspot", "pipedrive", "kommo"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Os dois logins principais: aparecem sempre (onboarding, início, tela de contas). */
export const CORE_PROVIDER_IDS = ["meta", "google"] as const satisfies readonly ProviderId[];

export const isProviderId = (v: unknown): v is ProviderId => typeof v === "string" && (PROVIDER_IDS as readonly string[]).includes(v);

export type ProviderPermission = { scope: string; label: string; detail: string };

export type ProviderInfo = {
  id: ProviderId;
  /** Plataforma de anúncios que a conexão alimenta (mesmo id). */
  platformId: PlatformId & ProviderId;
  name: string;
  /** Onde o usuário entra. */
  loginName: string;
  /** Como as contas se agrupam no provedor. */
  groupLabel: string;
  /** Escopos pedidos, em português (a tela simulada e a página de contas mostram). */
  permissions: ProviderPermission[];
};

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  meta: {
    id: "meta",
    platformId: "meta",
    name: "Meta Ads",
    loginName: "login do Facebook (Meta Business)",
    groupLabel: "Business Manager",
    permissions: [
      { scope: "ads_read", label: "Ler os relatórios de anúncios", detail: "Campanhas, conjuntos, anúncios e métricas das contas que você escolher." },
      { scope: "business_management", label: "Ver os seus Business Managers", detail: "Para listar as contas de anúncio de cada BM." },
    ],
  },
  google: {
    id: "google",
    platformId: "google",
    name: "Google Ads",
    loginName: "Conta do Google",
    groupLabel: "Conta de administrador (MCC)",
    permissions: [
      { scope: "https://www.googleapis.com/auth/adwords", label: "Acessar as suas contas do Google Ads", detail: "O VYZ lê campanhas, termos de pesquisa, produtos e métricas, e só altera campanhas quando você clica em Aplicar ou liga o automático." },
      { scope: "openid email profile", label: "Ver seu nome e e-mail", detail: "Para mostrar qual login está conectado." },
    ],
  },
  ga4: {
    id: "ga4",
    platformId: "ga4",
    name: "GA4",
    loginName: "Conta do Google",
    groupLabel: "Conta do Analytics",
    permissions: [
      { scope: "https://www.googleapis.com/auth/analytics.readonly", label: "Ver os relatórios do Google Analytics", detail: "O VYZ lista as propriedades do GA4 e lê sessões, conversões e receita. Só leitura." },
      { scope: "openid email profile", label: "Ver seu nome e e-mail", detail: "Para mostrar qual login está conectado." },
    ],
  },
  tiktok: {
    id: "tiktok",
    platformId: "tiktok",
    name: "TikTok Ads",
    loginName: "TikTok for Business",
    groupLabel: "Business Center",
    permissions: [{ scope: "ads_read", label: "Ler as contas e os relatórios de anúncios", detail: "Campanhas, grupos, anúncios e métricas das contas autorizadas." }],
  },
  linkedin: {
    id: "linkedin",
    platformId: "linkedin",
    name: "LinkedIn Ads",
    loginName: "LinkedIn",
    groupLabel: "Contas de anúncios",
    permissions: [
      { scope: "r_ads r_ads_reporting", label: "Ler as contas e os relatórios de anúncios", detail: "Campanhas e métricas das contas de anúncios em que você tem acesso. Só leitura." },
      { scope: "openid profile email", label: "Ver seu nome e e-mail", detail: "Para mostrar qual login está conectado." },
    ],
  },
  mercado: {
    id: "mercado",
    platformId: "mercado",
    name: "Mercado Ads",
    loginName: "Mercado Livre",
    groupLabel: "Anunciantes",
    permissions: [{ scope: "read offline_access", label: "Ler os relatórios do Product Ads", detail: "Campanhas, anúncios e métricas do Mercado Ads. Só leitura." }],
  },
  rdstation: {
    id: "rdstation",
    platformId: "rdstation",
    name: "RD Station CRM",
    loginName: "RD Station",
    groupLabel: "Conta do CRM",
    permissions: [{ scope: "crm", label: "Ler contatos e negociações do CRM", detail: "Leads, negociações e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
  hubspot: {
    id: "hubspot",
    platformId: "hubspot",
    name: "HubSpot",
    loginName: "HubSpot",
    groupLabel: "Portal",
    permissions: [{ scope: "crm.objects.contacts.read crm.objects.deals.read crm.schemas.deals.read", label: "Ler contatos e negócios do CRM", detail: "Leads, negócios e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
  pipedrive: {
    id: "pipedrive",
    platformId: "pipedrive",
    name: "Pipedrive",
    loginName: "Pipedrive",
    groupLabel: "Empresa",
    permissions: [{ scope: "deals:read contacts:read", label: "Ler negócios e contatos", detail: "Leads, negócios e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
  kommo: {
    id: "kommo",
    platformId: "kommo",
    name: "Kommo",
    loginName: "Kommo",
    groupLabel: "Conta",
    permissions: [{ scope: "crm", label: "Ler leads e contatos", detail: "Leads, etapas do funil e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
};

/** Escopos pedidos ao provedor (separados, como o provedor devolve). */
export const providerScopes = (id: ProviderId): string[] => PROVIDERS[id].permissions.flatMap((p) => p.scope.split(" "));

/** Provedor de login de uma plataforma conectável (Meta Ads → meta, Google Ads → google). */
export function providerForPlatform(platformId: string): ProviderId | null {
  return isProviderId(platformId) ? platformId : null;
}

/** Caminho que começa a conexão (rota GET; o servidor confere papel e plano). */
export function connectHref(provider: ProviderId, next = "/painel/contas"): string {
  return `/api/integrations/${provider}/start?next=${encodeURIComponent(next)}`;
}
