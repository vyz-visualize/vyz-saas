import "server-only";

// O login com Google depende do provedor ligado no Supabase (Authentication →
// Providers → Google). Desligado, o /authorize do Supabase devolve um JSON de
// erro; por isso a tela consulta antes as configurações públicas do Auth e
// mostra um aviso. Cache curto: ligou no painel, o botão aparece em cerca de
// um minuto.

import { cacheLife } from "next/cache";
import { providerStatusFrom, type GoogleStatus, type OAuthProvider } from "@/features/auth/google";
import { serverEnv } from "@/server/env";

export async function googleSignInStatus(): Promise<GoogleStatus> {
  return (await oauthStatus()).google;
}

export async function appleSignInStatus(): Promise<GoogleStatus> {
  return (await oauthStatus()).apple;
}

/** Google e Apple numa consulta só. */
export async function oauthStatus(): Promise<Record<OAuthProvider, GoogleStatus>> {
  "use cache";
  cacheLife("minutes");
  const env = serverEnv();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = await res.json();
    return { google: providerStatusFrom(settings, "google"), apple: providerStatusFrom(settings, "apple") };
  } catch (err) {
    console.error("[vyz] configurações do Supabase Auth indisponíveis", err);
    return { google: "unknown", apple: "unknown" };
  }
}
