// Acessos do cliente (aba Acessos do workspace): quem abriu o link do dashboard, quando, por
// quanto tempo e quais telas viu. Puro: o servidor lê links e visitas (share_links e
// share_visits) e monta o resumo com estas funções; a tela só mostra.
//
// A situação do cliente sai da última visita: até 7 dias, usando; de 8 a 21, esfriando;
// mais que isso, parado. Com link e sem visita nenhuma, nunca abriu; sem link, sem link.

import type { BadgeTone } from "@/components/ui/kit";
import { linkStatus, type LinkStatus } from "@/features/share/links";

export type ClientStatus = "usando" | "esfriando" | "parado" | "nunca_abriu" | "sem_link";

const DAY = 86_400_000;
/** Até quantos dias desde a última visita vale cada situação. */
export const STATUS_DAYS = { usando: 7, esfriando: 21 } as const;

export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: BadgeTone; text: string }> = {
  usando: { label: "Usando", tone: "ok", text: "Abriu o dashboard nos últimos 7 dias." },
  esfriando: { label: "Esfriando", tone: "warn", text: "A última visita foi há mais de uma semana." },
  parado: { label: "Parado", tone: "error", text: "Ninguém abre o dashboard há mais de 3 semanas." },
  nunca_abriu: { label: "Nunca abriu", tone: "error", text: "Tem link, mas ninguém abriu ainda." },
  sem_link: { label: "Sem link", tone: "neutral", text: "Nenhum link foi mandado para este cliente." },
};

/** Ordem para a lista de clientes: quem precisa de atenção primeiro. */
export const STATUS_ORDER: ClientStatus[] = ["parado", "nunca_abriu", "esfriando", "usando", "sem_link"];

export function clientStatus(lastVisitAt: string | null, hasLinks: boolean, now: Date): ClientStatus {
  if (!lastVisitAt) return hasLinks ? "nunca_abriu" : "sem_link";
  const days = (now.getTime() - new Date(lastVisitAt).getTime()) / DAY;
  if (days <= STATUS_DAYS.usando) return "usando";
  if (days <= STATUS_DAYS.esfriando) return "esfriando";
  return "parado";
}

export type VisitDevice = "desktop" | "mobile" | "tablet";

export const DEVICE_LABEL: Record<VisitDevice, string> = { desktop: "computador", mobile: "celular", tablet: "tablet" };

/** Link do cliente como a aba precisa (sem token nem hash). */
export type ClientLink = {
  id: string;
  dashboardId: string;
  dashboardName: string;
  recipientName: string | null;
  tokenHint: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

/** Uma visita ao link (share_visits), com os nomes das telas já resolvidos. */
export type ClientVisit = {
  id: string;
  linkId: string;
  dashboardId: string;
  startedAt: string;
  lastSeenAt: string;
  seconds: number;
  pages: string[];
  device: VisitDevice | null;
};

export type ClientPerson = {
  linkId: string;
  name: string;
  named: boolean;
  dashboardName: string;
  linkState: LinkStatus;
  lastVisitAt: string | null;
  visits30: number;
  seconds30: number;
  status: ClientStatus;
};

export type ClientDashboardUse = { dashboardId: string; name: string; visits30: number; seconds30: number; lastVisitAt: string | null };

export type ClientTimelineItem = { id: string; at: string; who: string; dashboardName: string; seconds: number; pages: string[]; device: VisitDevice | null };

export type ClientActivity = {
  status: ClientStatus;
  lastVisitAt: string | null;
  visits7: number;
  visits30: number;
  /** Visitas nos 30 dias antes dos últimos 30 (para comparar). */
  visitsPrev30: number;
  seconds30: number;
  /** Links (pessoas) com visita nos últimos 30 dias. */
  people30: number;
  activeLinks: number;
  people: ClientPerson[];
  dashboards: ClientDashboardUse[];
  timeline: ClientTimelineItem[];
};

/** O que a aba Acessos recebe do servidor. */
export type ProjectClientActivity = ClientActivity & { now: string; timeZone: string; canShare: boolean };

/** Nome do link na tela: o nome dado ou "Link …abc123". */
export const linkName = (l: Pick<ClientLink, "recipientName" | "tokenHint">) => l.recipientName?.trim() || `Link …${l.tokenHint}`;

const TIMELINE = 30;

export function summarizeClientActivity(links: ClientLink[], visits: ClientVisit[], now: Date): ClientActivity {
  const t = now.getTime();
  const ago = (iso: string) => t - new Date(iso).getTime();
  const byLink = new Map(links.map((l) => [l.id, l]));
  const mine = visits.filter((v) => byLink.has(v.linkId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const in30 = mine.filter((v) => ago(v.startedAt) <= 30 * DAY);
  const lastVisitAt = mine[0]?.startedAt ?? null;
  const sum = (vs: ClientVisit[]) => vs.reduce((n, v) => n + v.seconds, 0);

  const people: ClientPerson[] = links
    .map((l) => {
      const vs = mine.filter((v) => v.linkId === l.id);
      const vs30 = vs.filter((v) => ago(v.startedAt) <= 30 * DAY);
      const last = vs[0]?.startedAt ?? null;
      const person: ClientPerson = {
        linkId: l.id,
        name: linkName(l),
        named: !!l.recipientName?.trim(),
        dashboardName: l.dashboardName,
        linkState: linkStatus(l, now),
        lastVisitAt: last,
        visits30: vs30.length,
        seconds30: sum(vs30),
        status: clientStatus(last, true, now),
      };
      return { person, createdAt: l.createdAt };
    })
    // link desativado que ninguém abriu não interessa mais
    .filter(({ person }) => person.linkState !== "revoked" || person.lastVisitAt)
    // quem abriu por último em cima; links que nunca abriram, pelos mais novos
    .sort((a, b) => (b.person.lastVisitAt ?? "").localeCompare(a.person.lastVisitAt ?? "") || b.createdAt.localeCompare(a.createdAt))
    .map(({ person }) => person);

  const dashNames = new Map(links.map((l) => [l.dashboardId, l.dashboardName]));
  const dashboards: ClientDashboardUse[] = [...dashNames]
    .map(([dashboardId, name]) => {
      const vs = mine.filter((v) => v.dashboardId === dashboardId);
      const vs30 = vs.filter((v) => ago(v.startedAt) <= 30 * DAY);
      return { dashboardId, name, visits30: vs30.length, seconds30: sum(vs30), lastVisitAt: vs[0]?.startedAt ?? null };
    })
    .sort((a, b) => b.visits30 - a.visits30 || (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));

  return {
    status: clientStatus(lastVisitAt, links.length > 0, now),
    lastVisitAt,
    visits7: mine.filter((v) => ago(v.startedAt) <= 7 * DAY).length,
    visits30: in30.length,
    visitsPrev30: mine.filter((v) => ago(v.startedAt) > 30 * DAY && ago(v.startedAt) <= 60 * DAY).length,
    seconds30: sum(in30),
    people30: new Set(in30.map((v) => v.linkId)).size,
    activeLinks: links.filter((l) => linkStatus(l, now) === "active").length,
    people,
    dashboards,
    timeline: mine.slice(0, TIMELINE).map((v) => {
      const l = byLink.get(v.linkId)!;
      return { id: v.id, at: v.startedAt, who: linkName(l), dashboardName: l.dashboardName, seconds: v.seconds, pages: v.pages, device: v.device };
    }),
  };
}

/** 0 → "menos de 1 min"; 240 → "4 min"; 4200 → "1 h 10 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Tipo de aparelho pelo navegador (só isso fica gravado da visita). */
export function deviceFromUserAgent(ua: string | null | undefined): VisitDevice | null {
  if (!ua) return null;
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "mobile";
  return "desktop";
}

/** Robôs e prévias de link (WhatsApp, Slack, Facebook...) não contam como visita. */
export const isBotUserAgent = (ua: string | null | undefined) => !ua || /bot|crawl|spider|preview|facebookexternalhit|WhatsApp|Slackbot|TelegramBot|Discordbot|headless|lighthouse/i.test(ua);

/** Situação e última visita de cada workspace, para a lista de workspaces. */
export type ProjectClientPulse = { status: ClientStatus; lastVisitAt: string | null; visits30: number };

export function projectPulses(
  links: { projectId: string | null }[],
  visits: { projectId: string | null; startedAt: string }[],
  now: Date,
): Map<string, ProjectClientPulse> {
  const out = new Map<string, ProjectClientPulse>();
  const withLinks = new Set(links.map((l) => l.projectId).filter((p): p is string => !!p));
  const last = new Map<string, string>();
  const count = new Map<string, number>();
  for (const v of visits) {
    if (!v.projectId) continue;
    if (!last.has(v.projectId) || v.startedAt > last.get(v.projectId)!) last.set(v.projectId, v.startedAt);
    if (now.getTime() - new Date(v.startedAt).getTime() <= 30 * DAY) count.set(v.projectId, (count.get(v.projectId) ?? 0) + 1);
  }
  for (const id of new Set([...withLinks, ...last.keys()])) {
    const lastVisitAt = last.get(id) ?? null;
    out.set(id, { status: clientStatus(lastVisitAt, withLinks.has(id) || !!lastVisitAt, now), lastVisitAt, visits30: count.get(id) ?? 0 });
  }
  return out;
}
