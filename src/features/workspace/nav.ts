"use client";

// Navegação do painel: fonte única do menu de vidro (trilho e painel), da barra do celular,
// da folha "Mais", da busca de páginas e do título do topo. Grupos têm nome e ícone: no
// trilho recolhido aparece um ícone por grupo.

import { BarChart3, BriefcaseBusiness, Database, FolderKanban, Gem, Home, Inbox, ListChecks, PanelsTopLeft, Plug, Settings, Settings2, Share2, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, use } from "react";
import type { Product } from "@/features/pricing/pricing";
import { useWorkspaceSession } from "./WorkspaceProvider";

export type NavIcon = typeof Home;
export type NavItem = { href: string; label: string; icon: NavIcon; short?: string; soon?: boolean };
export type NavGroup = { id: string; label: string; icon: NavIcon; items: NavItem[] };

// cada produto tem o seu menu: dashboards não vê LPs e vice-versa
const NAVS: Record<Product, NavGroup[]> = {
  dash: [
    { id: "inicio", label: "Início", icon: Home, items: [{ href: "/painel", label: "Início", icon: Home }] },
    {
      id: "trabalho",
      label: "Trabalho",
      icon: BriefcaseBusiness,
      items: [
        { href: "/painel/workspaces", label: "Workspaces", icon: FolderKanban },
        { href: "/painel/dashboards", label: "Dashboards", icon: BarChart3 },
        { href: "/painel/a-fazer", label: "A Fazer", icon: ListChecks },
      ],
    },
    {
      id: "dados",
      label: "Dados",
      icon: Database,
      items: [
        { href: "/painel/contas", label: "Contas", icon: Plug },
        { href: "/painel/compartilhar", label: "Compartilhar", icon: Share2 },
      ],
    },
    // Landing pages: fora do menu da linha Dashboards até o lançamento; a rota continua existindo
    {
      id: "ajustes",
      label: "Ajustes",
      icon: Settings2,
      items: [
        { href: "/painel/plano", label: "Plano", icon: Gem },
        { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
      ],
    },
  ],
  lp: [
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
  ],
};

// aba "Interno" só para os admins da Vyzualize (o servidor confere de novo na página)
export const AdminContext = createContext(false);
const ADMIN_GROUP: NavGroup = { id: "vyzualize", label: "Vyzualize", icon: ShieldCheck, items: [{ href: "/painel/interno", label: "Interno", icon: ShieldCheck }] };

// bancada (/dev/painel): o endereço simulado, para a seção ativa e a tela cheia
export const PreviewPathContext = createContext<string | null>(null);
export function usePanelPath() {
  const real = usePathname();
  return use(PreviewPathContext) ?? real;
}

export function useNavGroups(): NavGroup[] {
  const groups = NAVS[useWorkspaceSession().workspace.product];
  return use(AdminContext) ? [...groups, ADMIN_GROUP] : groups;
}

export const flat = (groups: NavGroup[]) => groups.flatMap((g) => g.items);

/** Item ativo pelo prefixo mais longo: /painel/landing-pages/leads acende Leads, não Landing pages. */
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
