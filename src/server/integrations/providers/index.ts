import "server-only";

// Escolhe o provedor: simulado com INTEGRATIONS_MODE=mock, real com live. Uma
// conexão gravada no modo simulado continua simulada (is_mock), mesmo depois
// de ligar o live: os tokens dela não valem no provedor.

import type { ProviderId } from "@/features/integrations/providers";
import { isMockIntegrations, serverEnv, type ServerEnv } from "@/server/env";
import { ga4Provider } from "./ga4";
import { googleProvider } from "./google";
import { hubspotProvider } from "./hubspot";
import { kommoProvider } from "./kommo";
import { linkedinProvider } from "./linkedin";
import { metaProvider } from "./meta";
import { mockProvider } from "./mock";
import { pipedriveProvider } from "./pipedrive";
import { rdstationProvider } from "./rdstation";
import { tiktokProvider } from "./tiktok";
import type { OAuthProvider } from "./types";

const REAL: Record<ProviderId, () => OAuthProvider> = {
  meta: metaProvider,
  google: googleProvider,
  ga4: ga4Provider,
  tiktok: tiktokProvider,
  linkedin: linkedinProvider,
  rdstation: rdstationProvider,
  hubspot: hubspotProvider,
  pipedrive: pipedriveProvider,
  kommo: kommoProvider,
};

/** Variáveis que ligam cada login real (as duas precisam estar preenchidas). */
const CREDENTIALS: Record<ProviderId, [keyof ServerEnv, keyof ServerEnv]> = {
  meta: ["META_APP_ID", "META_APP_SECRET"],
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  ga4: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  tiktok: ["TIKTOK_APP_ID", "TIKTOK_APP_SECRET"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  rdstation: ["RDSTATION_CLIENT_ID", "RDSTATION_CLIENT_SECRET"],
  hubspot: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
  pipedrive: ["PIPEDRIVE_CLIENT_ID", "PIPEDRIVE_CLIENT_SECRET"],
  kommo: ["KOMMO_CLIENT_ID", "KOMMO_CLIENT_SECRET"],
};

/** O login real deste provedor tem credenciais no servidor (no modo simulado, todos aparecem). */
export function isProviderConfigured(id: ProviderId): boolean {
  if (isMockIntegrations()) return true;
  const env = serverEnv();
  return CREDENTIALS[id].every((k) => !!env[k]);
}

export function getProvider(id: ProviderId): OAuthProvider {
  if (isMockIntegrations()) return mockProvider(id);
  return REAL[id]();
}

/** Provedor de uma conexão já gravada. */
export function providerForConnection(conn: { provider: ProviderId; is_mock: boolean }): OAuthProvider {
  if (conn.is_mock) return mockProvider(conn.provider);
  return REAL[conn.provider]();
}

export { ProviderError } from "./types";
export type { DiscoveredAccount, OAuthProvider, OAuthTokens, ProviderProfile } from "./types";
