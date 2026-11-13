"use client";

// Menu lateral de vidro do painel (modelo em sidebar-modelo.md, nas cores da VYZ).
// - Flutua a 12 px das bordas, cantos de 22 px, vidro com desfoque; a cor da marca só no item ativo.
// - Trilho de 76 px (um ícone por grupo; o do grupo ativo é um disco oliva com o ícone da página)
//   e painel de 280 px (organização, busca, grupos em acordeão, plano, tema e a pessoa).
// - Nasce aberto e recolhe sozinho em 2 s; o mouse abre e fecha na hora; o alfinete fixa aberto
//   (vyz:sidebar-pin). Com um menu da sidebar aberto (portal), sair com o mouse não recolhe.
// - O estado visual fica no <html data-sidebar> (o conteúdo reflui junto pelo CSS, mesma curva).
// - Pílula do item ativo desliza (layoutId) e vai na hora do clique (ativo otimista); lupa de dock
//   nos ícones com MotionValue (sem re-render). Tudo some com "reduzir movimento".
// - Busca de páginas com "/" (o ⌘K do painel é do assistente VYZ).

import { ArrowUpRight, ChevronRight, ChevronsUpDown, Gem, LogOut, Moon, Pin, PinOff, Search, Settings, Sun } from "lucide-react";
import { AnimatePresence, LayoutGroup, m, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type RefObject } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Modal } from "@/components/ui/kit";
import { Menu as DropMenu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { setTheme, useTheme } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import type { Product } from "@/features/pricing/pricing";
import { signOut } from "@/server/auth/actions";
import { switchWorkspace } from "@/server/workspace/actions";
import { planBadge } from "./home-steps";
import { activeHref, flat, useNavGroups, usePanelPath, type NavGroup, type NavItem } from "./nav";
import { ROLE_LABEL } from "./session";
import { useWorkspaceSession } from "./WorkspaceProvider";

export const RAIL_WIDTH = 76;
export const PANEL_WIDTH = 280;
const COLLAPSE_DELAY_MS = 2000;
const LUPA_RAIO = 72;
const LUPA_MAX = 1.3;
const MOLA_PILULA = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

// ---- estado: aberto/recolhido no <html data-sidebar>; fixado no localStorage ------------------

const SB_EVENT = "vyz-sidebar";
const PIN_KEY = "vyz:sidebar-pin";

const subscribe = (cb: () => void) => {
  window.addEventListener(SB_EVENT, cb);
  return () => window.removeEventListener(SB_EVENT, cb);
};
const readCollapsed = () => document.documentElement.getAttribute("data-sidebar") === "closed";
const readPinned = () => {
  try {
    return localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
};

// cada vez que recolhe, um ciclo novo: os grupos abertos à mão fecham e, ao reabrir, abre o da página
let cycle = 0;
const readCycle = () => cycle;

function setCollapsed(next: boolean) {
  const d = document.documentElement;
  if ((d.getAttribute("data-sidebar") === "closed") === next) return;
  if (next) cycle++;
  d.setAttribute("data-sidebar", next ? "closed" : "open");
  window.dispatchEvent(new Event(SB_EVENT));
}

function setPinned(next: boolean) {
  try {
    localStorage.setItem(PIN_KEY, next ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(SB_EVENT));
}

const useCollapsed = () => useSyncExternalStore(subscribe, readCollapsed, () => false);
const usePinned = () => useSyncExternalStore(subscribe, readPinned, () => false);
const useCycle = () => useSyncExternalStore(subscribe, readCycle, () => 0);

// ---- peças ----------------------------------------------------------------------------------

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

function planLine(session: Pick<ReturnType<typeof useWorkspaceSession>, "access" | "usage">, product: Product) {
  const { access, usage } = session;
  if (!access.hasAccess || !access.tier) return "Sem plano ativo";
  if (product === "lp") return `${TIER_LABEL[access.tier]} · Landing pages`;
  return planBadge(TIER_LABEL[access.tier], usage.projects, access.accountsQuantity);
}

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

// Posição Y do cursor sobre a lista (MotionValue: nada re-renderiza no mousemove).
const CursorY = createContext<MotionValue<number> | null>(null);

function useLupa(ref: RefObject<HTMLElement | null>) {
  const cursorY = use(CursorY);
  const parado = useMotionValue(Infinity);
  const reduzido = useReducedMotion();
  const escala = useTransform(cursorY ?? parado, (y: number) => {
    const el = ref.current;
    if (reduzido || !el || !Number.isFinite(y)) return 1;
    const caixa = el.getBoundingClientRect();
    const d = Math.abs(y - (caixa.top + caixa.height / 2));
    if (d >= LUPA_RAIO) return 1;
    const t = 1 - d / LUPA_RAIO;
    return 1 + (LUPA_MAX - 1) * t * t * (3 - 2 * t);
  });
  return useSpring(escala, { stiffness: 420, damping: 28, mass: 0.5 });
}

// ---- item e grupo do painel aberto ---------------------------------------------------------

function ItemLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: (href: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const escala = useLupa(ref);
  return (
    <Link
      href={item.href}
      onClick={() => onNavigate(item.href)}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 rounded-[12px] py-1 pr-2 pl-1 text-[14px] transition-colors duration-200 ${focus} ${active ? "font-semibold text-fg" : "linha-vidro text-fg-2 hover:text-fg"}`}
    >
      {active && <m.span layoutId="nav-pilula" transition={MOLA_PILULA} aria-hidden className="pilula-ativa pointer-events-none absolute inset-0 rounded-[12px]" />}
      <m.span
        ref={ref}
        style={{ scale: escala }}
        className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${active ? "bg-accent text-on-accent shadow-[0_4px_12px_-2px_color-mix(in_srgb,var(--accent)_45%,transparent)]" : "text-fg-2/80 group-hover:text-fg"}`}
      >
        <item.icon size={16} aria-hidden />
      </m.span>
      <span className="relative z-10 truncate transition-transform duration-300 ease-out group-hover:translate-x-0.5">
        {item.label}
        {item.soon && <span className="ml-2 rounded-chip border border-line px-1.5 py-px text-[10.5px] font-medium">Em breve</span>}
      </span>
    </Link>
  );
}

function GroupSection({ group, href, current, open, onToggle, onNavigate }: { group: NavGroup; href: string | null; current: boolean; open: boolean; onToggle: () => void; onNavigate: (href: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const escala = useLupa(ref);
  // grupo de um item só (Início): vira o próprio link, sem acordeão
  if (group.items.length === 1) return <ItemLink item={group.items[0]} active={group.items[0].href === href} onNavigate={onNavigate} />;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`group linha-vidro flex w-full items-center gap-2.5 rounded-[12px] py-1 pr-2 pl-1 text-[14px] font-medium transition-colors duration-200 ${focus} ${current ? "text-fg" : "text-fg-2 hover:text-fg"}`}
      >
        <m.span
          ref={ref}
          style={{ scale: escala }}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${current ? "bg-accent-soft text-accent" : "text-fg-2/80 group-hover:text-fg"}`}
        >
          <group.icon size={17} aria-hidden />
        </m.span>
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronRight size={14} aria-hidden className={`shrink-0 text-fg-2/50 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div key="itens" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden">
            {/* folga em cima e embaixo: o ícone sob a lupa cresce 30% e não pode ser cortado */}
            <div className="mt-0.5 ml-[20px] space-y-0.5 border-l border-black/[0.08] pt-1 pb-1.5 pl-2 dark:border-white/10">
              {group.items.map((item) => (
                <ItemLink key={item.href} item={item} active={item.href === href} onNavigate={onNavigate} />
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- organização, plano e pessoa -----------------------------------------------------------

function OrgMenu({ compact, onOpenChange }: { compact: boolean; onOpenChange: (open: boolean) => void }) {
  const { workspace: ws, access, usage, memberships } = useWorkspaceSession();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const sub = switching ? "Abrindo…" : planLine({ access, usage }, ws.product);
  const avatar = (
    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent text-[12.5px] font-bold text-on-accent">
      {initials(ws.name)}
    </span>
  );
  return (
    <DropMenu onOpenChange={onOpenChange}>
      <MenuTrigger
        aria-label={`${ws.name}, ${sub}. Abrir menu da organização`}
        title={compact ? ws.name : undefined}
        className={`flex items-center gap-2.5 rounded-[14px] text-left transition-colors ${focus} ${compact ? "botao-vidro mx-auto size-11 justify-center" : "h-[52px] w-full bg-black/[0.035] px-2 hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"}`}
      >
        {avatar}
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] leading-tight font-semibold text-fg">{ws.name}</span>
              <span className="mt-0.5 block truncate text-[12px] leading-tight text-fg-2">{sub}</span>
            </span>
            <ChevronsUpDown size={15} aria-hidden className="mr-1 shrink-0 text-fg-2" />
          </>
        )}
      </MenuTrigger>
      <MenuContent side={compact ? "right" : "bottom"} align="start" className="min-w-[15rem]">
        {memberships.length > 1 && (
          <>
            <MenuLabel>Organizações</MenuLabel>
            {memberships.map((mb) => (
              <MenuCheckItem key={mb.id} checked={mb.id === ws.id} disabled={switching} onSelect={() => mb.id !== ws.id && startSwitch(() => switchWorkspace(mb.id))}>
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
        <MenuItem icon={<Settings size={15} />} onSelect={() => router.push("/painel/configuracoes#workspace")}>
          Configurações da organização
        </MenuItem>
      </MenuContent>
    </DropMenu>
  );
}

function UsageCard() {
  const { access, usage, workspace } = useWorkspaceSession();
  if (workspace.product !== "dash" || !access.hasAccess || !access.tier) return null;
  const limit = Math.max(1, access.accountsQuantity);
  const ratio = Math.min(1, usage.projects / limit);
  return (
    <Link href="/painel/plano" className={`group mb-2 block rounded-[14px] bg-black/[0.035] p-3 transition-colors hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.08] [@media(max-height:760px)]:hidden ${focus}`}>
      <span className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="font-semibold text-fg">Plano {TIER_LABEL[access.tier]}</span>
        <ArrowUpRight size={14} aria-hidden className="text-fg-2 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10">
        <span className={`block h-full rounded-full ${ratio >= 1 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
      <span className="mt-1.5 block text-[12px] text-fg-2 tnum">
        {usage.projects} de {access.accountsQuantity} {access.accountsQuantity === 1 ? "workspace" : "workspaces"}
      </span>
    </Link>
  );
}

function UserMenu({ compact, onOpenChange }: { compact: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, role } = useWorkspaceSession();
  const router = useRouter();
  const name = user.fullName || user.email;
  return (
    <DropMenu onOpenChange={onOpenChange}>
      <MenuTrigger
        aria-label={`${name}. Abrir menu da conta`}
        title={compact ? name : undefined}
        className={`flex items-center gap-2.5 rounded-[12px] text-left transition-colors ${focus} ${compact ? "botao-vidro size-11 justify-center" : "h-12 min-w-0 flex-1 px-1.5 linha-vidro"}`}
      >
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent">
          {initials(name)}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-tight font-semibold text-fg">{name}</span>
            <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-fg-2">{ROLE_LABEL[role]}</span>
          </span>
        )}
      </MenuTrigger>
      <MenuContent side={compact ? "right" : "top"} align={compact ? "end" : "start"} className="min-w-[15rem]">
        <div className="px-2.5 pt-1.5 pb-2">
          <p className="truncate text-[13.5px] font-semibold">{name}</p>
          <p className="truncate text-[12px] text-fg-2">{user.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem icon={<Settings size={15} />} onSelect={() => router.push("/painel/configuracoes")}>
          Minha conta
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

// ---- busca de páginas ("/") -----------------------------------------------------------------

function PageSearch({ groups, open, onClose }: { groups: NavGroup[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const items = flat(groups)
    .map((it) => ({ ...it, group: groups.find((g) => g.items.includes(it))?.label ?? "" }))
    .filter((it) => !q.trim() || fold(`${it.label} ${it.group}`).includes(fold(q.trim())));
  const go = (href: string) => {
    onClose();
    setQ("");
    router.push(href);
  };
  return (
    <Modal open={open} onClose={onClose} title="Ir para">
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Buscar página</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((n) => Math.min(items.length - 1, n + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((n) => Math.max(0, n - 1));
              } else if (e.key === "Enter" && items[i]) {
                e.preventDefault();
                go(items[i].href);
              }
            }}
            placeholder="Buscar página…"
            className="h-11 w-full rounded-control border border-line bg-field pr-3 pl-9 text-[15px] outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>
        <ul role="listbox" aria-label="Páginas" className="max-h-80 space-y-0.5 overflow-y-auto">
          {items.map((it, n) => (
            <li key={it.href} role="option" aria-selected={n === i}>
              <button type="button" onMouseEnter={() => setI(n)} onClick={() => go(it.href)} className={`flex h-11 w-full items-center gap-3 rounded-control px-3 text-left text-[14px] ${n === i ? "bg-surface-2" : ""}`}>
                <it.icon size={16} aria-hidden className="shrink-0 text-fg-2" />
                <span className="flex-1">{it.label}</span>
                <span className="text-[11px] font-medium tracking-[0.08em] text-fg-2/70 uppercase">{it.group}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-[14px] text-fg-2">Nenhuma página encontrada.</li>}
        </ul>
      </div>
    </Modal>
  );
}

// ---- a sidebar --------------------------------------------------------------------------------

export function GlassSidebar() {
  const router = useRouter();
  const groups = useNavGroups();
  const path = usePanelPath();
  const collapsed = useCollapsed();
  const pinned = usePinned();
  const dark = useTheme() === "dark";
  const aside = useRef<HTMLElement>(null);
  const cursorY = useMotionValue(Infinity);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layer, setLayer] = useState(false);
  const [searching, setSearching] = useState(false);
  const sbCycle = useCycle();
  const [choice, setChoice] = useState<{ group: string | null; cycle: number } | null>(null);

  // ativo otimista: a pílula vai na hora do clique; a rota confirma depois (vale só enquanto o
  // endereço não muda; 4 s se a navegação for cancelada)
  const [pend, setPend] = useState<{ href: string; from: string | null } | null>(null);
  useEffect(() => {
    if (!pend) return;
    const t = setTimeout(() => setPend(null), 4000);
    return () => clearTimeout(t);
  }, [pend]);
  const pending = pend && pend.from === path ? pend.href : null;
  const setPending = (h: string) => setPend({ href: h, from: path });
  const href = pending ?? activeHref(groups, path);
  const currentItem = useMemo(() => flat(groups).find((i) => i.href === href) ?? null, [groups, href]);
  const currentGroup = useMemo(() => groups.find((g) => g.items.some((i) => i.href === href))?.id ?? null, [groups, href]);

  // recolhimento: nasce aberta, recolhe em 2 s; fixada, nunca
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    clear();
    if (pinned) {
      setCollapsed(false);
      return;
    }
    if (!aside.current?.matches(":hover")) timer.current = setTimeout(() => setCollapsed(true), COLLAPSE_DELAY_MS);
    return clear;
  }, [pinned, clear]);

  // atalhos: "/" busca; "[" fixa ou solta (fora de campos)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("[role=dialog],[role=menu],[role=listbox]"))) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === "[") {
        e.preventDefault();
        setPinned(!readPinned());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // grupo aberto: o escolhido neste ciclo ou, sem escolha, o da página
  const openGroup = collapsed ? null : choice && choice.cycle === sbCycle ? choice.group : currentGroup;
  const setOpenGroup = (g: string | null) => setChoice({ group: g, cycle: sbCycle });

  const enter = () => {
    clear();
    setCollapsed(false);
  };
  const leave = () => {
    clear();
    cursorY.set(Infinity);
    if (pinned || layer) return;
    setCollapsed(true);
  };
  // menu portalado (organização, pessoa) fechou: recolhe só se o cursor já saiu da sidebar
  const onLayer = (open: boolean) => {
    setLayer(open);
    if (open || pinned) return;
    if (!aside.current?.matches(":hover")) setCollapsed(true);
  };

  return (
    <CursorY value={cursorY}>
      <aside
        ref={aside}
        aria-label="Navegação do painel"
        onMouseEnter={enter}
        onMouseLeave={leave}
        className="vidro-trilho fixed top-3 left-3 z-40 hidden h-[calc(100dvh-24px)] w-[280px] overflow-hidden rounded-[22px] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sb-closed:w-[76px] md:block print:hidden"
      >
        <LayoutGroup id="sidebar-desktop">
          <div className="flex h-full w-[280px] flex-col sb-closed:w-[76px]">
            {/* marca e alfinete */}
            <div className={`flex h-16 shrink-0 items-center ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
              <Link href="/painel" aria-label="VYZ, início do painel" className={`block shrink-0 rounded-[6px] ${focus} ${collapsed ? "w-[38px]" : "w-[64px]"}`}>
                <Wordmark decorative />
              </Link>
              {!collapsed && (
                <Tooltip content={pinned ? "Soltar (volta a recolher sozinha)  [" : "Fixar aberta  ["} side="bottom">
                  <button
                    type="button"
                    onClick={() => setPinned(!pinned)}
                    aria-pressed={pinned}
                    aria-label={pinned ? "Soltar a sidebar" : "Fixar a sidebar aberta"}
                    className={`flex size-8 items-center justify-center rounded-[10px] transition-colors duration-200 ${focus} ${pinned ? "bg-accent-soft text-accent" : "botao-vidro text-fg-2 hover:text-fg"}`}
                  >
                    {pinned ? <Pin size={16} aria-hidden /> : <PinOff size={16} aria-hidden />}
                  </button>
                </Tooltip>
              )}
            </div>

            {/* organização e busca */}
            <div className={`shrink-0 space-y-2 pb-2 ${collapsed ? "px-2" : "px-3"}`}>
              <OrgMenu compact={collapsed} onOpenChange={onLayer} />
              <button
                type="button"
                onClick={() => setSearching(true)}
                aria-label="Buscar página"
                aria-keyshortcuts="/"
                title={collapsed ? "Buscar página ( / )" : undefined}
                className={`flex items-center rounded-[12px] bg-black/[0.04] text-[13.5px] text-fg-2 transition-colors hover:bg-black/[0.07] hover:text-fg dark:bg-white/[0.06] dark:hover:bg-white/[0.1] ${focus} ${collapsed ? "mx-auto size-11 justify-center" : "h-9 w-full gap-2 px-2.5"}`}
              >
                <Search size={16} aria-hidden className="shrink-0" />
                {!collapsed && (
                  <>
                    <span>Buscar</span>
                    <kbd className="ml-auto rounded-[6px] border border-line bg-card/70 px-1.5 py-0.5 font-sans text-[10.5px] font-medium">/</kbd>
                  </>
                )}
              </button>
            </div>

            {/* navegação */}
            <nav
              aria-label="Seções"
              onMouseMove={(e) => cursorY.set(e.clientY)}
              onMouseLeave={() => cursorY.set(Infinity)}
              className={`min-h-0 flex-1 py-1 [scrollbar-width:none] ${collapsed ? "overflow-visible px-2" : "overflow-x-hidden overflow-y-auto px-3"}`}
            >
              {collapsed ? (
                <div className="flex flex-col items-center gap-1.5">
                  {groups.map((g) => {
                    const active = g.id === currentGroup;
                    const Icon = active && currentItem ? currentItem.icon : g.icon;
                    const label = active && currentItem ? currentItem.label : g.label;
                    return (
                      <m.button
                        key={g.id}
                        type="button"
                        whileHover={{ scale: 1.14 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 520, damping: 30 }}
                        aria-label={label}
                        title={label}
                        onClick={() => {
                          // grupo de uma página só (Início): vai direto
                          if (g.items.length === 1) {
                            setPending(g.items[0].href);
                            router.push(g.items[0].href);
                            return;
                          }
                          setCollapsed(false);
                          setOpenGroup(g.id);
                        }}
                        className={`relative flex size-11 items-center justify-center rounded-full transition-colors duration-300 ${focus} ${active ? "text-on-accent" : "botao-vidro text-fg-2 hover:text-fg"}`}
                      >
                        {active && <m.span layoutId="trilho-disco" transition={MOLA_PILULA} aria-hidden className="absolute inset-0 rounded-full bg-accent shadow-[0_6px_16px_-4px_color-mix(in_srgb,var(--accent)_50%,transparent)]" />}
                        <Icon size={19} aria-hidden className="relative z-10" />
                      </m.button>
                    );
                  })}
                </div>
              ) : (
                <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} className="space-y-1">
                  {groups.map((g) => (
                    <GroupSection
                      key={g.id}
                      group={g}
                      href={href}
                      current={g.id === currentGroup}
                      open={openGroup === g.id}
                      onToggle={() => setOpenGroup(openGroup === g.id ? null : g.id)}
                      onNavigate={setPending}
                    />
                  ))}
                </m.div>
              )}
              <div className="h-3" />
            </nav>

            {/* rodapé: plano, tema e a pessoa */}
            <div className={`shrink-0 pt-2 pb-3 ${collapsed ? "px-2" : "px-3"}`}>
              {!collapsed && (
                <>
                  <UsageCard />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dark}
                    onClick={() => setTheme(dark ? "light" : "dark")}
                    className={`linha-vidro mb-1 flex h-10 w-full items-center gap-2.5 rounded-[12px] px-2 text-[13.5px] text-fg-2 ${focus}`}
                  >
                    {dark ? <Sun size={16} aria-hidden className="shrink-0" /> : <Moon size={16} aria-hidden className="shrink-0" />}
                    <span className="flex-1 text-left">Modo escuro</span>
                    <span aria-hidden className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${dark ? "bg-accent" : "bg-black/[0.14]"}`}>
                      <span className={`block size-4 rounded-full bg-white shadow transition-transform duration-200 ease-brand ${dark ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                </>
              )}
              <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
                <UserMenu compact={collapsed} onOpenChange={onLayer} />
                {collapsed && (
                  <button
                    type="button"
                    onClick={() => setTheme(dark ? "light" : "dark")}
                    aria-label={dark ? "Modo claro" : "Modo escuro"}
                    title={dark ? "Modo claro" : "Modo escuro"}
                    className={`botao-vidro flex size-10 items-center justify-center rounded-[12px] text-fg-2 hover:text-fg ${focus}`}
                  >
                    {dark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </LayoutGroup>
      </aside>
      <PageSearch groups={groups} open={searching} onClose={() => setSearching(false)} />
    </CursorY>
  );
}
