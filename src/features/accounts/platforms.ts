import type { Tier } from "@/features/pricing/entitlements";

export type PlatformId =
  | "meta"
  | "google"
  | "ga4"
  | "tiktok"
  | "linkedin"
  | "rdstation"
  | "hubspot"
  | "crm"
  | "youtube"
  | "mercado"
  | "shopee"
  | "x"
  | "spotify"
  | "globo"
  | "chatgpt";

export type FieldKind =
  | "metaAccount"
  | "metaBusiness"
  | "googleCustomer"
  | "ga4Property"
  | "ga4Measurement"
  | "digits"
  | "text";

export type AccountField = {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder: string;
  optional?: boolean;
  hint?: string;
};

export type Platform = {
  id: PlatformId;
  name: string;
  /** Sigla curta (selos e miniaturas). */
  short: string;
  kind: "ads" | "analytics" | "crm";
  /** Plano mínimo. Básico: Meta, Google Ads e GA4. Padrão: + TikTok, LinkedIn e CRMs. Avançado: todas. */
  tier: Tier;
  /** Campo principal (o ID que identifica a conta). */
  fields: AccountField[];
};

export const PLATFORMS: Record<PlatformId, Platform> = {
  meta: {
    id: "meta",
    name: "Meta Ads",
    short: "Meta",
    kind: "ads",
    tier: "base",
    fields: [
      { key: "account", label: "Conta de anúncio", kind: "metaAccount", placeholder: "act_1234567890", hint: "Aceita só os dígitos; o act_ entra sozinho." },
      { key: "business", label: "ID do Business Manager", kind: "metaBusiness", placeholder: "123456789012345", optional: true },
    ],
  },
  google: {
    id: "google",
    name: "Google Ads",
    short: "Google",
    kind: "ads",
    tier: "base",
    fields: [
      { key: "account", label: "Customer ID", kind: "googleCustomer", placeholder: "123-456-7890" },
      { key: "mcc", label: "MCC (conta de administrador)", kind: "googleCustomer", placeholder: "123-456-7890", optional: true },
    ],
  },
  ga4: {
    id: "ga4",
    name: "GA4",
    short: "GA4",
    kind: "analytics",
    tier: "base",
    fields: [
      { key: "account", label: "ID da propriedade", kind: "ga4Property", placeholder: "312345678" },
      { key: "measurement", label: "ID de medição", kind: "ga4Measurement", placeholder: "G-ABC1234567", optional: true },
    ],
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok Ads",
    short: "TikTok",
    kind: "ads",
    tier: "pro",
    fields: [{ key: "account", label: "Advertiser ID", kind: "digits", placeholder: "7012345678901234567" }],
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn Ads",
    short: "LinkedIn",
    kind: "ads",
    tier: "pro",
    fields: [{ key: "account", label: "ID da conta de anúncios", kind: "digits", placeholder: "512345678" }],
  },
  youtube: {
    id: "youtube",
    name: "YouTube (Google Ads)",
    short: "YouTube",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "Customer ID do Google Ads", kind: "googleCustomer", placeholder: "123-456-7890" }],
  },
  mercado: {
    id: "mercado",
    name: "Mercado Ads",
    short: "Mercado",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "ID do vendedor", kind: "digits", placeholder: "123456789" }],
  },
  shopee: {
    id: "shopee",
    name: "Shopee Ads",
    short: "Shopee",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "ID da loja", kind: "digits", placeholder: "123456789" }],
  },
  crm: {
    id: "crm",
    name: "CRM",
    short: "CRM",
    kind: "crm",
    tier: "pro",
    fields: [
      { key: "provider", label: "Qual CRM", kind: "text", placeholder: "RD Station, HubSpot, Pipedrive…" },
      { key: "account", label: "ID da conta ou do portal", kind: "text", placeholder: "Ex.: 4512345" },
    ],
  },
  rdstation: {
    id: "rdstation",
    name: "RD Station CRM",
    short: "RD",
    kind: "crm",
    tier: "pro",
    fields: [{ key: "account", label: "Token da API", kind: "text", placeholder: "Token do RD Station CRM", hint: "Em Perfil > Token da instância, no RD Station CRM." }],
  },
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    short: "HubSpot",
    kind: "crm",
    tier: "pro",
    fields: [{ key: "account", label: "ID do portal (Hub ID)", kind: "digits", placeholder: "4512345" }],
  },
  x: {
    id: "x",
    name: "X Ads",
    short: "X",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "ID da conta de anúncios", kind: "text", placeholder: "18ce54d4x5t" }],
  },
  spotify: {
    id: "spotify",
    name: "Spotify Ads",
    short: "Spotify",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "ID da conta de anúncios", kind: "text", placeholder: "Ex.: a1b2c3d4" }],
  },
  globo: {
    id: "globo",
    name: "Globo Ads",
    short: "Globo",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "ID do anunciante", kind: "text", placeholder: "Ex.: 123456" }],
  },
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT Ads",
    short: "ChatGPT",
    kind: "ads",
    tier: "avancado",
    fields: [{ key: "account", label: "ID da conta de anúncios", kind: "text", placeholder: "Ex.: acct_123456" }],
  },
};

export const PLATFORM_ORDER: PlatformId[] = [
  "meta",
  "google",
  "ga4",
  "tiktok",
  "linkedin",
  "rdstation",
  "hubspot",
  "crm",
  "youtube",
  "mercado",
  "shopee",
  "x",
  "spotify",
  "globo",
  "chatgpt",
];

const TIER_RANK: Record<Tier, number> = { base: 0, pro: 1, avancado: 2, personalizado: 3 };

/** Plataformas que o plano libera, na ordem de exibição. */
export const platformsForTier = (tier: Tier) => PLATFORM_ORDER.map((id) => PLATFORMS[id]).filter((p) => TIER_RANK[p.tier] <= TIER_RANK[tier]);

export const isAdPlatform = (id: PlatformId) => PLATFORMS[id].kind === "ads";
