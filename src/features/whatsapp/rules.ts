// Regras puras do WhatsApp: comandos de resposta (PARAR/VOLTAR), limite de
// alertas e quem pode receber (plano). Testáveis sem banco.

import { ENTITLEMENTS, TIERS, type Tier } from "@/features/pricing/entitlements";
import type { Insight } from "@/features/insights/insights";

export type ReplyCommand = "stop" | "resume" | null;

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z ]/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const STOP = new Set(["PARAR", "PARE", "SAIR", "STOP", "CANCELAR", "DESCADASTRAR"]);
const RESUME = new Set(["VOLTAR", "VOLTA", "ATIVAR", "START"]);

/** "parar", "Sair!", " PARAR " → stop; "voltar" → resume; o resto → null. */
export function parseReplyCommand(text: string | null | undefined): ReplyCommand {
  const t = strip(text ?? "");
  if (!t || t.split(" ").length > 3) return null;
  const first = t.split(" ")[0];
  if (STOP.has(t) || STOP.has(first)) return "stop";
  if (RESUME.has(t) || RESUME.has(first)) return "resume";
  return null;
}

/**
 * O plano do workspace (linha do workspace_access) inclui relatórios no
 * WhatsApp? Mesma leitura da sessão do painel (pages_plan_id). Perdeu o plano
 * ou a assinatura: para de enviar, mas nada é apagado.
 */
export function planAllowsWhatsapp(access: { pages_plan_id: string | null; has_access: boolean | null } | null | undefined): boolean {
  if (!access?.has_access) return false;
  const tier = (TIERS as string[]).includes(access.pages_plan_id ?? "") ? (access.pages_plan_id as Tier) : null;
  return !!tier && ENTITLEMENTS[tier].whatsappReports;
}

export const ALERT_MAX_PER_DAY = 2;
const DAY = 86_400_000;

/** Análise que vira alerta: queda forte, gasto sem retorno, verba desperdiçada. */
export const isAlertWorthy = (i: Insight) => i.tone === "bad" && i.weight >= 78;

export const alertKey = (i: Pick<Insight, "dashboardId" | "id">) => `${i.dashboardId}:${i.id}`;

/**
 * Quais alertas mandar agora: no máximo ALERT_MAX_PER_DAY em 24 h (contando os
 * já enviados) e nunca a mesma chave duas vezes em 24 h.
 */
export function pickAlerts(candidates: Insight[], sent: { refKey: string | null; createdAt: string }[], now = Date.now()): Insight[] {
  const recent = sent.filter((s) => now - Date.parse(s.createdAt) < DAY);
  const seen = new Set(recent.map((s) => s.refKey).filter(Boolean));
  let room = ALERT_MAX_PER_DAY - recent.length;
  const out: Insight[] = [];
  for (const i of [...candidates].filter(isAlertWorthy).sort((a, b) => b.weight - a.weight)) {
    if (room <= 0) break;
    const key = alertKey(i);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
    room--;
  }
  return out;
}

/** Variação em texto: "+12%", "-8%", "sem base". */
export function deltaText(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0) return "sem base de comparação";
  const d = (current - previous) / previous;
  const pct = Math.round(d * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
