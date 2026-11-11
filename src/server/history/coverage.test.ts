import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Rastreabilidade: toda Server Action que muda dado grava no histórico
// (logActivity / logAuthEvent) ou está na lista abaixo, com o motivo. Uma ação
// nova sem registro quebra este teste.

const ROOT = join(process.cwd(), "src/server");

/** Ações que não gravam activity_events, e por quê. */
const EXEMPT: Record<string, string> = {
  // leitura ou conferência, não muda dado
  "landing-pages/actions.ts:checkLandingSlug": "só consulta",
  // medição própria (landing_waitlist_visits)
  "landing-pages/waitlist.ts:recordLandingWaitlistVisit": "grava em landing_waitlist_visits",
  // selo "Novo": não é ação de dado (e o gatilho de auditoria ignora seen_at)
  "todo/actions.ts:markTasksSeen": "só tira o selo Novo",
  // perfil não pertence a um workspace: fica na auditoria do banco (profiles)
  "workspace/actions.ts:updateProfile": "audit_events de profiles",
  // gravam pelo auxiliar do mesmo arquivo (billing.cancel_scheduled / cancel_reverted)
  "billing/actions.ts:cancelSubscription": "registrado pelo auxiliar de cancelamento",
  "billing/actions.ts:resumeSubscription": "registrado pelo auxiliar de cancelamento",
  // runSync grava sync.finished / sync.failed com quem pediu
  "integrations/actions.ts:resyncAccount": "registrado em sync/run",
  "billing/actions.ts:startCheckout": "checkout_sessions auditado; aceite em legal_acceptances",
  "billing/actions.ts:payWithStripe": "redireciona para a Stripe; o webhook registra",
  // salvar rascunho e logo de LP: versões em landing_page_versions e auditoria de landing_pages
  "landing-pages/actions.ts:saveLandingPage": "versões + auditoria; troca de slug é registrada",
  "landing-pages/actions.ts:uploadLandingLogo": "auditoria de landing_pages",
  "landing-pages/actions.ts:removeLandingLogo": "auditoria de landing_pages",
  "landing-pages/actions.ts:submitLandingForm": "visitante sem login: landing_page_submissions",
  "onboarding/actions.ts:chooseLayout": "registra dashboard.created",
  "billing/test-reset.ts:resetTestAccount": "só ambiente de teste",
  // painel Interno: a simulação só lê; a exclusão total apaga o histórico da pessoa junto (e o servidor loga)
  "admin/user-actions.ts:previewDeletionAction": "só consulta",
  "admin/user-actions.ts:applyDeletionAction": "exclusão total: o histórico da pessoa sai junto",
};

function actionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return actionFiles(path);
    if (!/\.ts$/.test(name) || /\.test\.ts$/.test(name)) return [];
    return /^"use server";/m.test(readFileSync(path, "utf8")) ? [path] : [];
  });
}

/** Corpo de cada função exportada do arquivo, pelo nome. */
function exportedFunctions(source: string): Record<string, string> {
  const starts = [...source.matchAll(/^export async function (\w+)/gm)];
  return Object.fromEntries(starts.map((m, i) => [m[1], source.slice(m.index, starts[i + 1]?.index ?? source.length)]));
}

describe("rastreabilidade das Server Actions", () => {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const file of actionFiles(ROOT)) {
    const rel = file.slice(ROOT.length + 1);
    if (rel.startsWith("auth/")) continue; // acessos gravam em auth_events (conferido abaixo)
    for (const [name, body] of Object.entries(exportedFunctions(readFileSync(file, "utf8")))) {
      const key = `${rel}:${name}`;
      seen.add(key);
      if (/logActivity\(|logAuthEvent\(/.test(body) || EXEMPT[key]) continue;
      missing.push(key);
    }
  }

  it("toda ação grava no histórico ou tem exceção justificada", () => {
    expect(missing).toEqual([]);
  });

  it("não há exceção sobrando (ação renomeada ou removida)", () => {
    expect(Object.keys(EXEMPT).filter((k) => !seen.has(k))).toEqual([]);
  });

  it("as ações de acesso gravam em auth_events", () => {
    const auth = readFileSync(join(ROOT, "auth/actions.ts"), "utf8");
    expect(auth).toMatch(/logAuthEvent\(/);
  });
});
