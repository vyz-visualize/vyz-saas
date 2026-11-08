import "server-only";

// Credenciais do painel interno (todas só leitura). Em produção vêm em base64
// nas variáveis da Vercel (_B64); no computador, o caminho do arquivo do
// .env.local. Nunca saem do servidor e nunca vão para log.

import { readFileSync } from "node:fs";

const env = (k: string) => process.env[k]?.trim() || null;

function fileOrB64(b64Key: string, pathKey: string): string | null {
  const b64 = env(b64Key);
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  const path = env(pathKey);
  if (path && process.env.NODE_ENV !== "production") {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  }
  return null;
}

/** E-mails com acesso ao painel interno (minúsculos). */
export function adminEmails(): string[] {
  return (env("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type ServiceAccount = { client_email: string; private_key: string };

export function googleServiceAccount(): ServiceAccount | null {
  const raw = fileOrB64("GOOGLE_SERVICE_ACCOUNT_JSON_B64", "GOOGLE_SERVICE_ACCOUNT_PATH");
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    return j.client_email && j.private_key ? { client_email: j.client_email, private_key: j.private_key } : null;
  } catch {
    return null;
  }
}

export function appStoreKey(): { issuerId: string; keyId: string; vendor: string; p8: string } | null {
  const p8 = fileOrB64("APPSTORE_KEY_P8_B64", "APPSTORE_KEY_P8_PATH");
  const issuerId = env("APPSTORE_ISSUER_ID");
  const keyId = env("APPSTORE_KEY_ID");
  const vendor = env("APPSTORE_VENDOR_NUMBER");
  return p8 && issuerId && keyId && vendor ? { issuerId, keyId, vendor, p8 } : null;
}

export const ga4PropertyId = () => env("GA4_PROPERTY_ID");
export const playConfig = () => {
  const bucket = env("PLAY_REPORTS_BUCKET");
  const pkg = env("PLAY_PACKAGE_NAME");
  return bucket && pkg ? { bucket, pkg } : null;
};
export const revenueCatConfig = () => {
  const project = env("REVENUECAT_PROJECT_ID");
  const key = env("REVENUECAT_API_V2_KEY");
  return project && key ? { project, key } : null;
};
export const resendKey = () => env("RESEND_API_KEY");

/** App da Vyzualize na App Store (os relatórios cobrem o time inteiro). */
export const APP_STORE_APP_ID = "6831678959";
/** Destinatários do resumo de segunda. */
export const REPORT_RECIPIENTS = ["gustavolemos.analytics@gmail.com", "suporte@vyzualize.com.br"];
