"use client";

// Sidebar integrada ao produto: a moldura (o oliva da marca) envolve o painel do conteúdo, e o
// item ativo é uma aba na cor do painel que se funde nele pelos cantos côncavos (.side-tab no
// globals.css); a aba desliza entre os itens (layoutId).
// No topo, o seletor de workspaces (busca quando são muitos, a aba atual vai junto na troca)
// e a organização (todos os workspaces, plano, Conexões, configurações e a troca de
// organização): o menu fica só com o dia a dia (Início, o workspace aberto e a Rotina). Recolhe para um trilho de
// ícones pelo botão do rodapé ou com "[", e o estado fica no <html data-sidebar>, aplicado
// antes da primeira pintura.

import { ArrowUpRight, Check, ChevronsUpDown, FolderKanban, Gem, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Plug, Plus, Search, Settings, Sun } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { Suspense, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Menu as DropMenu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { usePortalContainer } from "@/components/ui/portal";
import { setTheme, useTheme } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAgent } from "@/features/agent/AgentProvider";
import { Mascot } from "@/features/agent/Mascot";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import type { Product } from "@/features/pricing/pricing";
import { signOut } from "@/server/auth/actions";
import { switchWorkspace } from "@/server/workspace/actions";
import { planBadge } from "./home-steps";
import { activeHref, isOrgPage, projectFromPath, projectHref, rememberProject, useNavGroups, useOpenProject, usePanelPath, type NavGroup } from "./nav";
import { hasRole, ROLE_LABEL } from "./session";
import { useWorkspaceSession } from "./WorkspaceProvider";

const noop = () => () => {};
const TAB_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.85 } as const;

// ---- recolher (no <html>, com localStorage) ---------------------------------------------------

const SB_KEY = "vyz:sidebar";
const SB_EVENT = "vyz-sidebar";
const subscribe = (cb: () => void) => {
  window.addEventListener(SB_EVENT, cb);
  return () => window.removeEventListener(SB_EVENT, cb);
};
const readCollapsed = () => document.documentElement.getAttribute("data-sidebar") === "closed";
function setCollapsed(next: boolean) {
  document.documentElement.setAttribute("data-sidebar", next ? "closed" : "open");
  try {
    localStorage.setItem(SB_KEY, next ? "closed" : "open");
  } catch {}
  window.dispatchEvent(new Event(SB_EVENT));
}
const useCollapsed = () => useSyncExternalStore(subscribe, readCollapsed, () => false);

// ---- peças ------------------------------------------------------------------------------------

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

export function planLine(session: Pick<ReturnType<typeof useWorkspaceSession>, "access" | "usage">, product: Product) {
  const { access, usage } = session;
  if (!access.hasAccess || !access.tier) return "Sem plano ativo";
  if (product === "lp") return `${TIER_LABEL[access.tier]} · Landing pages`;
  return planBadge(TIER_LABEL[access.tier], usage.projects, access.accountsQuantity);
}

// rótulos somem antes de recolher e voltam depois de expandir, sem quebrar linha
const fade = "whitespace-nowrap transition-[opacity,transform] duration-200 delay-100 ease-brand sb-closed:pointer-events-none sb-closed:-translate-x-1 sb-closed:opacity-0 sb-closed:delay-0 sb-closed:duration-100";
const frameFocus = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--frame-fg)]/60";

function Avatar({ name, tone = "ws", size = 36 }: { name: string; tone?: "ws" | "org" | "user"; size?: number }) {
  const cls = tone === "ws" ? "bg-[var(--frame-accent)] text-[var(--frame)]" : tone === "org" ? "bg-[var(--frame-hover)] text-[var(--frame-fg)] ring-1 ring-[var(--frame-line)]" : "rounded-full bg-[var(--frame-hover)] text-[var(--frame-fg)]";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center font-bold ${tone === "user" ? "" : "rounded-[10px]"} ${cls}`} style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </span>
  );
}

// ---- seletor de workspaces (com a organização) ---------------------------------------------

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const session = useWorkspaceSession();
  const { workspace: org, memberships, role } = session;
  const projects = session.projects ?? [];
  const open = useOpenProject();
  const path = usePanelPath();
  const router = useRouter();
  const container = usePortalContainer();
  const [show, setShow] = useState(false);
  const [q, setQ] = useState("");
  const [switching, startSwitch] = useTransition();
  const lp = org.product === "lp";
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const list = projects.filter((p) => !q.trim() || fold(p.name).includes(fold(q.trim())));
  const title = lp || !open ? org.name : open.name;
  // nas páginas da organização (todos os workspaces, Conexões, Plano, Configurações), o seletor fica aceso
  const orgPage = isOrgPage(path);
  const sub = lp || !open ? planLine(session, org.product) : org.name;

  const go = (id: string) => {
    setShow(false);
    setQ("");
    rememberProject(id);
    // na troca, a pessoa continua na mesma aba (Dashboards de um vai para Dashboards do outro)
    const tab = projectFromPath(path)?.tab ?? "";
    router.push(projectHref(id, (["dashboards", "contas", "pessoas", "ajustes"].includes(tab) ? tab : "") as Parameters<typeof projectHref>[1]));
  };

  return (
    <Popover.Root open={show} onOpenChange={setShow}>
      <Tooltip content={title} disabled={!collapsed}>
        <Popover.Trigger
          data-tour="workspaces"
          aria-label={`${title}, ${sub}. Trocar de workspace`}
          className={`group flex h-[52px] w-full items-center gap-2.5 overflow-hidden rounded-[14px] px-2 text-left transition-colors duration-150 hover:bg-[var(--frame-hover)] data-[state=open]:bg-[var(--frame-hover)] ${orgPage ? "bg-[var(--frame-hover)] ring-1 ring-[var(--frame-line)]" : ""} ${frameFocus}`}
        >
          <span className="transition-transform duration-300 ease-brand">
            <Avatar name={title} tone={lp || !open ? "org" : "ws"} />
          </span>
          <span className={`min-w-0 flex-1 ${fade}`}>
            <span className="block truncate text-[13.5px] leading-tight font-semibold text-[var(--frame-fg)]">{title}</span>
            <span className="mt-0.5 block truncate text-[12px] leading-tight text-[var(--frame-muted)]">{sub}</span>
          </span>
          <ChevronsUpDown size={15} aria-hidden className={`mr-0.5 shrink-0 text-[var(--frame-muted)] ${fade}`} />
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal container={container}>
        <Popover.Content
          side={collapsed ? "right" : "bottom"}
          align="start"
          sideOffset={6}
          collisionPadding={10}
          className="pop z-[80] w-[300px] overflow-hidden rounded-card border border-line bg-card text-fg shadow-pop outline-none"
        >
          {!lp && (
            <div className="p-1.5">
              <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.07em] text-fg-2 uppercase">Workspaces · {projects.length}</p>
              {projects.length > 6 && (
                <label className="relative mb-1 block px-1">
                  <span className="sr-only">Buscar workspace</span>
                  <Search size={15} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-2" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && list[0] && go(list[0].id)}
                    placeholder="Buscar workspace…"
                    className="h-9 w-full rounded-control border border-line bg-field pr-2 pl-8 text-[13.5px] outline-none focus:border-accent"
                  />
                </label>
              )}
              <ul className="max-h-[264px] overflow-y-auto overscroll-contain" role="listbox" aria-label="Workspaces">
                {list.map((p) => {
                  const on = p.id === open?.id;
                  return (
                    <li key={p.id} role="option" aria-selected={on}>
                      <button
                        type="button"
                        onClick={() => go(p.id)}
                        className={`flex h-10 w-full items-center gap-2.5 rounded-control px-2 text-left text-[13.5px] transition-colors hover:bg-surface-2 ${on ? "font-semibold" : ""}`}
                      >
                        <span aria-hidden className={`inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold ${on ? "bg-accent text-on-accent" : "bg-surface-2 text-fg-2"}`}>
                          {initials(p.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {on && <Check size={16} aria-hidden className="shrink-0 text-accent" />}
                      </button>
                    </li>
                  );
                })}
                {!list.length && <li className="px-2 py-3 text-[13px] text-fg-2">{projects.length ? "Nenhum workspace com esse nome." : "Nenhum workspace ainda."}</li>}
              </ul>
              <div className="mt-1 grid gap-0.5 border-t border-line pt-1">
                <Link href="/painel/workspaces" onClick={() => setShow(false)} className="flex h-9 items-center gap-2.5 rounded-control px-2 text-[13.5px] text-fg-2 hover:bg-surface-2 hover:text-fg">
                  <FolderKanban size={15} aria-hidden /> Todos os workspaces
                </Link>
                {hasRole(role, "member") && (
                  <Link href="/painel/workspaces?novo=1" onClick={() => setShow(false)} className="flex h-9 items-center gap-2.5 rounded-control px-2 text-[13.5px] text-fg-2 hover:bg-surface-2 hover:text-fg">
                    <Plus size={15} aria-hidden /> Novo workspace
                  </Link>
                )}
              </div>
            </div>
          )}
          <div className={`bg-surface-2/50 p-1.5 ${lp ? "" : "border-t border-line"}`}>
            <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2">
              <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card text-[11.5px] font-bold text-fg ring-1 ring-line">
                {initials(org.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{org.name}</span>
                <span className="block truncate text-[11.5px] text-fg-2">Organização · {planLine(session, org.product)}</span>
              </span>
            </div>
            <Link href="/painel/plano" onClick={() => setShow(false)} className="flex h-9 items-center gap-2.5 rounded-control px-2 text-[13.5px] text-fg-2 hover:bg-card hover:text-fg">
              <Gem size={15} aria-hidden /> Plano e cobrança
            </Link>
            <Link href="/painel/contas" onClick={() => setShow(false)} className="flex h-9 items-center gap-2.5 rounded-control px-2 text-[13.5px] text-fg-2 hover:bg-card hover:text-fg">
              <Plug size={15} aria-hidden /> Conexões (logins e contas)
            </Link>
            <Link href="/painel/configuracoes#workspace" onClick={() => setShow(false)} className="flex h-9 items-center gap-2.5 rounded-control px-2 text-[13.5px] text-fg-2 hover:bg-card hover:text-fg">
              <Settings size={15} aria-hidden /> Configurações da organização
            </Link>
            {memberships.length > 1 && (
              <div className="mt-1 border-t border-line pt-1">
                <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-[0.07em] text-fg-2 uppercase">Trocar de organização</p>
                {memberships.map((mb) => (
                  <button
                    key={mb.id}
                    type="button"
                    disabled={switching}
                    onClick={() => mb.id !== org.id && startSwitch(() => switchWorkspace(mb.id))}
                    className="flex h-9 w-full items-center gap-2.5 rounded-control px-2 text-left text-[13.5px] hover:bg-card disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate">{mb.name}</span>
                    <span className="shrink-0 text-[11.5px] text-fg-2">{switching && mb.id !== org.id ? "…" : ROLE_LABEL[mb.role]}</span>
                    {mb.id === org.id && <Check size={15} aria-hidden className="shrink-0 text-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---- menu ---------------------------------------------------------------------------------------

function NavList({ path, collapsed }: { path: string | null; collapsed: boolean }) {
  const groups = useNavGroups();
  const href = activeHref(groups, path);
  return (
    <div className="space-y-6">
      {groups.map((g: NavGroup) => (
        <div key={g.id} data-tour={g.workspace ? "workspace-menu" : g.id === "rotina" ? "rotina" : undefined}>
          {g.items.length > 1 && (
            <>
              <p className="mb-2 truncate pr-4 pl-3 text-[11px] font-semibold tracking-[0.07em] text-[var(--frame-muted)] uppercase sb-closed:hidden" title={g.label}>
                {g.workspace ? `Workspace · ${g.label}` : g.label}
              </p>
              <span aria-hidden className="mr-3 mb-3 hidden h-px bg-[var(--frame-line)] sb-closed:mx-auto sb-closed:block sb-closed:w-6" />
            </>
          )}
          <ul className="space-y-1">
            {g.items.map(({ href: h, label, icon: I, soon }) => {
              const active = h === href;
              return (
                <li key={h} className="relative">
                  {/* a aba ativa é um pedaço do painel: vai até a borda e se funde nele pelos cantos côncavos */}
                  {active && <m.span layoutId="side-tab" transition={TAB_SPRING} aria-hidden className="side-tab absolute inset-y-0 left-0 -right-px rounded-l-[14px] bg-bg" />}
                  <Tooltip content={soon ? `${label} · em breve` : label} disabled={!collapsed}>
                    <Link
                      href={h}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? label : undefined}
                      className={`group relative flex h-11 items-center gap-3 overflow-hidden pl-3 text-[14px] outline-none ${active ? "font-semibold text-fg" : "text-[var(--frame-muted)] hover:text-[var(--frame-fg)]"}`}
                    >
                      {!active && <span aria-hidden className="absolute inset-y-0 right-3 left-0 rounded-[14px] transition-colors duration-150 group-hover:bg-[var(--frame-hover)] group-focus-visible:bg-[var(--frame-hover)]" />}
                      <span aria-hidden className="pointer-events-none absolute inset-y-1.5 right-4 left-1 rounded-[11px] group-focus-visible:ring-2 group-focus-visible:ring-[var(--frame-fg)]/60" />
                      <I size={18} aria-hidden className={`relative shrink-0 transition-transform duration-300 ease-brand sb-closed:translate-x-[5px] ${active ? "text-accent" : ""}`} />
                      <span className={`relative truncate pr-4 ${fade}`}>{label}</span>
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

function ActiveNavList({ collapsed }: { collapsed: boolean }) {
  return <NavList path={usePanelPath()} collapsed={collapsed} />;
}

/** Pergunte ao VYZ (o ⌘K continua valendo em qualquer tela). */
function AskVyz({ collapsed }: { collapsed: boolean }) {
  const { setOpen } = useAgent();
  const mac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);
  return (
    <Tooltip content="Pergunte ao VYZ" disabled={!collapsed}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="pergunte"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Pergunte ao VYZ"
        className={`flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-[12px] bg-[var(--frame-hover)] px-2.5 text-left text-[13px] text-[var(--frame-muted)] transition-colors hover:text-[var(--frame-fg)] ${frameFocus}`}
      >
        <span className="shrink-0 transition-transform duration-300 ease-brand sb-closed:translate-x-[6px]">
          <Mascot size={20} />
        </span>
        <span className={`flex-1 truncate ${fade}`}>Pergunte ao VYZ…</span>
        <kbd className={`rounded-[6px] border border-[var(--frame-line)] px-1.5 py-0.5 font-sans text-[10.5px] ${fade}`}>{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
    </Tooltip>
  );
}

function UsageCard() {
  const { access, usage, workspace } = useWorkspaceSession();
  if (workspace.product !== "dash" || !access.hasAccess || !access.tier) return null;
  const limit = Math.max(1, access.accountsQuantity);
  const ratio = Math.min(1, usage.projects / limit);
  return (
    <Link href="/painel/plano" className={`group mb-2 block rounded-[14px] bg-[var(--frame-hover)] p-3 transition-colors hover:bg-[var(--frame-hover-2)] sb-closed:hidden [@media(max-height:820px)]:hidden ${frameFocus}`}>
      <span className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="font-semibold text-[var(--frame-fg)]">Plano {TIER_LABEL[access.tier]}</span>
        <ArrowUpRight size={14} aria-hidden className="text-[var(--frame-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--frame-line)]">
        <span className={`block h-full rounded-full ${ratio >= 1 ? "bg-warning" : "bg-[var(--frame-accent)]"}`} style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
      <span className="mt-1.5 block text-[12px] text-[var(--frame-muted)] tnum">
        {usage.projects} de {access.accountsQuantity} {access.accountsQuantity === 1 ? "workspace" : "workspaces"}
      </span>
    </Link>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, role } = useWorkspaceSession();
  const router = useRouter();
  const name = user.fullName || user.email;
  return (
    <DropMenu>
      <Tooltip content={name} disabled={!collapsed}>
        <MenuTrigger
          aria-label={`${name}. Abrir menu da conta`}
          className={`flex h-12 min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-[12px] px-1.5 text-left transition-colors hover:bg-[var(--frame-hover)] data-[state=open]:bg-[var(--frame-hover)] sb-closed:w-12 sb-closed:flex-none ${frameFocus}`}
        >
          <span className="shrink-0">
            <Avatar name={name} tone="user" size={34} />
          </span>
          <span className={`min-w-0 flex-1 ${fade}`}>
            <span className="block truncate text-[13px] leading-tight font-semibold text-[var(--frame-fg)]">{name}</span>
            <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-[var(--frame-muted)]">{ROLE_LABEL[role]}</span>
          </span>
        </MenuTrigger>
      </Tooltip>
      <MenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="min-w-[15rem]">
        <div className="px-2.5 pt-1.5 pb-2">
          <p className="truncate text-[13.5px] font-semibold">{name}</p>
          <p className="truncate text-[12px] text-fg-2">{user.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem icon={<Settings size={15} />} onSelect={() => router.push("/painel/configuracoes")}>
          Minha conta
        </MenuItem>
        <MenuItem icon={<Gem size={15} />} onSelect={() => router.push("/painel/plano")}>
          Plano e cobrança
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

export function Sidebar() {
  const collapsed = useCollapsed();
  const dark = useTheme() === "dark";

  // "[" recolhe ou abre (fora de campos e de menus)
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

  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      aria-label="Navegação do painel"
      className="hidden h-dvh w-[252px] shrink-0 flex-col overflow-hidden py-3 pl-3 transition-[width] duration-300 ease-[cubic-bezier(0.32,1.15,0.6,1)] sb-closed:w-[76px] sb-closed:delay-75 md:flex print:hidden"
    >
      <div className="flex h-9 items-center px-2.5 pr-5">
        <Link href="/painel" aria-label="VYZ, início do painel" className={`block w-[58px] shrink-0 rounded-[6px] text-[var(--frame-fg)] transition-[width] duration-300 ease-brand sb-closed:w-[38px] ${frameFocus}`}>
          <Wordmark decorative className="text-[var(--frame-fg)]" />
        </Link>
      </div>

      <div className="mt-3 space-y-2 pr-3">
        <WorkspaceSwitcher collapsed={collapsed} />
        <AskVyz collapsed={collapsed} />
      </div>

      <nav aria-label="Seções" className="mt-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2 [scrollbar-width:none]">
        <Suspense fallback={<NavList path={null} collapsed={collapsed} />}>
          <ActiveNavList collapsed={collapsed} />
        </Suspense>
      </nav>

      <div data-tour="conta" className="pt-2 pr-3">
        <UsageCard />
        <div className="flex items-center gap-1 sb-closed:flex-col">
          <UserMenu collapsed={collapsed} />
          <Tooltip content={dark ? "Modo claro" : "Modo escuro"} side="right">
            <button
              type="button"
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label={dark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--frame-muted)] transition-colors hover:bg-[var(--frame-hover)] hover:text-[var(--frame-fg)] ${frameFocus}`}
            >
              {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
            </button>
          </Tooltip>
          <Tooltip content={collapsed ? "Expandir menu  [" : "Recolher menu  ["} side="right">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-keyshortcuts="["
              aria-expanded={!collapsed}
              className={`inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--frame-muted)] transition-colors hover:bg-[var(--frame-hover)] hover:text-[var(--frame-fg)] ${frameFocus}`}
            >
              <Toggle size={17} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
