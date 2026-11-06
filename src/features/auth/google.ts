// Login com Google: estado do provedor no Supabase e o aviso enquanto ele não
// está ligado. Puro: quem busca as configurações é src/server/auth/google.ts.

/** unknown = não deu para consultar; a tela deixa tentar. */
export type GoogleStatus = "enabled" | "disabled" | "unknown";

export const GOOGLE_PENDING = {
  label: "Login com Google precisa ser ativado no Supabase",
  detail: "No painel do Supabase: Authentication → Providers → Google. Até lá, entre com e-mail e senha.",
} as const;

/** Lê a resposta de GET /auth/v1/settings ({ external: { google: boolean, ... } }). */
export function googleStatusFrom(settings: unknown): GoogleStatus {
  const external = typeof settings === "object" && settings !== null ? (settings as { external?: unknown }).external : undefined;
  if (typeof external !== "object" || external === null) return "unknown";
  return (external as { google?: unknown }).google === true ? "enabled" : "disabled";
}

export type OAuthProvider = "google" | "apple";

export const APPLE_PENDING = {
  label: "Login com Apple precisa ser ativado no Supabase",
  detail: "No painel do Supabase: Authentication → Providers → Apple. Até lá, entre com o Google ou com e-mail e senha.",
} as const;

/** Estado de um provedor nas configurações públicas do Auth. */
export function providerStatusFrom(settings: unknown, provider: OAuthProvider): GoogleStatus {
  const external = typeof settings === "object" && settings !== null ? (settings as { external?: unknown }).external : undefined;
  if (typeof external !== "object" || external === null) return "unknown";
  return (external as Record<string, unknown>)[provider] === true ? "enabled" : "disabled";
}
