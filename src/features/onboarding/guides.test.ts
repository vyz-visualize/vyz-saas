import { describe, expect, it } from "vitest";
import { findTourTarget, isMissingTable, NO_GUIDES, nudgeFor, nudgeGuide, snoozeUntil, SNOOZE_DAYS, TOUR_GUIDE, TOUR_STEPS, tourPending, type GuidesState, type NudgeInput } from "./guides";

const NOW = new Date("2026-11-12T12:00:00Z");
const on = (rows: GuidesState["rows"] = []): GuidesState => ({ available: true, rows });
const base: NudgeInput = { guides: on(), connected: ["meta"], onboardingDone: true, tourActive: false, shownThisSession: false, now: NOW };

describe("tabela ainda não aplicada no banco", () => {
  it("reconhece o erro do PostgREST e do Postgres", () => {
    expect(isMissingTable({ code: "PGRST205", message: "Could not find the table 'public.user_guides' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: "42P01", message: 'relation "public.user_guides" does not exist' })).toBe(true);
    expect(isMissingTable({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });

  it("sem a tabela: nem tour nem lembrete (não aparecem toda hora sem conseguir gravar)", () => {
    expect(tourPending(NO_GUIDES)).toBe(false);
    expect(nudgeFor({ ...base, guides: NO_GUIDES })).toBeNull();
  });
});

describe("tour do primeiro dashboard", () => {
  it("aparece uma vez: até concluir ou pular", () => {
    expect(tourPending(on())).toBe(true);
    expect(tourPending(on([{ guide: TOUR_GUIDE, status: "done", snoozedUntil: null }]))).toBe(false);
    expect(tourPending(on([{ guide: TOUR_GUIDE, status: "skipped", snoozedUntil: null }]))).toBe(false);
    // outro guia não conta
    expect(tourPending(on([{ guide: nudgeGuide("google"), status: "done", snoozedUntil: null }]))).toBe(true);
  });

  it("tem os 4 pontos pedidos, na ordem", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(["periodo", "metricas", "abas", "filtrar", "editar", "compartilhar", "pergunte"]);
  });

  it("acha só o alvo visível, e pelo texto quando pedido", () => {
    const el = (text: string, w: number) => ({ textContent: text, getBoundingClientRect: () => ({ width: w, height: w ? 20 : 0 }) });
    const tabs = [el("Visão geral", 80), el("Criativos", 0), el("Criativos", 70)];
    const root = { querySelectorAll: () => tabs } as unknown as ParentNode;
    expect(findTourTarget(root, { selector: "x", label: "Criativos" })).toBe(tabs[2]);
    expect(findTourTarget({ querySelectorAll: () => [el("", 0)] } as unknown as ParentNode, { selector: "x" })).toBeNull();
  });
});

describe("lembretes de conexão", () => {
  it("falta o Google com a Meta conectada: lembra o Google", () => {
    expect(nudgeFor(base)).toBe("google");
    expect(nudgeFor({ ...base, connected: ["google"] })).toBe("meta");
  });

  it("no máximo um por sessão, nunca durante o tour e só depois do primeiro acesso", () => {
    expect(nudgeFor({ ...base, shownThisSession: true })).toBeNull();
    expect(nudgeFor({ ...base, tourActive: true })).toBeNull();
    expect(nudgeFor({ ...base, onboardingDone: false })).toBeNull();
  });

  it("sem nenhuma conectada, quem pede é o checklist da Início; com tudo conectado, nada", () => {
    expect(nudgeFor({ ...base, connected: [] })).toBeNull();
    expect(nudgeFor({ ...base, connected: ["meta", "google"] })).toBeNull();
  });

  it('"Agora não" adia 3 dias', () => {
    const until = snoozeUntil(NOW);
    expect(SNOOZE_DAYS).toBe(3);
    expect(until).toBe("2026-11-15T12:00:00.000Z");
    const snoozed = on([{ guide: nudgeGuide("google"), status: "snoozed", snoozedUntil: until }]);
    expect(nudgeFor({ ...base, guides: snoozed, now: new Date("2026-11-15T11:59:00Z") })).toBeNull();
    expect(nudgeFor({ ...base, guides: snoozed, now: new Date("2026-11-15T12:01:00Z") })).toBe("google");
  });
});
