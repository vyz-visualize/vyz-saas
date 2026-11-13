"use client";

// Moldura do painel. No computador: o menu lateral de vidro (GlassSidebar: trilho que abre no
// hover, alfinete para fixar), o topo com a seção aberta e o conteúdo num fundo neutro com
// cartões brancos; o conteúdo reflui junto com o menu (padding no CSS, mesma curva). No
// celular: topo curto, barra flutuante embaixo e "Mais" numa folha que sobe (o resto do menu,
// a troca de organização e a conta).
// A moldura marca [data-ui="app"]: é o que liga os tokens do painel (globals.css).
// O dashboard (ver, editar e montar) abre em tela cheia: sem o menu do produto, só uma barra
// fina com o botão de voltar (isFocusPath), e o conteúdo dele fica nos tokens da marca.

import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, ChevronRight, Info, LogOut, Menu, Moon, Sun } from "lucide-react";
import { LazyMotion, MotionConfig } from "motion/react";
import Link from "next/link";
import { Suspense, useState, useTransition, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Modal, PendingChip } from "@/components/ui/kit";
import { setTheme, ThemeToggle, useTheme } from "@/components/ui/ThemeToggle";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { AgentBar, AgentFab } from "@/features/agent/AgentEntry";
import { AgentProvider } from "@/features/agent/AgentProvider";
import { Caption } from "@/features/agent/Caption";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import type { Product } from "@/features/pricing/pricing";
import { signOut } from "@/server/auth/actions";
import { switchWorkspace } from "@/server/workspace/actions";
import { FOCUS_ACTIONS_ID, isFocusPath } from "./focus";
import { GlassSidebar } from "./GlassSidebar";
import { planBadge } from "./home-steps";
import { activeHref, AdminContext, flat, isActive, PreviewPathContext, useNavGroups, usePanelPath, type NavIcon } from "./nav";
import { subscriptionNotice } from "./notice";
import { ROLE_LABEL } from "./session";
import { useWorkspaceSession } from "./WorkspaceProvider";

// layoutId precisa das features de layout; chegam depois da primeira pintura
const loadFeatures = () => import("motion/react").then((r) => r.domMax);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

/** "Avançado · 1 de 2 workspaces" (o limite do plano, com o que já está em uso) ou "Sem plano ativo". */
function planLine(session: Pick<ReturnType<typeof useWorkspaceSession>, "access" | "usage">, product: Product) {
  const { access, usage } = session;
  if (!access.hasAccess || !access.tier) return "Sem plano ativo";
  if (product === "lp") return `${TIER_LABEL[access.tier]} · Landing pages`;
  return planBadge(TIER_LABEL[access.tier], usage.projects, access.accountsQuantity);
}

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function WorkspaceAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center bg-accent font-bold text-on-accent ${size === "lg" ? "size-11 rounded-[13px] text-[14px]" : "size-9 rounded-[11px] text-[12.5px]"}`}>
      {initials(name)}
    </span>
  );
}

// ---- barra de baixo (celular) ------------------------------------------------

function BottomNav({ path, onMore }: { path: string | null; onMore: () => void }) {
  const groups = useNavGroups();
  const all = flat(groups);
  const items = all.slice(0, 4);
  const moreActive = all.slice(4).some((n) => isActive(groups, path, n.href));
  const cell = (active: boolean, I: NavIcon, label: string) => (
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
        const active = isActive(groups, path, n.href);
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
    <section aria-label="Organizações" className="mt-4">
      <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.07em] text-fg-2 uppercase">Trocar de organização</p>
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
  const groups = useNavGroups();
  const href = activeHref(groups, path);
  const current = flat(groups).find((n) => n.href === href);
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
      <span className="hidden truncate text-fg-2 lg:inline">{workspace.name}</span>
      <ChevronRight size={14} aria-hidden className="hidden shrink-0 text-fg-2/60 lg:inline" />
      <span className="truncate font-semibold text-fg">{current?.label ?? (path?.startsWith("/painel/whatsapp") ? "Relatórios no WhatsApp" : "Painel")}</span>
    </p>
  );
}

function ActiveSectionCrumb() {
  return <SectionCrumb path={usePanelPath()} />;
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
            <div data-ui="app" className="min-h-dvh bg-bg md:h-dvh md:overflow-hidden print:block print:h-auto print:bg-white">
              <a href="#conteudo" className="sr-only rounded-control bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]">
                Pular para o conteúdo
              </a>
              <GlassSidebar />

              {/* o conteúdo reflui com o menu: 100 px recolhido, 300 px aberto (só a partir de lg; antes, o menu passa por cima) */}
              <div className="shell-content min-h-dvh min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:h-dvh md:min-h-0 md:overflow-y-auto md:pl-[100px] lg:pl-[300px] lg:sb-closed:pl-[100px] print:h-auto print:overflow-visible print:pl-0">
                <header className={`@container ${topBar}`}>
                  <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href="/painel" aria-label="VYZ, início do painel" className={`mr-1 block w-[52px] shrink-0 rounded-[6px] md:hidden ${ring}`}>
                        <Wordmark decorative />
                      </Link>
                      <span aria-hidden className="h-5 w-px shrink-0 bg-line md:hidden" />
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
