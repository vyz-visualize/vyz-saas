// Assinatura do webhook do WhatsApp: o Meta manda X-Hub-Signature-256 =
// "sha256=" + HMAC-SHA256(corpo cru, chave secreta do app). Compara em tempo
// constante. Sem chave configurada, recusa (não aceita webhook sem conferir).

import { createHmac, timingSafeEqual } from "node:crypto";

export function signBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

export function isValidSignature(rawBody: string, header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(signBody(rawBody, secret));
  const got = Buffer.from(header.trim());
  return got.length === expected.length && timingSafeEqual(got, expected);
}
