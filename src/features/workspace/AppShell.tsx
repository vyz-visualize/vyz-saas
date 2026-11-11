"use client";

// Moldura do painel: a sidebar é a "aba" e o conteúdo mora num painel
// arredondado. A aba ativa usa a cor do painel e se funde nele pelos cantos
// côncavos (.side-tab no globals.css); um único indicador desliza entre os
// itens (layoutId). A sidebar recolhe com o botão ou com "[", e o estado
// fica no <html data-sidebar>, aplicado antes da primeira pintura. O topo
// mostra o plano real da sessão e, quando há, o aviso da assinatura.
// O dashboard (ver, editar e montar) abre em tela cheia: sem a sidebar do
// produto, só uma barra fina com o botão de voltar (isFocusPath).

import { AlertTriangle, ArrowLeft, BarChart3, Check, ListChecks, ChevronsUpDown, FolderKanban, Gem, Home, Inbox, Info, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PanelsTopLeft, Plug, Settings, Share2, ShieldCheck } from "lucide-react";
import { LazyMotion, m, MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, use, useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Modal, PendingChip } from "@/components/ui/kit";
import { Menu as DropMenu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip, TooltipProvider } from "@/components/ui/Tooltip";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { AgentBar, AgentFab } from "@/features/agent/AgentEntry";
import { AgentProvider } from "@/features/agent/AgentProvider";
import { Caption } from "@/features/agent/Caption";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import { signOut } from "@/server/auth/actions";
import { switchWorkspace } from "@/server/workspace/actions";
import type { Product } from "@/features/pricing/pricing";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { FOCUS_ACTIONS_ID, isFocusPath } from "./focus";
import { subscriptionNotice } from "./notice";
import { ROLE_LABEL } from "./session";
import { useWorkspaceSession } from "./WorkspaceProvider";

type NavItem = { href: string; label: string; icon: typeof Home; short?: string; soon?: boolean };

// cada produto tem o seu menu: dashboards não vê LPs e vice-versa
const NAVS: Record<Product, NavItem[]> = {
  dash: [
    { href: "/painel", label: "Início", icon: Home },
    { href: "/painel/projetos", label: "Projetos", icon: FolderKanban },
    { href: "/painel/dashboards", label: "Dashboards", icon: BarChart3 },
    { href: "/painel/a-fazer", label: "A Fazer", icon: ListChecks },
    { href: "/painel/contas", label: "Contas", icon: Plug },
    { href: "/painel/compartilhar", label: "Compartilhar", icon: Share2 },
    ...(SHOW_LANDING_PAGES ? [] : [{ href: "/painel/landing-pages", label: "Landing pages", icon: PanelsTopLeft, short: "LPs", soon: true }]),
    { href: "/painel/plano", label: "Plano", icon: Gem },
    { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
  ],
  lp: [
    { href: "/painel/landing-pages", label: "Landing pages", icon: PanelsTopLeft, short: "LPs" },
    { href: "/painel/landing-pages/leads", label: "Leads", icon: Inbox },
    { href: "/painel/plano", label: "Plano", icon: Gem },
    { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
  ],
};

// aba "Interno" só para os admins da Vyzualize (o servidor confere de novo na página)
const AdminContext = createContext(false);
const ADMIN_ITEM: NavItem = { href: "/painel/interno", label: "Interno", icon: ShieldCheck };

function useNav(): NavItem[] {
  const nav = NAVS[useWorkspaceSession().workspace.product];
  return use(AdminContext) ? [...nav, ADMIN_ITEM] : nav;
}

const isActive = (path: string | null, href: string) =>
  href === "/painel" ? path === "/painel" : href === "/painel/landing-pages" ? !!path?.startsWith(href) && !path.startsWith("/painel/landing-pages/leads") : !!path?.startsWith(href);

// layoutId precisa das features de layout; chegam depois da primeira pintura
const loadFeatures = () => import("motion/react").then((r) => r.domMax);
const TAB_SPRING = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;

// ---- estado da sidebar (no <html>, com localStorage) -------------------------

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

// ---- sidebar -----------------------------------------------------------------

// rótulos somem antes de recolher e voltam depois de expandir, sem quebrar linha
const fade = "whitespace-nowrap transition-[opacity,transform] duration-200 delay-150 ease-brand sb-closed:pointer-events-none sb-closed:-translate-x-1.5 sb-closed:opacity-0 sb-closed:delay-0 sb-closed:duration-100";

function SideNav({ path, collapsed }: { path: string | null; collapsed: boolean }) {
  const nav = useNav();
  return (
    <ul className="space-y-1">
      {nav.map(({ href, label, icon: I, soon }) => {
        const active = isActive(path, href);
        return (
          <li key={href} className="relative">
            {active && <m.span layoutId="side-tab" transition={TAB_SPRING} aria-hidden className="side-tab absolute inset-y-0 left-0 -right-px rounded-l-[12px] bg-[var(--panel)]" />}
            <Tooltip content={soon ? `${label} · em breve` : label} disabled={!collapsed}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? (soon ? `${label}, em breve` : label) : undefined}
                className={`group relative flex h-11 items-center gap-3 overflow-hidden pl-3.5 text-[14px] outline-none ${active ? "font-semibold text-fg" : "text-[var(--sidebar-muted)] hover:text-[var(--sidebar-fg)]"}`}
              >
                {!active && <span aria-hidden className="absolute inset-y-0 right-3 left-0 rounded-[12px] transition-colors duration-150 group-hover:bg-white/8 group-focus-visible:bg-white/8" />}
                <span aria-hidden className="pointer-events-none absolute inset-y-1 right-4 left-1 rounded-[10px] group-focus-visible:ring-2 group-focus-visible:ring-[var(--sidebar-fg)]/70" />
                <I size={19} aria-hidden className={`relative shrink-0 transition-transform duration-300 ease-brand sb-closed:translate-x-[22px] ${active ? "text-accent" : ""}`} />
                <span className={`relative ${fade}`}>
                  {label}
                  {soon && <span className="ml-2 rounded-chip border border-current/40 px-1.5 py-px text-[10.5px] font-medium">Em breve</span>}
                </span>
              </Link>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveSideNav({ collapsed }: { collapsed: boolean }) {
  return <SideNav path={usePathname()} collapsed={collapsed} />;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

/** "Padrão · 3 projetos" ou "Sem plano ativo". */
function planLine(access: ReturnType<typeof useWorkspaceSession>["access"], product: Product) {
  if (!access.hasAccess || !access.tier) return "Sem plano ativo";
  if (product === "lp") return `${TIER_LABEL[access.tier]} · Landing pages`;
  const n = access.accountsQuantity;
  return `${TIER_LABEL[access.tier]} · ${n} ${n === 1 ? "projeto" : "projetos"}`;
}

/** Cartão do workspace com o próprio menu (trocar de workspace, Configurações e Sair). Recolhido, vira avatar. */
function WorkspaceMenu({ collapsed }: { collapsed: boolean }) {
  const { workspace: ws, access, memberships } = useWorkspaceSession();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const sub = switching ? "Abrindo…" : planLine(access, ws.product);
  return (
    <DropMenu>
      <Tooltip content={ws.name} disabled={!collapsed}>
        <MenuTrigger
          aria-label={`${ws.name}, ${sub}. Abrir menu da conta`}
          className="flex h-14 w-full items-center gap-2.5 overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--panel)_10%,transparent)] px-2 text-left text-[var(--sidebar-fg)] outline-none transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--panel)_16%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-fg)]/70 data-[state=open]:bg-[color-mix(in_srgb,var(--panel)_16%,transparent)]"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--sidebar-fg)] text-[13px] font-bold text-[var(--sidebar)] transition-transform duration-300 ease-brand sb-closed:translate-x-[18px]">
            {initials(ws.name)}
          </span>
          <span className={`min-w-0 flex-1 ${fade}`}>
            <span className="block truncate text-[13.5px] font-semibold">{ws.name}</span>
            <span className="block truncate text-[12px] text-[var(--sidebar-muted)]">{sub}</span>
          </span>
          <ChevronsUpDown size={15} aria-hidden className={`shrink-0 text-[var(--sidebar-muted)] ${fade}`} />
        </MenuTrigger>
      </Tooltip>
      <MenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className={collapsed ? "" : "w-[var(--radix-dropdown-menu-trigger-width)]"}>
        {memberships.length > 1 && (
          <>
            <MenuLabel>Workspaces</MenuLabel>
            {memberships.map((m) => (
              <MenuCheckItem
                key={m.id}
                checked={m.id === ws.id}
                disabled={switching}
                onSelect={() => {
                  if (m.id !== ws.id) startSwitch(() => switchWorkspace(m.id));
                }}
              >
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="ml-3 shrink-0 text-[11.5px] text-fg-2">{ROLE_LABEL[m.role]}</span>
              </MenuCheckItem>
            ))}
            <MenuSeparator />
          </>
        )}
        <MenuItem icon={<Settings size={15} />} onSelect={() => router.push("/painel/configuracoes")}>
          Configurações
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
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      aria-label="Navegação do painel"
      className="hidden h-dvh w-[260px] shrink-0 flex-col overflow-hidden py-4 pl-3 transition-[width] duration-300 ease-[cubic-bezier(0.32,1.15,0.6,1)] sb-closed:w-[104px] sb-closed:delay-100 md:flex print:hidden"
    >
      <div className="flex h-10 items-center justify-between gap-1 pr-3 pl-2">
        <Link href="/painel" aria-label="VYZ, início do painel" className="block w-[72px] shrink-0 rounded-[6px] outline-none transition-[width] duration-300 ease-brand focus-visible:ring-2 focus-visible:ring-[var(--sidebar-fg)]/70 sb-closed:w-[42px]">
          <Wordmark decorative className="text-[var(--sidebar-fg)]" />
        </Link>
        <Tooltip content={collapsed ? "Expandir menu  [" : "Recolher menu  ["} side="right">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-keyshortcuts="["
            aria-expanded={!collapsed}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--sidebar-muted)] outline-none transition-colors hover:bg-white/8 hover:text-[var(--sidebar-fg)] focus-visible:ring-2 focus-visible:ring-[var(--sidebar-fg)]/70"
          >
            <Toggle size={18} aria-hidden />
          </button>
        </Tooltip>
      </div>

      <nav aria-label="Seções" className="mt-8">
        <Suspense fallback={<SideNav path={null} collapsed={collapsed} />}>
          <ActiveSideNav collapsed={collapsed} />
        </Suspense>
      </nav>

      <div className="mt-auto pr-3">
        <WorkspaceMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

// ---- barra de baixo (celular) ------------------------------------------------

function BottomNav({ path, onMore }: { path: string | null; onMore: () => void }) {
  const nav = useNav();
  const items = nav.slice(0, 4);
  const moreActive = nav.slice(4).some((n) => isActive(path, n.href));
  const cell = (active: boolean, I: typeof Home, label: string) => (
    <>
      <span className={`inline-flex h-8 w-14 items-center justify-center rounded-chip transition-colors duration-200 ${active ? "bg-[var(--panel)] text-accent" : ""}`}>
        <I size={19} aria-hidden />
      </span>
      <span className={active ? "font-semibold text-[var(--sidebar-fg)]" : ""}>{label}</span>
    </>
  );
  return (
    <ul className="grid grid-cols-5 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      {items.map((n) => {
        const active = isActive(path, n.href);
        return (
          <li key={n.href}>
            <Link href={n.href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-0.5 text-[11px] text-[var(--sidebar-muted)] outline-none focus-visible:text-[var(--sidebar-fg)]">
              {cell(active, n.icon, n.short ?? n.label)}
            </Link>
          </li>
        );
      })}
      <li>
        <button type="button" onClick={onMore} className="flex w-full flex-col items-center gap-0.5 text-[11px] text-[var(--sidebar-muted)] outline-none focus-visible:text-[var(--sidebar-fg)]">
          {cell(moreActive, Menu, "Mais")}
        </button>
      </li>
    </ul>
  );
}

function ActiveBottomNav({ onMore }: { onMore: () => void }) {
  return <BottomNav path={usePathname()} onMore={onMore} />;
}

// ---- topo do painel ------------------------------------------------------------

/** No celular não há sidebar: a troca de workspace fica no "Mais". */
function MobileWorkspaces() {
  const { workspace: ws, memberships } = useWorkspaceSession();
  const [switching, startSwitch] = useTransition();
  if (memberships.length < 2) return null;
  return (
    <li className="border-y border-line py-1">
      <p className="px-3 pt-2 pb-1 text-[11.5px] font-medium tracking-[0.06em] text-fg-2 uppercase">Workspaces</p>
      <ul>
        {memberships.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={switching}
              aria-current={m.id === ws.id ? "true" : undefined}
              onClick={(e) => {
                if (m.id === ws.id) return;
                e.stopPropagation();
                startSwitch(() => switchWorkspace(m.id));
              }}
              className="flex w-full items-center gap-3 rounded-control px-3 py-3 text-left text-[15px] hover:bg-accent-soft disabled:opacity-50"
            >
              <span className="inline-flex w-[18px] justify-center text-accent">{m.id === ws.id && <Check size={17} aria-hidden />}</span>
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <span className="text-[12px] text-fg-2">{switching && m.id !== ws.id ? "…" : ROLE_LABEL[m.role]}</span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Plano da sessão no topo (link para Plano) e o selo do pagamento simulado. */
function PlanBadge({ simulatedBilling }: { simulatedBilling: boolean }) {
  const { access, workspace } = useWorkspaceSession();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href="/painel/plano"
        className="inline-flex min-w-0 items-center gap-1.5 rounded-chip bg-accent-soft px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-fg outline-none hover:bg-[color-mix(in_srgb,var(--accent-soft)_80%,var(--accent))] focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className={`size-1.5 shrink-0 rounded-full ${access.hasAccess ? "bg-accent" : "bg-error"}`} aria-hidden />
        <span className="truncate">{planLine(access, workspace.product)}</span>
      </Link>
      {simulatedBilling && (
        <PendingChip
          className="max-sm:hidden"
          label="Pagamento simulado"
          detail="A cobrança ainda é simulada: nenhum valor é cobrado. A cobrança real entra com a Stripe."
        />
      )}
    </div>
  );
}

const NOTICE_STYLE = {
  error: "bg-error-soft text-fg [&_svg]:text-error-fg",
  warn: "bg-[color-mix(in_srgb,var(--color-warning)_18%,var(--panel))] text-fg [&_svg]:text-[var(--color-warning)]",
  info: "bg-accent-soft text-fg [&_svg]:text-accent",
} as const;

/** Faixa do topo: pagamento em atraso, cancelamento agendado ou assinatura inativa. */
function SubscriptionBanner() {
  const { access } = useWorkspaceSession();
  const notice = subscriptionNotice(access);
  if (!notice) return null;
  const Icon = notice.tone === "info" ? Info : AlertTriangle;
  return (
    <div role={notice.tone === "info" ? "status" : "alert"} className={`border-t border-line px-4 py-2 text-[13px] sm:px-6 ${NOTICE_STYLE[notice.tone]}`}>
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

export function AppShell({ children, simulatedBilling = false, isAdmin = false }: { children: ReactNode; simulatedBilling?: boolean; isAdmin?: boolean }) {
  return (
    <AdminContext value={isAdmin}>
      <Shell simulatedBilling={simulatedBilling}>{children}</Shell>
    </AdminContext>
  );
}

/**
 * Dashboard em tela cheia: barra fina com o voltar; o próprio dashboard traz a navegação dele.
 * O modelo com visual próprio vai de ponta a ponta e traz o voltar dentro dele, nas cores dele:
 * a barra (.focus-bar) e o respiro do <main> somem pelo globals.css ([data-skin-screen]).
 */
function FocusShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell-content min-h-dvh bg-[var(--panel)] md:h-dvh md:overflow-y-auto print:block print:h-auto print:overflow-visible print:bg-white">
      <header className="focus-header sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--panel)_82%,transparent)] backdrop-blur-md print:hidden">
        <div className="focus-bar flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/painel/dashboards"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2.5 -ml-2.5 text-[13.5px] font-medium text-fg-2 outline-none transition-colors hover:bg-accent-soft hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft size={16} aria-hidden />
            Dashboards
          </Link>
          {/* as ações do dashboard (editar, compartilhar, exportar) entram aqui: FocusBarActions */}
          <div id={FOCUS_ACTIONS_ID} data-actions-slot className="flex min-w-10 flex-1 items-center justify-end" />
          <ThemeToggle className="size-9 shrink-0" />
        </div>
        <SubscriptionBanner />
      </header>
      <main id="conteudo" className="focus-main px-4 pt-6 pb-28 sm:px-6 print:p-0">
        {children}
      </main>
    </div>
  );
}

function Shell({ children, simulatedBilling }: { children: ReactNode; simulatedBilling: boolean }) {
  const [more, setMore] = useState(false);
  const nav = useNav();
  const focus = isFocusPath(usePathname());
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
            <div className="min-h-dvh bg-[var(--sidebar)] md:flex md:h-dvh md:overflow-hidden print:block print:h-auto print:bg-white">
              <Sidebar />

              <div className="shell-content min-h-dvh min-w-0 flex-1 bg-[var(--panel)] md:my-3 md:mr-3 md:h-[calc(100dvh-24px)] md:min-h-0 md:overflow-y-auto md:rounded-[24px] print:m-0 print:h-auto print:overflow-visible print:rounded-none print:bg-white">
                <header className="@container sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--panel)_82%,transparent)] backdrop-blur-md print:hidden">
                  <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
                    <Link href="/painel" aria-label="VYZ, início do painel" className="block w-14 md:hidden">
                      <Wordmark decorative />
                    </Link>
                    <PlanBadge simulatedBilling={simulatedBilling} />
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="hidden @[1100px]:block">
                        <AgentBar />
                      </div>
                      <ThemeToggle className="size-9 shrink-0" />
                    </div>
                  </div>
                  <SubscriptionBanner />
                </header>
                <main id="conteudo" className="mx-auto max-w-[1280px] px-4 pt-6 pb-36 sm:px-6 md:pb-28 print:max-w-none print:p-0">
                  {children}
                </main>
              </div>

              <nav aria-label="Seções" className="fixed inset-x-0 bottom-0 z-40 bg-[var(--sidebar)] md:hidden print:hidden">
                <Suspense fallback={<BottomNav path={null} onMore={() => setMore(true)} />}>
                  <ActiveBottomNav onMore={() => setMore(true)} />
                </Suspense>
              </nav>
              <Modal open={more} onClose={() => setMore(false)} title="Mais">
                <ul className="space-y-1" onClick={() => setMore(false)}>
                  {nav.slice(4).map(({ href, label, icon: I, soon }) => (
                    <li key={href}>
                      <Link href={href} className="flex items-center gap-3 rounded-control px-3 py-3 text-[15px] hover:bg-accent-soft">
                        <I size={18} aria-hidden /> {label}
                        {soon && <span className="rounded-chip border border-line px-1.5 py-px text-[11px] text-fg-2">Em breve</span>}
                      </Link>
                    </li>
                  ))}
                  <MobileWorkspaces />
                  <li>
                    <Link href="/" className="flex items-center gap-3 rounded-control px-3 py-3 text-[15px] text-fg-2 hover:bg-accent-soft">
                      Voltar ao site
                    </Link>
                  </li>
                  <li>
                    <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-control px-3 py-3 text-left text-[15px] text-fg-2 hover:bg-accent-soft">
                      <LogOut size={18} aria-hidden /> Sair
                    </button>
                  </li>
                </ul>
              </Modal>
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
