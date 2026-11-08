import "server-only";

// Envio pelo Resend (RESEND_API_KEY). Remetente no domínio verificado.

import { resendKey } from "./credentials";

export const REPORT_FROM = "VYZ Relatórios <relatorios@vyzualize.com.br>";

export async function sendMail(to: string[], msg: { subject: string; html: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  const key = resendKey();
  if (!key) return { ok: false, error: "RESEND_API_KEY ausente" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: REPORT_FROM, to, subject: msg.subject, html: msg.html, text: msg.text }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  const j = (await res.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, error: `Resend HTTP ${res.status}: ${(j?.message ?? "").slice(0, 160)}` };
}
