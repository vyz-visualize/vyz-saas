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

/** Grupos da tela de contas, na ordem em que aparecem. */
export const PROVIDER_CATEGORIES = [
  { id: "midia", label: "Mídia paga", text: "Campanhas, investimento e resultados das plataformas de anúncio." },
  { id: "analytics", label: "Analytics", text: "Sessões, conversões e receita do site." },
  { id: "crm", label: "CRM", text: "Leads, negócios e vendas para cruzar com a mídia." },
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number]["id"];

/** Gênero gramatical, para montar "pelo/pela", "do/da", "nenhum/nenhuma". */
type Gender = "m" | "f";

export type ProviderInfo = {
  id: ProviderId;
  /** Plataforma de anúncios que a conexão alimenta (mesmo id). */
  platformId: PlatformId & ProviderId;
  name: string;
  /** Grupo na tela de contas. */
  category: ProviderCategory;
  /** Onde o usuário entra, em minúsculas e sem artigo ("conta do Google"). */
  loginName: string;
  loginGender: Gender;
  /** O que cada item conectado é ("conta de anúncio", "portal"), no singular. */
  accountNoun: string;
  accountGender: Gender;
  /** Como o item ocupa o plano (frase completa). */
  planRule: string;
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
    category: "midia",
    loginName: "login do Facebook (Meta Business)",
    loginGender: "m",
    accountNoun: "conta de anúncio",
    accountGender: "f",
    planRule: "Cada Business Manager conta como 1 conta do plano; cada Instagram e cada Página, também 1.",
    groupLabel: "Business Manager",
    permissions: [
      { scope: "ads_read", label: "Ler os relatórios de anúncios", detail: "Campanhas, conjuntos, anúncios e métricas das contas que você escolher." },
      { scope: "business_management", label: "Ver os seus Business Managers", detail: "Para listar as contas de anúncio de cada BM." },
      { scope: "ads_management", label: "Aplicar otimizações", detail: "Pausar campanhas e mudar o orçamento diário, só quando você clica em Aplicar ou liga o automático." },
      { scope: "pages_show_list", label: "Ver as suas Páginas", detail: "Para listar as Páginas do Facebook e os Instagrams ligados a elas." },
      { scope: "read_insights", label: "Ler os números das Páginas", detail: "Seguidores, visualizações e interações das Páginas que você escolher." },
      { scope: "pages_read_engagement", label: "Ler os posts das Páginas", detail: "Posts e as interações deles, para o ranking de conteúdo." },
      { scope: "instagram_basic", label: "Ver o perfil do Instagram", detail: "Nome, seguidores e posts do perfil." },
      { scope: "instagram_manage_insights", label: "Ler os números do Instagram", detail: "Alcance, visualizações e interações do perfil, dos posts, reels e stories." },
    ],
  },
  google: {
    id: "google",
    platformId: "google",
    name: "Google Ads",
    category: "midia",
    loginName: "conta do Google",
    loginGender: "f",
    accountNoun: "conta de anúncio",
    accountGender: "f",
    planRule: "Cada conta de anúncio conta como 1 conta do plano.",
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
    category: "analytics",
    loginName: "conta do Google",
    loginGender: "f",
    accountNoun: "propriedade do GA4",
    accountGender: "f",
    planRule: "Cada propriedade do GA4 conta como 1 conta do plano.",
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
    category: "midia",
    loginName: "TikTok for Business",
    loginGender: "m",
    accountNoun: "conta de anúncio",
    accountGender: "f",
    planRule: "Cada conta de anúncio conta como 1 conta do plano.",
    groupLabel: "Business Center",
    permissions: [{ scope: "ads_read", label: "Ler as contas e os relatórios de anúncios", detail: "Campanhas, grupos, anúncios e métricas das contas autorizadas." }],
  },
  linkedin: {
    id: "linkedin",
    platformId: "linkedin",
    name: "LinkedIn Ads",
    category: "midia",
    loginName: "login do LinkedIn",
    loginGender: "m",
    accountNoun: "conta de anúncio",
    accountGender: "f",
    planRule: "Cada conta de anúncio conta como 1 conta do plano.",
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
    category: "midia",
    loginName: "login do Mercado Livre",
    loginGender: "m",
    accountNoun: "conta de anunciante",
    accountGender: "f",
    planRule: "Cada conta de anunciante conta como 1 conta do plano.",
    groupLabel: "Anunciantes",
    permissions: [{ scope: "read offline_access", label: "Ler os relatórios do Product Ads", detail: "Campanhas, anúncios e métricas do Mercado Ads. Só leitura." }],
  },
  rdstation: {
    id: "rdstation",
    platformId: "rdstation",
    name: "RD Station CRM",
    category: "crm",
    loginName: "login do RD Station",
    loginGender: "m",
    accountNoun: "conta do CRM",
    accountGender: "f",
    planRule: "Cada conta do CRM conta como 1 conta do plano.",
    groupLabel: "Conta do CRM",
    permissions: [{ scope: "crm", label: "Ler contatos e negociações do CRM", detail: "Leads, negociações e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
  hubspot: {
    id: "hubspot",
    platformId: "hubspot",
    name: "HubSpot",
    category: "crm",
    loginName: "login do HubSpot",
    loginGender: "m",
    accountNoun: "portal do HubSpot",
    accountGender: "m",
    planRule: "Cada portal do HubSpot conta como 1 conta do plano.",
    groupLabel: "Portal",
    permissions: [{ scope: "crm.objects.contacts.read crm.objects.deals.read crm.schemas.deals.read", label: "Ler contatos e negócios do CRM", detail: "Leads, negócios e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
  pipedrive: {
    id: "pipedrive",
    platformId: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    loginName: "login do Pipedrive",
    loginGender: "m",
    accountNoun: "empresa do Pipedrive",
    accountGender: "f",
    planRule: "Cada empresa do Pipedrive conta como 1 conta do plano.",
    groupLabel: "Empresa",
    permissions: [{ scope: "deals:read contacts:read", label: "Ler negócios e contatos", detail: "Leads, negócios e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
  kommo: {
    id: "kommo",
    platformId: "kommo",
    name: "Kommo",
    category: "crm",
    loginName: "login do Kommo",
    loginGender: "m",
    accountNoun: "conta do Kommo",
    accountGender: "f",
    planRule: "Cada conta do Kommo conta como 1 conta do plano.",
    groupLabel: "Conta",
    permissions: [{ scope: "crm", label: "Ler leads e contatos", detail: "Leads, etapas do funil e valores ganhos para cruzar com a mídia. Só leitura." }],
  },
};

const pelo = (g: Gender) => (g === "m" ? "pelo" : "pela");
const art = (g: Gender) => (g === "m" ? "o" : "a");
const de = (g: Gender) => (g === "m" ? "do" : "da");

/** "pelo login do Facebook (Meta Business)", "pela conta do Google". */
export const loginVia = (id: ProviderId) => `${pelo(PROVIDERS[id].loginGender)} ${PROVIDERS[id].loginName}`;
/** "o login do HubSpot", "a conta do Google". */
export const loginThe = (id: ProviderId) => `${art(PROVIDERS[id].loginGender)} ${PROVIDERS[id].loginName}`;
/** "do login do HubSpot", "da conta do Google". */
export const loginOf = (id: ProviderId) => `${de(PROVIDERS[id].loginGender)} ${PROVIDERS[id].loginName}`;
/** "nenhuma conta de anúncio", "nenhum portal do HubSpot". */
export const noAccount = (id: ProviderId) => `${PROVIDERS[id].accountGender === "m" ? "nenhum" : "nenhuma"} ${PROVIDERS[id].accountNoun}`;
/** Primeira letra maiúscula (para início de frase). */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
