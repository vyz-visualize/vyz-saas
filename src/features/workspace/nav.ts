"use client";

// Navegação do painel, centrada no workspace (o cliente ou a marca; na tabela, projeto):
// - Início: a visão da organização inteira;
// - o workspace aberto: Visão geral, Dashboards, Contas, Pessoas e Ajustes, todos desse cliente
//   (no computador, o menu é a navegação do workspace; no celular, as abas do cabeçalho);
// - Rotina: A Fazer e Compartilhar (de todos os workspaces).
// A organização (todos os workspaces, Conexões, Plano e Configurações) fica no seletor do topo
// do menu e no menu da pessoa, para o menu ter só o dia a dia.
// O workspace aberto é o do endereço (/painel/workspaces/<id>/...) ou, fora dele, o último
// aberto (cookie vyz-project). Fonte única do menu lateral, da barra do celular e da folha "Mais".

import { BarChart3, FolderKanban, Gem, Home, Inbox, LayoutGrid, ListChecks, PanelsTopLeft, Plug, Settings, Settings2, Share2, ShieldCheck, Users, Workflow } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, use } from "react";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/supabase/cookies";
import { useWorkspaceSession } from "./WorkspaceProvider";

export type NavIcon = typeof Home;
export type NavItem = { href: string; label: string; icon: NavIcon; short?: string; soon?: boolean };
export type NavGroup = {
  id: string;
  label: string;
  icon: NavIcon;
  items: NavItem[];
  /** Grupo do workspace aberto: no menu recolhido, as iniciais dele no lugar do ícone. */
  workspace?: { id: string; name: string };
};

export type OpenProject = { id: string; name: string };

// aba "Interno" só para os admins da Vyzualize (o servidor confere de novo na página)
export const AdminContext = createContext(false);
const ADMIN_GROUP: NavGroup = { id: "vyzualize", label: "Vyzualize", icon: ShieldCheck, items: [{ href: "/painel/interno", label: "Interno", icon: ShieldCheck }] };

// bancada (/dev/painel): o endereço simulado, para a seção ativa e a tela cheia
export const PreviewPathContext = createContext<string | null>(null);
export function usePanelPath() {
  const real = usePathname();
  return use(PreviewPathContext) ?? real;
}

/** Endereços de um workspace. */
export const projectHref = (id: string, tab: "" | "dashboards" | "contas" | "pessoas" | "ajustes" = "") => `/painel/workspaces/${id}${tab ? `/${tab}` : ""}`;

const PROJECT_PATH = /^\/painel\/workspaces\/([0-9a-f-]{36})(?:\/([a-z-]+))?/i;

/** Workspace e aba do endereço (null fora das páginas de workspace). */
export function projectFromPath(path: string | null): { id: string; tab: string } | null {
  const m = path?.match(PROJECT_PATH);
  return m ? { id: m[1].toLowerCase(), tab: m[2] ?? "" } : null;
}

/** Guarda o workspace aberto (o servidor lê para abrir o painel nele e criar o dashboard sem conta nele). */
export function rememberProject(id: string) {
  try {
    document.cookie = `${ACTIVE_PROJECT_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {}
}

/** O workspace aberto: o do endereço; fora dele, o último aberto; sem cookie, o primeiro. */
export function useOpenProject(): OpenProject | null {
  const session = useWorkspaceSession();
  const path = usePanelPath();
  const projects = session.projects ?? [];
  const fromPath = projectFromPath(path)?.id;
  return projects.find((p) => p.id === fromPath) ?? projects.find((p) => p.id === session.currentProjectId) ?? projects[0] ?? null;
}

const LP_GROUPS: NavGroup[] = [
  {
    id: "paginas",
    label: "Páginas",
    icon: PanelsTopLeft,
    items: [
      { href: "/painel/landing-pages", label: "Landing pages", icon: PanelsTopLeft, short: "LPs" },
      { href: "/painel/landing-pages/leads", label: "Leads", icon: Inbox },
    ],
  },
  {
    id: "ajustes",
    label: "Ajustes",
    icon: Settings2,
    items: [
      { href: "/painel/plano", label: "Plano", icon: Gem },
      { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

function dashGroups(project: OpenProject | null): NavGroup[] {
  return [
    { id: "inicio", label: "Início", icon: Home, items: [{ href: "/painel", label: "Início", icon: Home }] },
    ...(project
      ? [
          {
            id: "workspace",
            label: project.name,
            icon: FolderKanban,
            workspace: project,
            items: [
              { href: projectHref(project.id), label: "Visão geral", icon: LayoutGrid },
              { href: projectHref(project.id, "dashboards"), label: "Dashboards", icon: BarChart3 },
              { href: projectHref(project.id, "contas"), label: "Contas", icon: Plug },
              { href: projectHref(project.id, "pessoas"), label: "Pessoas", icon: Users },
              { href: projectHref(project.id, "ajustes"), label: "Ajustes", icon: Settings2 },
            ],
          } satisfies NavGroup,
        ]
      : []),
    {
      id: "rotina",
      label: "Rotina",
      icon: Workflow,
      items: [
        { href: "/painel/a-fazer", label: "A Fazer", icon: ListChecks },
        { href: "/painel/compartilhar", label: "Compartilhar", icon: Share2 },
      ],
    },
  ];
}

/** Páginas da organização: ficam no seletor do topo do menu (e no "Mais" do celular), não no menu. */
export const ORG_PAGES = ["/painel/workspaces", "/painel/contas", "/painel/plano", "/painel/configuracoes"] as const;
export const isOrgPage = (path: string | null) => !!path && ORG_PAGES.some((h) => path === h || (path.startsWith(`${h}/`) && !projectFromPath(path)));

export function useNavGroups(): NavGroup[] {
  const { workspace } = useWorkspaceSession();
  const project = useOpenProject();
  const groups = workspace.product === "lp" ? LP_GROUPS : dashGroups(project);
  return use(AdminContext) ? [...groups, ADMIN_GROUP] : groups;
}

export const flat = (groups: NavGroup[]) => groups.flatMap((g) => g.items);

/** Item ativo pelo prefixo mais longo: /painel/workspaces/x/contas acende Contas, não Visão geral. Início só no endereço exato. */
export function activeHref(groups: NavGroup[], path: string | null): string | null {
  if (!path) return null;
  let best: string | null = null;
  for (const { href } of flat(groups)) {
    const hit = href === "/painel" ? path === "/painel" : path === href || path.startsWith(`${href}/`);
    if (hit && (!best || href.length > best.length)) best = href;
  }
  return best;
}

export const isActive = (groups: NavGroup[], path: string | null, href: string) => activeHref(groups, path) === href;

/** Os 4 atalhos da barra do celular (o resto vai para o "Mais"). */
export function mobilePrimary(groups: NavGroup[]): NavItem[] {
  const all = flat(groups);
  const ws = groups.find((g) => g.workspace);
  if (!ws) return all.slice(0, 4);
  const pick = [all.find((i) => i.href === "/painel"), ws.items[1], ws.items[2], all.find((i) => i.href === "/painel/a-fazer")].filter((i): i is NavItem => !!i);
  return pick.length === 4 ? pick : all.slice(0, 4);
}
