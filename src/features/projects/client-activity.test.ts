import { describe, expect, it } from "vitest";
import { clientStatus, deviceFromUserAgent, formatDuration, isBotUserAgent, linkName, projectPulses, summarizeClientActivity, type ClientLink, type ClientVisit } from "./client-activity";

const NOW = new Date("2026-11-20T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const link = (id: string, over: Partial<ClientLink> = {}): ClientLink => ({
  id,
  dashboardId: "d1",
  dashboardName: "Resultados",
  recipientName: null,
  tokenHint: "abc123",
  createdAt: daysAgo(90),
  expiresAt: null,
  revokedAt: null,
  ...over,
});

let n = 0;
const visit = (linkId: string, days: number, over: Partial<ClientVisit> = {}): ClientVisit => ({
  id: `v${++n}`,
  linkId,
  dashboardId: "d1",
  startedAt: daysAgo(days),
  lastSeenAt: daysAgo(days),
  seconds: 120,
  pages: ["Visão geral"],
  device: "desktop",
  ...over,
});

describe("situação do cliente", () => {
  it("sai da última visita: usando até 7 dias, esfriando até 21, depois parado", () => {
    expect(clientStatus(daysAgo(0.5), true, NOW)).toBe("usando");
    expect(clientStatus(daysAgo(7), true, NOW)).toBe("usando");
    expect(clientStatus(daysAgo(8), true, NOW)).toBe("esfriando");
    expect(clientStatus(daysAgo(21), true, NOW)).toBe("esfriando");
    expect(clientStatus(daysAgo(22), true, NOW)).toBe("parado");
  });

  it("sem visita: nunca abriu (com link) ou sem link", () => {
    expect(clientStatus(null, true, NOW)).toBe("nunca_abriu");
    expect(clientStatus(null, false, NOW)).toBe("sem_link");
  });
});

describe("resumo dos acessos", () => {
  const maria = link("l1", { recipientName: "Maria, diretora" });
  const joao = link("l2", { recipientName: "João", dashboardId: "d2", dashboardName: "Vendas" });
  const semNome = link("l3", { tokenHint: "zz9988", createdAt: daysAgo(1) });

  it("conta visitas, tempo e pessoas por janela", () => {
    const visits = [visit("l1", 1, { seconds: 300 }), visit("l1", 3), visit("l2", 10, { dashboardId: "d2" }), visit("l1", 40), visit("l2", 70, { dashboardId: "d2" })];
    const s = summarizeClientActivity([maria, joao, semNome], visits, NOW);
    expect(s.status).toBe("usando");
    expect(s.visits7).toBe(2);
    expect(s.visits30).toBe(3);
    expect(s.visitsPrev30).toBe(1);
    expect(s.seconds30).toBe(300 + 120 + 120);
    expect(s.people30).toBe(2);
    expect(s.activeLinks).toBe(3);
    expect(s.lastVisitAt).toBe(daysAgo(1));
  });

  it("lista as pessoas: quem abriu por último em cima, nome do link ou a dica", () => {
    const s = summarizeClientActivity([maria, joao, semNome], [visit("l2", 2, { dashboardId: "d2" }), visit("l1", 5)], NOW);
    expect(s.people.map((p) => p.name)).toEqual(["João", "Maria, diretora", "Link …zz9988"]);
    expect(s.people[2]).toMatchObject({ named: false, status: "nunca_abriu", visits30: 0, lastVisitAt: null });
    expect(s.people[1]).toMatchObject({ status: "usando", visits30: 1, dashboardName: "Resultados" });
  });

  it("dashboards mais vistos primeiro; linha do tempo da visita mais nova", () => {
    const s = summarizeClientActivity([maria, joao], [visit("l2", 2, { dashboardId: "d2" }), visit("l1", 5), visit("l1", 6)], NOW);
    expect(s.dashboards.map((d) => [d.name, d.visits30])).toEqual([
      ["Resultados", 2],
      ["Vendas", 1],
    ]);
    expect(s.timeline.map((t) => t.who)).toEqual(["João", "Maria, diretora", "Maria, diretora"]);
    expect(s.timeline[0]).toMatchObject({ dashboardName: "Vendas", seconds: 120, device: "desktop" });
  });

  it("link desativado sem visita some; com visita fica, marcado", () => {
    const off = link("l4", { recipientName: "Ana", revokedAt: daysAgo(2) });
    const offSeen = link("l5", { recipientName: "Bia", revokedAt: daysAgo(2) });
    const s = summarizeClientActivity([off, offSeen], [visit("l5", 10)], NOW);
    expect(s.people.map((p) => [p.name, p.linkState])).toEqual([["Bia", "revoked"]]);
    expect(s.activeLinks).toBe(0);
    expect(s.status).toBe("esfriando");
  });

  it("ignora visita de link que não é deste workspace", () => {
    const s = summarizeClientActivity([maria], [visit("outro", 1)], NOW);
    expect(s.visits30).toBe(0);
    expect(s.status).toBe("nunca_abriu");
  });

  it("sem link nenhum", () => {
    expect(summarizeClientActivity([], [], NOW)).toMatchObject({ status: "sem_link", people: [], timeline: [], lastVisitAt: null });
  });
});

describe("textos e detecção", () => {
  it("duração", () => {
    expect(formatDuration(0)).toBe("menos de 1 min");
    expect(formatDuration(59)).toBe("menos de 1 min");
    expect(formatDuration(240)).toBe("4 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(4200)).toBe("1 h 10 min");
  });

  it("nome do link", () => {
    expect(linkName({ recipientName: "  Carla ", tokenHint: "x1y2z3" })).toBe("Carla");
    expect(linkName({ recipientName: " ", tokenHint: "x1y2z3" })).toBe("Link …x1y2z3");
  });

  it("aparelho pelo navegador", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 Safari/605.1.15")).toBe("desktop");
    expect(deviceFromUserAgent(null)).toBeNull();
  });

  it("robôs e prévias de link não contam", () => {
    expect(isBotUserAgent("WhatsApp/2.24.1 A")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) Safari/605.1.15")).toBe(false);
  });
});

describe("pulso por workspace (lista de workspaces)", () => {
  it("última visita, visitas em 30 dias e situação de cada workspace", () => {
    const pulses = projectPulses(
      [{ projectId: "p1" }, { projectId: "p2" }, { projectId: null }],
      [
        { projectId: "p1", startedAt: daysAgo(2) },
        { projectId: "p1", startedAt: daysAgo(40) },
        { projectId: "p3", startedAt: daysAgo(25) },
      ],
      NOW,
    );
    expect(pulses.get("p1")).toEqual({ status: "usando", lastVisitAt: daysAgo(2), visits30: 1 });
    expect(pulses.get("p2")).toEqual({ status: "nunca_abriu", lastVisitAt: null, visits30: 0 });
    expect(pulses.get("p3")).toEqual({ status: "parado", lastVisitAt: daysAgo(25), visits30: 1 });
    expect(pulses.has("p4")).toBe(false);
  });
});
