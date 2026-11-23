import "server-only";

// Autenticação das chamadas à Graph API do Meta, num lugar só.
//
// Token do login do VYZ: a chamada leva o appsecret_proof (HMAC do token com o segredo
// do app do VYZ), exigido quando "Exigir segredo do app" está ligado no app.
// Token colado pelo cliente (conexão por token, gerado no app do próprio cliente): a
// prova feita com o segredo do VYZ não bate e o Meta recusa a chamada. Esses tokens
// vão sem a prova. Quem sabe que o token é do cliente marca com markOwnAppToken:
// getValidAccessToken (conexões com a marca de token) e a conexão por token.

import { createHmac } from "node:crypto";
import { serverEnv } from "@/server/env";

const ownAppTokens = new Set<string>();

/** Token gerado no app do próprio cliente: as chamadas com ele vão sem o appsecret_proof do VYZ. */
export function markOwnAppToken(token: string): void {
  ownAppTokens.add(token);
}

/** access_token e, para os tokens do app do VYZ (com o segredo configurado), o appsecret_proof. */
export function metaAuthParams(token: string): Record<string, string> {
  const params: Record<string, string> = { access_token: token };
  const secret = serverEnv().META_APP_SECRET;
  if (secret && !ownAppTokens.has(token)) params.appsecret_proof = createHmac("sha256", secret).update(token).digest("hex");
  return params;
}
