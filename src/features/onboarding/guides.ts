// Guias do primeiro acesso: o tour do painel (onde fica cada coisa), o tour do
// primeiro dashboard e os lembretes de conexão. O estado fica no banco (user_guides, por pessoa); o limite de um
// lembrete por sessão fica no navegador. Puro: servidor e tela usam o mesmo.

import { CORE_PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/features/integrations/providers";

export const TOUR_GUIDE = "dashboard_tour";
/** Tour do painel: o menu, os workspaces, a rotina, a conta e o assistente. */
export const PANEL_TOUR_GUIDE = "panel_tour";
export const TOUR_GUIDES = [TOUR_GUIDE, PANEL_TOUR_GUIDE] as const;
export type TourGuide = (typeof TOUR_GUIDES)[number];
export const nudgeGuide = (provider: ProviderId) => `nudge:${provider}`;

/** "Agora não" adia o lembrete por 3 dias. */
export const SNOOZE_DAYS = 3;
export const snoozeUntil = (now: Date) => new Date(now.getTime() + SNOOZE_DAYS * 86_400_000).toISOString();

/** Atributo que um tour aberto põe no <html>: lembrete nenhum aparece por cima. */
export const TOUR_ACTIVE_ATTR = "data-tour-active";

/** Chave do sessionStorage: já mostrou um lembrete nesta sessão. */
export const NUDGE_SESSION_KEY = "vyz:nudge-shown";
/** Chave do sessionStorage: o último passo visto (para contar o passo concluído). */
export const LAST_STEP_KEY = "vyz:onboarding-step";

/** "Refazer primeiro acesso": esquece o que esta aba guardou do primeiro acesso anterior (lembrete e último passo). */
export function forgetFirstAccessSession() {
  try {
    sessionStorage.removeItem(NUDGE_SESSION_KEY);
    sessionStorage.removeItem(LAST_STEP_KEY);
  } catch {}
}

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

/** Cada tour aparece uma vez: até a pessoa concluir ou pular. */
export function tourPending(g: GuidesState, guide: TourGuide = TOUR_GUIDE): boolean {
  return g.available && !g.rows.some((r) => r.guide === guide && (r.status === "done" || r.status === "skipped"));
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
 * Um ponto de um tour. O alvo é um seletor (e, se houver, o texto exato do
 * elemento: as abas dos visuais não têm atributo próprio); o que não estiver
 * visível na tela fica de fora.
 */
export type TourStep = {
  id: string;
  selector: string;
  label?: string;
  title: string;
  text: string;
  /** Balão ao lado do alvo (no menu lateral), quando cabe; senão, embaixo ou em cima. */
  side?: "right";
};

/** Pontos do tour do primeiro dashboard, na ordem. */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: "periodo", selector: '[data-tour="periodo"]', title: "Período e comparação", text: "Troque o período aqui e ligue o Comparar: cada número mostra quanto mudou contra o período anterior." },
  { id: "metricas", selector: '[data-tour="personalizar"], [data-kpi-row]', title: "Indicadores principais", text: "Os números que decidem o mês ficam no topo. Em Personalizar métricas você escolhe quais aparecem e em que ordem." },
  { id: "abas", selector: '[data-tour="abas"]', title: "Abas do dashboard", text: "Meta Ads, Criativos, Funil e as outras abas aprofundam cada parte. O cliente vê as mesmas no link." },
  { id: "filtrar", selector: "[data-filter-item]", title: "Clique para filtrar", text: "Clique numa campanha, num anúncio ou numa plataforma e o dashboard inteiro filtra por ela. Clique de novo para limpar." },
  { id: "editar", selector: '[data-tour="editar"], [aria-label="Mais ações"]', title: "Editar", text: "Troque contas, páginas, metas e a marca do dashboard. Em telas menores, fica no menu ⋯." },
  // sem espaço (celular), o botão vai para o menu "Mais ações": o tour aponta para o menu
  { id: "compartilhar", selector: '[data-tour="compartilhar"], [aria-label="Mais ações"]', title: "Compartilhar e exportar", text: "Mande ao cliente um link só de leitura ou exporte o PDF. Em telas menores, ficam no menu ⋯." },
  { id: "pergunte", selector: '[data-tour="pergunte"]', title: "Pergunte ao VYZ", text: "Tire dúvidas sobre os números a qualquer hora: clique aqui ou use ⌘K (Ctrl K no Windows)." },
];

/**
 * Pontos do tour do painel, na ordem. No computador, o menu lateral (workspaces, o
 * workspace aberto, a rotina, o plano e a conta); no celular, o topo, a barra de
 * atalhos e o "Mais". O assistente fecha os dois.
 */
export const PANEL_TOUR_STEPS: readonly TourStep[] = [
  { id: "workspaces", selector: '[data-tour="workspaces"]', side: "right", title: "Seus workspaces", text: "Cada cliente ou marca é um workspace, com contas, dashboards e equipe próprios. Troque de workspace aqui; a organização (plano, Conexões e configurações) também fica neste menu." },
  { id: "workspace", selector: '[data-tour="workspace-menu"]', side: "right", title: "O workspace aberto", text: "Visão geral, Dashboards, Contas, Pessoas e Ajustes deste cliente. Tudo o que você cria aqui fica nele." },
  { id: "barra", selector: '[data-tour="barra"]', title: "Atalhos", text: "Início, os dashboards e as contas do workspace aberto e o A Fazer, sempre à mão." },
  { id: "rotina", selector: '[data-tour="rotina"]', side: "right", title: "Sua rotina", text: "A Fazer junta as tarefas de todos os workspaces, e em Compartilhar ficam os links que os clientes acompanham." },
  { id: "conta", selector: '[data-tour="conta"]', side: "right", title: "Plano e conta", text: "O uso do plano fica aqui. No seu nome: Minha conta, Plano e cobrança e Sair. A tecla [ recolhe o menu." },
  { id: "mais", selector: '[data-tour="mais"]', title: "Mais", text: "Os outros workspaces, Conexões, Plano, Configurações e Sair." },
  { id: "pergunte", selector: '[data-tour="pergunte"]', side: "right", title: "Pergunte ao VYZ", text: "Tire dúvidas sobre os números ou peça para abrir uma tela: clique aqui ou use ⌘K (Ctrl K no Windows)." },
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
