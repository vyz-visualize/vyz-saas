// Guias do primeiro acesso: o tour do primeiro dashboard e os lembretes de
// conexão. O estado fica no banco (user_guides, por pessoa); o limite de um
// lembrete por sessão fica no navegador. Puro: servidor e tela usam o mesmo.

import { CORE_PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/features/integrations/providers";

export const TOUR_GUIDE = "dashboard_tour";
export const nudgeGuide = (provider: ProviderId) => `nudge:${provider}`;

/** "Agora não" adia o lembrete por 3 dias. */
export const SNOOZE_DAYS = 3;
export const snoozeUntil = (now: Date) => new Date(now.getTime() + SNOOZE_DAYS * 86_400_000).toISOString();

/** Atributo que um tour aberto põe no <html>: lembrete nenhum aparece por cima. */
export const TOUR_ACTIVE_ATTR = "data-tour-active";

/** Chave do sessionStorage: já mostrou um lembrete nesta sessão. */
export const NUDGE_SESSION_KEY = "vyz:nudge-shown";

export type GuideStatus = "done" | "skipped" | "snoozed";
export type GuideRow = { guide: string; status: GuideStatus; snoozedUntil: string | null };

/**
 * O que o servidor sabe dos guias da pessoa. available = false enquanto a
 * tabela não existe no banco (migration ainda não aplicada): nada de tour nem
 * lembrete, para não mostrar de novo a cada visita sem conseguir gravar.
 */
export type GuidesState = { available: boolean; rows: GuideRow[] };
export const NO_GUIDES: GuidesState = { available: false, rows: [] };

/** Erro de tabela que ainda não existe (PostgREST ou Postgres). */
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "PGRST205" || err.code === "42P01") return true;
  const m = err.message ?? "";
  return /does not exist|Could not find the table/i.test(m);
}

/** O tour aparece uma vez: até a pessoa concluir ou pular. */
export function tourPending(g: GuidesState): boolean {
  return g.available && !g.rows.some((r) => r.guide === TOUR_GUIDE && (r.status === "done" || r.status === "skipped"));
}

function snoozed(g: GuidesState, provider: ProviderId, now: Date): boolean {
  const row = g.rows.find((r) => r.guide === nudgeGuide(provider));
  if (!row) return false;
  if (row.status !== "snoozed") return true; // done: não volta
  return !!row.snoozedUntil && new Date(row.snoozedUntil).getTime() > now.getTime();
}

export type NudgeInput = {
  guides: GuidesState;
  /** Plataformas com conta ativa. */
  connected: readonly ProviderId[];
  /** O primeiro acesso terminou (ou foi pulado). */
  onboardingDone: boolean;
  /** Um tour está na tela. */
  tourActive: boolean;
  /** Já mostrou um lembrete nesta sessão. */
  shownThisSession: boolean;
  now: Date;
};

/**
 * Qual lembrete mostrar (ou nenhum). Só depois do primeiro acesso, fora do
 * tour, um por sessão, e só quando já há uma plataforma conectada e falta a
 * outra (sem nenhuma, o checklist da Início já pede a conexão em destaque).
 */
export function nudgeFor(i: NudgeInput): ProviderId | null {
  if (!i.guides.available || !i.onboardingDone || i.tourActive || i.shownThisSession) return null;
  if (i.connected.length === 0) return null;
  return CORE_PROVIDER_IDS.find((p) => !i.connected.includes(p) && !snoozed(i.guides, p, i.now)) ?? null;
}

export const nudgeText = (provider: ProviderId) => `Você ainda não conectou o ${PROVIDERS[provider].name}. Quer fazer isso agora?`;

/**
 * Pontos do tour, na ordem. O alvo é um seletor (e, se houver, o texto exato do
 * elemento: as abas dos visuais não têm atributo próprio); o que não estiver
 * visível na tela fica de fora.
 */
export const TOUR_STEPS: readonly { id: string; selector: string; label?: string; title: string; text: string }[] = [
  { id: "periodo", selector: '[data-tour="periodo"]', title: "Período", text: "Troque o período aqui: o dashboard inteiro acompanha, e os últimos 3 dias aparecem como em maturação." },
  { id: "metricas", selector: "[data-kpi-row]", title: "Métricas principais", text: "Os números que decidem o mês ficam no topo. Clique numa campanha e eles filtram junto." },
  { id: "criativos", selector: '[role="tab"], [data-page-tab]', label: "Criativos", title: "Criativos", text: "Veja quais anúncios vendem mais, lado a lado, com a prévia de cada um." },
  // sem espaço (celular), o botão vai para o menu "Mais ações": o tour aponta para o menu
  { id: "compartilhar", selector: '[data-tour="compartilhar"], [aria-label="Mais ações"]', title: "Compartilhar", text: "Mande ao cliente um link só de leitura ou o PDF. Em telas menores, ele fica no menu ⋯." },
];

/** O primeiro elemento visível de um passo do tour (ou nenhum). */
export function findTourTarget(root: ParentNode, step: { selector: string; label?: string }): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(step.selector)) {
    if (step.label && el.textContent?.trim() !== step.label) continue;
    const r = el.getBoundingClientRect();
    // escondido (ex.: botão que foi para o menu "Mais") não conta, mesmo ocupando espaço
    const hidden = typeof getComputedStyle === "function" && getComputedStyle(el).visibility === "hidden";
    if (r.width > 0 && r.height > 0 && !hidden) return el;
  }
  return null;
}
