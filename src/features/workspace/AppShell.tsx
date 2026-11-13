"use client";

// Moldura do painel. No computador: menu lateral em grupos (com o workspace em cima e a
// pessoa embaixo), topo com a seção aberta e o conteúdo num fundo neutro com cartões
// brancos. A seção ativa é uma pílula que desliza entre os itens (layoutId). O menu recolhe
// pelo botão do topo ou com "[", e o estado fica no <html data-sidebar>, aplicado antes da
// primeira pintura. No celular: topo curto, barra flutuante embaixo e "Mais" numa folha que
// sobe (o resto do menu, a troca de workspace e a conta).
// A moldura marca [data-ui="app"]: é o que liga os tokens do painel (globals.css).
// O dashboard (ver, editar e montar) abre em tela cheia: sem o menu do produto, só uma barra
// fina com o botão de voltar (isFocusPath), e o conteúdo dele fica nos tokens da marca.

import { AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, Check, ChevronRight, ChevronsUpDown, FolderKanban, Gem, Home, Inbox, Info, ListChecks, LogOut, Menu, Moon, PanelLeft, PanelsTopLeft, Plug, Settings, Share2, ShieldCheck, Sun } from "lucide-react";
import { LazyMotion, m, MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, use, useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Modal, PendingChip } from "@/components/ui/kit";
import { Menu as DropMenu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { setTheme, ThemeToggle, useTheme } from "@/components/ui/ThemeToggle";
import { Tooltip, TooltipProvider } from "@/components/ui/Tooltip";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { AgentBar, AgentFab } from "@/features/agent/AgentEntry";
import { AgentProvider } from "@/features/agent/AgentProvider";
import { Caption } from "@/features/agent/Caption";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import { planBadge } from "./home-steps";
import { signOut } from "@/server/auth/actions";
import { switchWorkspace } from "@/server/workspace/actions";
import type { Product } from "@/features/pricing/pricing";
import { FOCUS_ACTIONS_ID, isFocusPath } from "./focus";
import { subscriptionNotice } from "./notice";
import { ROLE_LABEL } from "./session";
import { useWorkspaceSession } from "./WorkspaceProvider";

type NavItem = { href: string; label: string; icon: typeof Home; short?: string; soon?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

// cada produto tem o seu menu: dashboards não vê LPs e vice-versa
const NAVS: Record<Product, NavGroup[]> = {
  dash: [
    { label: null, items: [{ href: "/painel", label: "Início", icon: Home }] },
    {
      label: "Trabalho",
      items: [
        { href: "/painel/projetos", label: "Projetos", icon: FolderKanban },
        { href: "/painel/dashboards", label: "Dashboards", icon: BarChart3 },
        { href: "/painel/a-fazer", label: "A Fazer", icon: ListChecks },
      ],
    },
    {
      label: "Dados",
      items: [
        { href: "/painel/contas", label: "Contas", icon: Plug },
        { href: "/painel/compartilhar", label: "Compartilhar", icon: Share2 },
      ],
    },
    // Landing pages: fora do menu da linha Dashboards até o lançamento; a rota continua existindo
    {
      label: "Conta",
      items: [
        { href: "/painel/plano", label: "Plano", icon: Gem },
        { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
      ],
    },
  ],
  lp: [
    {
      label: null,
      items: [
        { href: "/painel/landing-pages", label: "Landing pages", icon: PanelsTopLeft, short: "LPs" },
        { href: "/painel/landing-pages/leads", label: "Leads", icon: Inbox },
      ],
    },
    {
      label: "Conta",
      items: [
        { href: "/painel/plano", label: "Plano", icon: Gem },
        { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
      ],
    },
  ],
};

// aba "Interno" só para os admins da Vyzualize (o servidor confere de novo na página)
const AdminContext = createContext(false);
const ADMIN_GROUP: NavGroup = { label: "Vyzualize", items: [{ href: "/painel/interno", label: "Interno", icon: ShieldCheck }] };

// bancada (/dev/painel): o endereço simulado, para a seção ativa e a tela cheia
const PreviewPathContext = createContext<string | null>(null);
function usePanelPath() {
  const real = usePathname();
  return use(PreviewPathContext) ?? real;
}

function useNavGroups(): NavGroup[] {
  const groups = NAVS[useWorkspaceSession().workspace.product];
  return use(AdminContext) ? [...groups, ADMIN_GROUP] : groups;
}

const flat = (groups: NavGroup[]) => groups.flatMap((g) => g.items);

const isActive = (path: string | null, href: string) =>
  href === "/painel" ? path === "/painel" : href === "/painel/landing-pages" ? !!path?.startsWith(href) && !path.startsWith("/painel/landing-pages/leads") : !!path?.startsWith(href);

// layoutId precisa das features de layout; chegam depois da primeira pintura
const loadFeatures = () => import("motion/react").then((r) => r.domMax);
const PILL_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;

// ---- estado do menu lateral (no <html>, com localStorage) ---------------------

const SB_KEY = "vyz:sidebar";
const SB_EVENT = "vyz-sidebar";

function subscribeSidebar(cb: () => void) {
  window.addEventListener(SB_EVENT, cb);
  return () => window.removeEventListener(SB_EVENT, cb);
}
const readCollapsed = () => document.documentElement.getAttribute("data-sidebar") === "closed";

function setCollapsed(next: boolean) {
  document.documentElement.setAttribute("data-sidebar", next ? "closed" : "open");
  try {
    localStorage.setItem(SB_KEY, next ? "closed" : "open");
  } catch {}
  window.dispatchEvent(new Event(SB_EVENT));
}

function useCollapsed() {
  return useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);
}

/** Atalho "[" (ignorado quando o foco está num campo). */
function useSidebarShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("[role=combobox],[role=listbox],[role=menu],[role=dialog]"))) return;
      e.preventDefault();
      setCollapsed(!readCollapsed());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// ---- peças ---------------------------------------------------------------------

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

/** "Avançado · 1 de 2 projetos" (o limite do plano, com o que já está em uso) ou "Sem plano ativo". */
function planLine(session: Pick<ReturnType<typeof useWorkspaceSession>, "access" | "usage">, product: Product) {
  const { access, usage } = session;
  if (!access.hasAccess || !access.tier) return "Sem plano ativo";
  if (product === "lp") return `${TIER_LABEL[access.tier]} · Landing pages`;
  return planBadge(TIER_LABEL[access.tier], usage.projects, access.accountsQuantity);
}

// rótulos somem antes de recolher e voltam depois de expandir, sem quebrar linha
const fade = "whitespace-nowrap transition-[opacity,transform] duration-200 delay-150 ease-brand sb-closed:pointer-events-none sb-closed:-translate-x-1.5 sb-closed:opacity-0 sb-closed:delay-0 sb-closed:duration-100";
const ring = "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const iconBtn = `inline-flex size-9 shrink-0 items-center justify-center rounded-control text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg ${ring}`;

function WorkspaceAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center bg-accent font-bold text-on-accent ${size === "lg" ? "size-11 rounded-[13px] text-[14px]" : "size-9 rounded-[11px] text-[12.5px]"}`}>
      {initials(name)}
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent">
      {initials(name)}
    </span>
  );
}

// ---- menu lateral ----------------------------------------------------------------

function SideNav({ path, collapsed }: { path: string | null; collapsed: boolean }) {
  const groups = useNavGroups();
  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi}>
          {g.label && (
            <>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.07em] text-fg-2/80 uppercase sb-closed:hidden">{g.label}</p>
              <span aria-hidden className="mx-auto mb-3 hidden h-px w-6 bg-line sb-closed:block" />
            </>
          )}
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: I, soon }) => {
              const active = isActive(path, href);
              return (
                <li key={href} className="relative">
                  {active && <m.span layoutId="side-pill" transition={PILL_SPRING} aria-hidden className="absolute inset-0 rounded-control border border-line bg-card shadow-card" />}
                  <Tooltip content={soon ? `${label} · em breve` : label} disabled={!collapsed}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? (soon ? `${label}, em breve` : label) : undefined}
                      className={`group relative flex h-10 items-center gap-3 overflow-hidden rounded-control px-3 text-[14px] transition-colors duration-150 ${ring} ${active ? "font-semibold text-fg" : "font-medium text-fg-2 hover:bg-surface-2 hover:text-fg"}`}
                    >
                      <I size={18} aria-hidden className={`shrink-0 transition-transform duration-300 ease-brand sb-closed:translate-x-[5px] ${active ? "text-accent" : ""}`} />
                      <span className={fade}>
                        {label}
                        {soon && <span className="ml-2 rounded-chip border border-line px-1.5 py-px text-[10.5px] font-medium">Em breve</span>}
                      </span>
                    </Link>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ActiveSideNav({ collapsed }: { collapsed: boolean }) {
  return <SideNav path={usePanelPath()} collapsed={collapsed} />;
}

/** Workspace no topo do menu: nome, plano e a troca (quando a pessoa está em mais de um). Recolhido, vira avatar. */
function WorkspaceMenu({ collapsed }: { collapsed: boolean }) {
  const { workspace: ws, access, usage, memberships } = useWorkspaceSession();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const sub = switching ? "Abrindo…" : planLine({ access, usage }, ws.product);
  return (
    <DropMenu>
      <Tooltip content={ws.name} disabled={!collapsed}>
        <MenuTrigger
          aria-label={`${ws.name}, ${sub}. Abrir menu do workspace`}
          className={`flex h-[52px] w-full items-center gap-2.5 overflow-hidden rounded-[14px] border border-line bg-card px-2 text-left shadow-card transition-colors duration-150 hover:border-fg-2/40 data-[state=open]:border-fg-2/40 sb-closed:border-transparent sb-closed:bg-transparent sb-closed:shadow-none ${ring}`}
        >
          <span className="transition-transform duration-300 ease-brand sb-closed:translate-x-px">
            <WorkspaceAvatar name={ws.name} />
          </span>
          <span className={`min-w-0 flex-1 ${fade}`}>
            <span className="block truncate text-[13.5px] leading-tight font-semibold text-fg">{ws.name}</span>
            <span className="mt-0.5 block truncate text-[12px] leading-tight text-fg-2">{sub}</span>
          </span>
          <ChevronsUpDown size={15} aria-hidden className={`mr-1 shrink-0 text-fg-2 ${fade}`} />
        </MenuTrigger>
      </Tooltip>
      <MenuContent side={collapsed ? "right" : "bottom"} align="start" className={collapsed ? "min-w-[15rem]" : "w-[var(--radix-dropdown-menu-trigger-width)]"}>
        {memberships.length > 1 && (
          <>
            <MenuLabel>Workspaces</MenuLabel>
            {memberships.map((mb) => (
              <MenuCheckItem
                key={mb.id}
                checked={mb.id === ws.id}
                disabled={switching}
                onSelect={() => {
                  if (mb.id !== ws.id) startSwitch(() => switchWorkspace(mb.id));
                }}
              >
                <span className="min-w-0 flex-1 truncate">{mb.name}</span>
                <span className="ml-3 shrink-0 text-[11.5px] text-fg-2">{ROLE_LABEL[mb.role]}</span>
              </MenuCheckItem>
            ))}
            <MenuSeparator />
          </>
        )}
        <MenuItem icon={<Gem size={15} />} onSelect={() => router.push("/painel/plano")}>
          Plano e cobrança
        </MenuItem>
        <MenuItem icon={<Settings size={15} />} onSelect={() => router.push("/painel/configuracoes")}>
          Configurações
        </MenuItem>
      </MenuContent>
    </DropMenu>
  );
}

/** Uso do plano no pé do menu: os projetos, que é o que o plano limita. Some com o menu recolhido e em telas baixas. */
function UsageCard() {
  const { access, usage, workspace } = useWorkspaceSession();
  if (workspace.product !== "dash") return null;
  if (!access.hasAccess || !access.tier) {
    return (
      <Link href="/painel/plano" className={`block rounded-[14px] border border-dashed border-line p-3 text-[12.5px] text-fg-2 transition-colors hover:border-accent hover:text-fg sb-closed:hidden [@media(max-height:720px)]:hidden ${ring}`}>
        <span className="block font-semibold text-fg">Sem plano ativo</span>
        Escolha um plano para liberar o painel.
      </Link>
    );
  }
  const limit = Math.max(1, access.accountsQuantity);
  const ratio = Math.min(1, usage.projects / limit);
  const full = usage.projects >= limit;
  return (
    <Link href="/painel/plano" className={`group block rounded-[14px] border border-line bg-card p-3 shadow-card transition-colors hover:border-fg-2/40 sb-closed:hidden [@media(max-height:720px)]:hidden ${ring}`}>
      <span className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="font-semibold text-fg">Plano {TIER_LABEL[access.tier]}</span>
        <ArrowUpRight size={14} aria-hidden className="text-fg-2 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className={`block h-full rounded-full ${full ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
      <span className="mt-1.5 block text-[12px] text-fg-2 tnum">
        {usage.projects} de {access.accountsQuantity} {access.accountsQuantity === 1 ? "projeto" : "projetos"}
      </span>
    </Link>
  );
}

/** A pessoa no pé do menu: tema, site e Sair. Recolhido, vira avatar. */
function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, role } = useWorkspaceSession();
  const router = useRouter();
  const dark = useTheme() === "dark";
  const name = user.fullName || user.email;
  return (
    <DropMenu>
      <Tooltip content={name} disabled={!collapsed}>
        <MenuTrigger aria-label={`${name}. Abrir menu da conta`} className={`flex h-12 w-full items-center gap-2.5 overflow-hidden rounded-[12px] px-1.5 text-left transition-colors duration-150 hover:bg-surface-2 data-[state=open]:bg-surface-2 ${ring}`}>
          <span className="transition-transform duration-300 ease-brand sb-closed:translate-x-[2px]">
            <UserAvatar name={name} />
          </span>
          <span className={`min-w-0 flex-1 ${fade}`}>
            <span className="block truncate text-[13px] leading-tight font-semibold text-fg">{name}</span>
            <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-fg-2">{ROLE_LABEL[role]}</span>
          </span>
          <ChevronsUpDown size={14} aria-hidden className={`mr-1 shrink-0 text-fg-2 ${fade}`} />
        </MenuTrigger>
      </Tooltip>
      <MenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className={collapsed ? "min-w-[15rem]" : "w-[var(--radix-dropdown-menu-trigger-width)]"}>
        <div className="px-2.5 pt-1.5 pb-2">
          <p className="truncate text-[13.5px] font-semibold">{name}</p>
          <p className="truncate text-[12px] text-fg-2">{user.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem icon={<Settings size={15} />} onSelect={() => router.push("/painel/configuracoes")}>
          Minha conta
        </MenuItem>
        <MenuItem icon={dark ? <Sun size={15} /> : <Moon size={15} />} onSelect={() => setTheme(dark ? "light" : "dark")}>
          {dark ? "Modo claro" : "Modo escuro"}
        </MenuItem>
        <MenuItem icon={<ArrowUpRight size={15} />} onSelect={() => router.push("/")}>
          Voltar ao site
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<LogOut size={15} />} onSelect={() => void signOut()}>
          Sair
        </MenuItem>
      </MenuContent>
    </DropMenu>
  );
}

function Sidebar() {
  const collapsed = useCollapsed();
  useSidebarShortcut();
  return (
    <aside
      aria-label="Navegação do painel"
      className="hidden h-dvh w-[264px] shrink-0 flex-col overflow-hidden border-r border-line px-3 pt-4 pb-3 transition-[width] duration-300 ease-brand sb-closed:w-[76px] sb-closed:delay-100 md:flex print:hidden"
    >
      <div className="flex h-9 items-center px-2">
        <Link href="/painel" aria-label="VYZ, início do painel" className={`block w-[62px] shrink-0 rounded-[6px] transition-[width,transform] duration-300 ease-brand sb-closed:w-[36px] ${ring}`}>
          <Wordmark decorative />
        </Link>
      </div>

      <div className="mt-5">
        <WorkspaceMenu collapsed={collapsed} />
      </div>

      <nav aria-label="Seções" className="-mx-1 mt-5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 pb-2 [scrollbar-width:none]">
        <Suspense fallback={<SideNav path={null} collapsed={collapsed} />}>
          <ActiveSideNav collapsed={collapsed} />
        </Suspense>
      </nav>

      <div className="space-y-2 pt-2">
        <UsageCard />
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

// ---- barra de baixo (celular) ------------------------------------------------

function BottomNav({ path, onMore }: { path: string | null; onMore: () => void }) {
  const all = flat(useNavGroups());
  const items = all.slice(0, 4);
  const moreActive = all.slice(4).some((n) => isActive(path, n.href));
  const cell = (active: boolean, I: typeof Home, label: string) => (
    <>
      <span className={`inline-flex h-8 w-12 items-center justify-center rounded-chip transition-colors duration-200 ${active ? "bg-accent-soft text-accent" : ""}`}>
        <I size={20} aria-hidden strokeWidth={active ? 2.2 : 1.9} />
      </span>
      <span className={`max-w-full truncate ${active ? "font-semibold text-fg" : ""}`}>{label}</span>
    </>
  );
  const cls = "flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-[14px] text-[10.5px] text-fg-2 outline-none focus-visible:bg-surface-2";
  return (
    <ul className="grid grid-cols-5 gap-0.5">
      {items.map((n) => {
        const active = isActive(path, n.href);
        return (
          <li key={n.href} className="min-w-0">
            <Link href={n.href} aria-current={active ? "page" : undefined} className={cls}>
              {cell(active, n.icon, n.short ?? n.label)}
            </Link>
          </li>
        );
      })}
      <li className="min-w-0">
        <button type="button" onClick={onMore} aria-haspopup="dialog" className={cls}>
          {cell(moreActive, Menu, "Mais")}
        </button>
      </li>
    </ul>
  );
}

function ActiveBottomNav({ onMore }: { onMore: () => void }) {
  return <BottomNav path={usePanelPath()} onMore={onMore} />;
}

/** Linha da folha "Mais". */
const sheetRow = `flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] font-medium transition-colors hover:bg-surface-2 ${ring}`;

/** No celular não há menu lateral: a troca de workspace fica no "Mais". */
function MobileWorkspaces() {
  const { workspace: ws, memberships } = useWorkspaceSession();
  const [switching, startSwitch] = useTransition();
  if (memberships.length < 2) return null;
  return (
    <section aria-label="Workspaces" className="mt-4">
      <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.07em] text-fg-2 uppercase">Trocar de workspace</p>
      <ul>
        {memberships.map((mb) => (
          <li key={mb.id}>
            <button
              type="button"
              disabled={switching}
              aria-current={mb.id === ws.id ? "true" : undefined}
              onClick={(e) => {
                if (mb.id === ws.id) return;
                e.stopPropagation();
                startSwitch(() => switchWorkspace(mb.id));
              }}
              className={`${sheetRow} disabled:opacity-50`}
            >
              <WorkspaceAvatar name={mb.name} />
              <span className="min-w-0 flex-1 truncate">{mb.name}</span>
              <span className="text-[12px] font-normal text-fg-2">{switching && mb.id !== ws.id ? "…" : ROLE_LABEL[mb.role]}</span>
              {mb.id === ws.id && <Check size={17} aria-hidden className="text-accent" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A folha "Mais" do celular: o resto do menu, os workspaces, o tema e a conta. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace: ws, access, usage, user } = useWorkspaceSession();
  const rest = flat(useNavGroups()).slice(4);
  const dark = useTheme() === "dark";
  return (
    <Modal open={open} onClose={onClose} title="Mais">
      <div onClick={onClose}>
        <Link href="/painel/plano" className={`flex items-center gap-3 rounded-[14px] border border-line bg-card p-3 shadow-card ${ring}`}>
          <WorkspaceAvatar name={ws.name} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{ws.name}</span>
            <span className="block truncate text-[13px] text-fg-2">{planLine({ access, usage }, ws.product)}</span>
          </span>
          <ChevronRight size={18} aria-hidden className="shrink-0 text-fg-2" />
        </Link>

        <ul className="mt-3">
          {rest.map(({ href, label, icon: I, soon }) => (
            <li key={href}>
              <Link href={href} className={sheetRow}>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg">
                  <I size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {soon && <span className="rounded-chip border border-line px-1.5 py-px text-[11px] font-normal text-fg-2">Em breve</span>}
                <ChevronRight size={17} aria-hidden className="shrink-0 text-fg-2" />
              </Link>
            </li>
          ))}
        </ul>

        <MobileWorkspaces />

        <div className="mt-4 border-t border-line pt-3">
          <p className="truncate px-3 pb-1 text-[12.5px] text-fg-2">{user.email}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTheme(dark ? "light" : "dark");
            }}
            className={sheetRow}
          >
            {dark ? <Sun size={18} aria-hidden className="text-fg-2" /> : <Moon size={18} aria-hidden className="text-fg-2" />}
            {dark ? "Modo claro" : "Modo escuro"}
          </button>
          <Link href="/" className={sheetRow}>
            <ArrowUpRight size={18} aria-hidden className="text-fg-2" /> Voltar ao site
          </Link>
          <button type="button" onClick={() => void signOut()} className={`${sheetRow} text-error-fg`}>
            <LogOut size={18} aria-hidden /> Sair
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- topo do painel ------------------------------------------------------------

/** A seção aberta, no topo: orienta quando o título da página já rolou para fora. */
function SectionCrumb({ path }: { path: string | null }) {
  const { workspace } = useWorkspaceSession();
  const current = flat(useNavGroups()).find((n) => isActive(path, n.href));
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
      <span className="hidden truncate text-fg-2 lg:inline">{workspace.name}</span>
      <ChevronRight size={14} aria-hidden className="hidden shrink-0 text-fg-2/60 lg:inline" />
      <span className="truncate font-semibold text-fg">{current?.label ?? "Painel"}</span>
    </p>
  );
}

function ActiveSectionCrumb() {
  return <SectionCrumb path={usePanelPath()} />;
}

function SidebarToggle() {
  const collapsed = useCollapsed();
  return (
    <Tooltip content={collapsed ? "Expandir menu  [" : "Recolher menu  ["} side="bottom">
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} aria-keyshortcuts="[" aria-expanded={!collapsed} className={`${iconBtn} -ml-2 max-md:hidden`}>
        <PanelLeft size={18} aria-hidden />
      </button>
    </Tooltip>
  );
}

const NOTICE_STYLE = {
  error: "bg-error-soft text-fg [&_svg]:text-error-fg",
  warn: "bg-[color-mix(in_srgb,var(--color-warning)_16%,var(--bg))] text-fg [&_svg]:text-[var(--color-warning)]",
  info: "bg-accent-soft text-fg [&_svg]:text-accent",
} as const;

/** Faixa do topo: pagamento em atraso, cancelamento agendado ou assinatura inativa. */
function SubscriptionBanner({ wide = false }: { wide?: boolean }) {
  const { access } = useWorkspaceSession();
  const notice = subscriptionNotice(access);
  if (!notice) return null;
  const Icon = notice.tone === "info" ? Info : AlertTriangle;
  return (
    <div role={notice.tone === "info" ? "status" : "alert"} className={`px-4 py-2.5 text-[13px] sm:px-6 ${wide ? "" : "lg:px-10"} ${NOTICE_STYLE[notice.tone]}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icon size={15} aria-hidden className="shrink-0" />
        <p className="min-w-0 flex-1">{notice.text}</p>
        <Link href={notice.action.href} className="shrink-0 font-semibold underline-offset-2 outline-none hover:underline focus-visible:underline">
          {notice.action.label}
        </Link>
      </div>
    </div>
  );
}

const topBar = "sticky top-0 z-30 border-b border-line bg-[var(--nav-bg)] backdrop-blur-md print:hidden";

export function AppShell({ children, simulatedBilling = false, isAdmin = false, previewPath = null }: { children: ReactNode; simulatedBilling?: boolean; isAdmin?: boolean; /** Só na bancada: endereço simulado. */ previewPath?: string | null }) {
  return (
    <AdminContext value={isAdmin}>
      <PreviewPathContext value={previewPath}>
        <Shell simulatedBilling={simulatedBilling}>{children}</Shell>
      </PreviewPathContext>
    </AdminContext>
  );
}

/**
 * Dashboard em tela cheia: barra fina com o voltar; o próprio dashboard traz a navegação dele.
 * O modelo com visual próprio vai de ponta a ponta e traz o voltar dentro dele, nas cores dele:
 * a barra (.focus-bar) e o respiro do <main> somem pelo globals.css ([data-skin-screen]).
 * O <main> fica nos tokens da marca (.tokens-brand): o dashboard é o mesmo que o cliente vê no link.
 */
function FocusShell({ children }: { children: ReactNode }) {
  return (
    <div data-ui="app" className="shell-content min-h-dvh bg-bg md:h-dvh md:overflow-y-auto print:block print:h-auto print:overflow-visible print:bg-white">
      <header className={`focus-header ${topBar}`}>
        <div className="focus-bar flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/painel/dashboards" className={`-ml-2.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-[13.5px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg ${ring}`}>
            <ArrowLeft size={16} aria-hidden />
            Dashboards
          </Link>
          {/* as ações do dashboard (editar, compartilhar, exportar) entram aqui: FocusBarActions */}
          <div id={FOCUS_ACTIONS_ID} data-actions-slot className="flex min-w-10 flex-1 items-center justify-end" />
          <ThemeToggle ghost className="size-9 shrink-0" />
        </div>
        <SubscriptionBanner wide />
      </header>
      <main id="conteudo" className="focus-main tokens-brand min-h-[calc(100dvh-3.5rem)] bg-bg px-4 pt-6 pb-28 text-fg sm:px-6 print:min-h-0 print:p-0">
        {children}
      </main>
    </div>
  );
}

function Shell({ children, simulatedBilling }: { children: ReactNode; simulatedBilling: boolean }) {
  const [more, setMore] = useState(false);
  const focus = isFocusPath(usePanelPath());
  if (focus)
    return (
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <AgentProvider>
              <FocusShell>{children}</FocusShell>
              <AgentFab />
              <AgentDrawer />
              <Caption />
            </AgentProvider>
          </TooltipProvider>
        </MotionConfig>
      </LazyMotion>
    );
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <AgentProvider>
            <div data-ui="app" className="min-h-dvh bg-bg md:flex md:h-dvh md:overflow-hidden print:block print:h-auto print:bg-white">
              <a href="#conteudo" className="sr-only rounded-control bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]">
                Pular para o conteúdo
              </a>
              <Sidebar />

              <div className="shell-content min-h-dvh min-w-0 flex-1 md:h-dvh md:min-h-0 md:overflow-y-auto print:h-auto print:overflow-visible">
                <header className={`@container ${topBar}`}>
                  <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href="/painel" aria-label="VYZ, início do painel" className={`mr-1 block w-[52px] shrink-0 rounded-[6px] md:hidden ${ring}`}>
                        <Wordmark decorative />
                      </Link>
                      <SidebarToggle />
                      <span aria-hidden className="h-5 w-px shrink-0 bg-line" />
                      <Suspense fallback={<SectionCrumb path={null} />}>
                        <ActiveSectionCrumb />
                      </Suspense>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {simulatedBilling && <PendingChip className="max-lg:hidden" label="Pagamento simulado" detail="A cobrança ainda é simulada: nenhum valor é cobrado. A cobrança real entra com a Stripe." />}
                      <div className="hidden @[760px]:block">
                        <AgentBar />
                      </div>
                      <ThemeToggle ghost className="size-9 shrink-0" />
                    </div>
                  </div>
                  <SubscriptionBanner />
                </header>
                <main id="conteudo" className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-36 sm:px-6 md:pb-28 lg:px-10 lg:pt-9 print:max-w-none print:p-0">
                  {children}
                </main>
              </div>

              <nav aria-label="Seções" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-[22px] border border-line bg-[color-mix(in_srgb,var(--card)_92%,transparent)] p-1.5 shadow-pop backdrop-blur-lg md:hidden print:hidden">
                <Suspense fallback={<BottomNav path={null} onMore={() => setMore(true)} />}>
                  <ActiveBottomNav onMore={() => setMore(true)} />
                </Suspense>
              </nav>
              <MoreSheet open={more} onClose={() => setMore(false)} />
              <AgentFab />
              <AgentDrawer />
              <Caption />
            </div>
          </AgentProvider>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
