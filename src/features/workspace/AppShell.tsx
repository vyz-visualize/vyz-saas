"use client";

// Moldura do painel. No computador: a sidebar integrada (Sidebar: moldura oliva, seletor de
// workspaces, a aba ativa que se funde no painel) e o conteúdo num painel arredondado encaixado
// nela, sem barra no topo e com a largura toda da tela. No celular: topo curto com o workspace
// aberto, barra flutuante embaixo e "Mais" numa folha que sobe (o resto do menu, a troca de
// workspace e de organização, o tema e a conta).
// A moldura marca [data-ui="app"]: é o que liga os tokens do painel (globals.css).
// O dashboard (ver, editar e montar) abre em tela cheia: sem o menu do produto, só uma barra
// fina com o botão de voltar (isFocusPath), e o conteúdo dele fica nos tokens da marca.

import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, ChevronRight, ChevronsUpDown, FolderKanban, Info, LogOut, Menu, Moon, Plug, Settings, Sun } from "lucide-react";
import { LazyMotion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState, useTransition, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Modal } from "@/components/ui/kit";
import { setTheme, ThemeToggle, useTheme } from "@/components/ui/ThemeToggle";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AgentDrawer } from "@/features/agent/AgentDrawer";
import { AgentFab } from "@/features/agent/AgentEntry";
import { AgentProvider } from "@/features/agent/AgentProvider";
import { Caption } from "@/features/agent/Caption";
import { PanelTour } from "@/features/onboarding/DashboardTour";
import { WorkspaceAvatar } from "@/features/projects/WorkspaceAvatar";
import { signOut } from "@/server/auth/actions";
import type { ActionResult } from "@/server/supabase/errors";
import { switchWorkspace } from "@/server/workspace/actions";
import { FOCUS_ACTIONS_ID, isFocusPath } from "./focus";
import { AdminContext, flat, isActive, mobilePrimary, PreviewPathContext, projectHref, rememberProject, useNavGroups, useOpenProject, usePanelPath, type NavIcon } from "./nav";
import { subscriptionNotice } from "./notice";
import { ROLE_LABEL } from "./session";
import { initials, planLine, Sidebar } from "./Sidebar";
import { useWorkspaceSession } from "./WorkspaceProvider";

// layoutId precisa das features de layout; chegam depois da primeira pintura
const loadFeatures = () => import("motion/react").then((r) => r.domMax);

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function Avatar({ name, size = "md", tone = "accent" }: { name: string; size?: "sm" | "md" | "lg"; tone?: "accent" | "soft" }) {
  const box = size === "lg" ? "size-11 rounded-[13px] text-[14px]" : size === "sm" ? "size-7 rounded-[8px] text-[11px]" : "size-9 rounded-[11px] text-[12.5px]";
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center font-bold ${box} ${tone === "accent" ? "bg-accent text-on-accent" : "bg-surface-2 text-fg-2"}`}>
      {initials(name)}
    </span>
  );
}

// ---- barra de baixo (celular) ------------------------------------------------

function BottomNav({ path, onMore }: { path: string | null; onMore: () => void }) {
  const groups = useNavGroups();
  const items = mobilePrimary(groups);
  const moreActive = flat(groups)
    .filter((i) => !items.includes(i))
    .some((n) => isActive(groups, path, n.href));
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
        <button type="button" onClick={onMore} aria-haspopup="dialog" data-tour="mais" className={cls}>
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
const ORG_LINKS = [
  { href: "/painel/workspaces", label: "Todos os workspaces", icon: FolderKanban },
  { href: "/painel/contas", label: "Conexões", icon: Plug },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
];
const sheetRow = `flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] font-medium transition-colors hover:bg-surface-2 ${ring}`;
const sheetLabel = "px-3 pt-4 pb-1 text-[11px] font-semibold tracking-[0.07em] text-fg-2 uppercase";

/** A folha "Mais" do celular: os workspaces, o resto do menu, as organizações, o tema e a conta. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useWorkspaceSession();
  const { workspace: org, memberships, user } = session;
  const projects = session.projects ?? [];
  const groups = useNavGroups();
  const primary = mobilePrimary(groups);
  const rest = flat(groups).filter((i) => !primary.includes(i));
  const current = useOpenProject();
  const dark = useTheme() === "dark";
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  return (
    <Modal open={open} onClose={onClose} title="Mais">
      <div onClick={onClose}>
        {org.product === "dash" && projects.length > 0 && (
          <section aria-label="Workspaces">
            <p className={`${sheetLabel} pt-0`}>Workspaces · {projects.length}</p>
            <ul className="max-h-56 overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-current={p.id === current?.id ? "true" : undefined}
                    onClick={() => {
                      rememberProject(p.id);
                      router.push(projectHref(p.id));
                    }}
                    className={sheetRow}
                  >
                    <WorkspaceAvatar name={p.name} color={p.color} logoUrl={p.logoUrl} size={28} fallback={p.id === current?.id ? "bg-accent text-on-accent" : "bg-surface-2 text-fg-2"} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.id === current?.id && <Check size={17} aria-hidden className="text-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* o resto do menu, nos mesmos grupos do menu lateral (o workspace aberto, Rotina, Organização) */}
        {groups.map((g) => {
          const items = g.items.filter((i) => rest.includes(i));
          if (!items.length) return null;
          return (
            <section key={g.id} aria-label={g.workspace ? `Workspace ${g.label}` : g.label}>
              <p className={`${sheetLabel} truncate`}>{g.label}</p>
              <ul>
                {items.map(({ href, label, icon: I, soon }) => (
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
            </section>
          );
        })}

        <p className={sheetLabel}>Sua organização</p>
        <Link href="/painel/plano" className={`mx-1 flex items-center gap-3 rounded-[14px] border border-line bg-card p-3 shadow-card ${ring}`}>
          <Avatar name={org.name} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{org.name}</span>
            <span className="block truncate text-[13px] text-fg-2">{planLine(session, org.product)}</span>
          </span>
          <ChevronRight size={18} aria-hidden className="shrink-0 text-fg-2" />
        </Link>
        {/* fora do menu do Dash (no computador, ficam no seletor do topo); o de LP já tem Plano e Configurações */}
        {org.product === "dash" && (
          <ul className="mt-1">
            {ORG_LINKS.map(({ href, label, icon: I }) => (
              <li key={href}>
                <Link href={href} className={sheetRow}>
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg">
                    <I size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ChevronRight size={17} aria-hidden className="shrink-0 text-fg-2" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {memberships.length > 1 && (
          <ul className="mt-1">
            {memberships
              .filter((mb) => mb.id !== org.id)
              .map((mb) => (
                <li key={mb.id}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={(e) => {
                      e.stopPropagation();
                      startSwitch(() => switchWorkspace(mb.id));
                    }}
                    className={`${sheetRow} disabled:opacity-50`}
                  >
                    <Avatar name={mb.name} size="sm" tone="soft" />
                    <span className="min-w-0 flex-1 truncate">Trocar para {mb.name}</span>
                    <span className="text-[12px] font-normal text-fg-2">{switching ? "…" : ROLE_LABEL[mb.role]}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}

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

// ---- avisos e topo do celular ---------------------------------------------------------------

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
    <div role={notice.tone === "info" ? "status" : "alert"} className={`px-4 py-2.5 text-[13px] sm:px-6 ${wide ? "" : "lg:px-8 2xl:px-10"} ${NOTICE_STYLE[notice.tone]}`}>
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

/** Topo do celular (no computador a sidebar faz esse papel): a marca e o workspace aberto, que abre o "Mais". */
function MobileTop({ onMore }: { onMore: () => void }) {
  const session = useWorkspaceSession();
  const open = useOpenProject();
  const title = session.workspace.product === "lp" || !open ? session.workspace.name : open.name;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-[var(--nav-bg)] px-4 backdrop-blur-md md:hidden print:hidden">
      <Link href="/painel" aria-label="VYZ, início do painel" className={`block w-[52px] shrink-0 rounded-[6px] ${ring}`}>
        <Wordmark decorative />
      </Link>
      <button type="button" onClick={onMore} data-tour="workspaces" className={`flex min-w-0 items-center gap-2 rounded-chip border border-line bg-card py-1 pr-2.5 pl-1 text-[13px] font-semibold shadow-card ${ring}`}>
        {open && session.workspace.product !== "lp" ? <WorkspaceAvatar name={open.name} color={open.color} logoUrl={open.logoUrl} size={28} /> : <Avatar name={title} size="sm" />}
        <span className="max-w-[46vw] truncate">{title}</span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-fg-2" />
      </button>
    </header>
  );
}

export function AppShell({
  children,
  isAdmin = false,
  previewPath = null,
  tour = false,
}: {
  children: ReactNode;
  simulatedBilling?: boolean;
  isAdmin?: boolean;
  /** Só na bancada: endereço simulado. */
  previewPath?: string | null;
  /** Tour do painel no primeiro acesso ("preview": na bancada, sem gravar). */
  tour?: boolean | "preview";
}) {
  return (
    <AdminContext value={isAdmin}>
      <PreviewPathContext value={previewPath}>
        <Shell tour={tour}>{children}</Shell>
      </PreviewPathContext>
    </AdminContext>
  );
}

/**
 * Dashboard em tela cheia: barra fina com o voltar; o próprio dashboard traz a navegação dele.
 * O modelo com visual próprio vai de ponta a ponta e traz o voltar dentro dele, nas cores dele:
 * a barra (.focus-bar) e o respiro do <main> somem pelo globals.css ([data-skin-screen]).
 * O <main> fica nos tokens da marca (.tokens-brand): o dashboard é o mesmo que o cliente vê no link.
 * O voltar leva aos dashboards do workspace aberto.
 */
export function FocusShell({ children }: { children: ReactNode }) {
  const open = useOpenProject();
  return (
    <div data-ui="app" className="shell-content min-h-dvh bg-bg md:h-dvh md:overflow-y-auto print:block print:h-auto print:overflow-visible print:bg-white">
      <header className="focus-header sticky top-0 z-30 border-b border-line bg-[var(--nav-bg)] backdrop-blur-md print:hidden">
        <div className="focus-bar flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={open ? projectHref(open.id, "dashboards") : "/painel/dashboards"}
            className={`-ml-2.5 inline-flex h-9 min-w-0 shrink items-center gap-1.5 rounded-control px-2.5 text-[13.5px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg ${ring}`}
          >
            <ArrowLeft size={16} aria-hidden className="shrink-0" />
            <span className="truncate">{open ? `Dashboards · ${open.name}` : "Dashboards"}</span>
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

// bancada: o tour roda sem gravar nada
const previewFinish = async (): Promise<ActionResult> => ({ ok: true, data: undefined });

function Shell({ children, tour }: { children: ReactNode; tour: boolean | "preview" }) {
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
            <div data-ui="app" className="min-h-dvh bg-bg md:flex md:h-dvh md:overflow-hidden md:bg-[var(--frame)] print:block print:h-auto print:bg-white">
              <a href="#conteudo" className="sr-only rounded-control bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]">
                Pular para o conteúdo
              </a>
              <Sidebar />

              {/* o painel do conteúdo, encaixado na moldura: a aba ativa da sidebar se funde nele */}
              <div className="shell-content min-h-dvh min-w-0 flex-1 bg-bg md:my-2 md:mr-2 md:h-[calc(100dvh-16px)] md:min-h-0 md:overflow-y-auto md:rounded-[20px] md:shadow-[0_0_0_1px_var(--frame-line)] print:m-0 print:h-auto print:overflow-visible print:rounded-none print:shadow-none">
                <MobileTop onMore={() => setMore(true)} />
                <SubscriptionBanner />
                <main id="conteudo" className="w-full px-4 pt-5 pb-36 sm:px-6 md:pb-16 lg:px-8 lg:pt-8 2xl:px-10 print:max-w-none print:p-0">
                  {children}
                </main>
              </div>

              <nav aria-label="Seções" data-tour="barra" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-[22px] border border-line bg-[color-mix(in_srgb,var(--card)_92%,transparent)] p-1.5 shadow-pop backdrop-blur-lg md:hidden print:hidden">
                <Suspense fallback={<BottomNav path={null} onMore={() => setMore(true)} />}>
                  <ActiveBottomNav onMore={() => setMore(true)} />
                </Suspense>
              </nav>
              <MoreSheet open={more} onClose={() => setMore(false)} />
              <AgentFab />
              <AgentDrawer />
              <Caption />
              {/* primeiro acesso: onde fica cada coisa (uma vez por pessoa) */}
              {tour && <PanelTour onFinish={tour === "preview" ? previewFinish : undefined} />}
            </div>
          </AgentProvider>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
