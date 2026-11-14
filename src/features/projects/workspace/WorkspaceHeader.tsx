"use client";

// Cabeçalho de um workspace. Na Visão geral, quem é o cliente, os números dele e o atalho para
// um dashboard novo; nas outras abas, só o caminho (Workspaces › cliente › aba), porque o
// título é da própria aba. No computador, a navegação do workspace é o menu lateral; no
// celular, as abas logo abaixo. Ao abrir, o workspace vira o "aberto" (cookie): o painel volta
// nele e o dashboard novo sem conta nasce nele.

import { BarChart3, ChevronRight, LayoutGrid, Plug, Plus, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { btn } from "@/components/ui/styles";
import { projectFromPath, projectHref, rememberProject, usePanelPath } from "@/features/workspace/nav";
import { WorkspaceAvatar } from "../WorkspaceAvatar";
import type { ProjectSummary } from "../types";

const TABS = [
  { tab: "", label: "Visão geral", icon: LayoutGrid },
  { tab: "dashboards", label: "Dashboards", icon: BarChart3 },
  { tab: "contas", label: "Contas", icon: Plug },
  { tab: "pessoas", label: "Pessoas", icon: Users },
  { tab: "ajustes", label: "Ajustes", icon: Settings2 },
] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const crumb = "rounded-[6px] outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent";

export function WorkspaceHeader({ summary, orgName }: { summary: ProjectSummary; orgName: string }) {
  const path = usePanelPath();
  const current = TABS.find((t) => t.tab === (projectFromPath(path)?.tab ?? "")) ?? TABS[0];
  const overview = current.tab === "";
  useEffect(() => rememberProject(summary.id), [summary.id]);
  const count = (tab: string) => (tab === "dashboards" ? summary.dashboards : tab === "contas" ? summary.enabledAccounts : tab === "pessoas" ? summary.people : null);

  return (
    <div className={overview ? "mb-6 lg:mb-8" : "mb-5 md:mb-4"}>
      <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1 text-[13px] text-fg-2">
        <Link href="/painel/workspaces" className={`shrink-0 ${crumb}`}>
          Workspaces
        </Link>
        <ChevronRight size={13} aria-hidden className="shrink-0 text-fg-2/60" />
        {overview ? (
          <span aria-current="page" className="truncate text-fg">
            {summary.name}
          </span>
        ) : (
          <>
            <Link href={projectHref(summary.id)} className={`flex min-w-0 items-center gap-1.5 ${crumb}`}>
              <WorkspaceAvatar name={summary.name} color={summary.color} logoUrl={summary.logoUrl} size={20} />
              <span className="truncate">{summary.name}</span>
            </Link>
            <ChevronRight size={13} aria-hidden className="shrink-0 text-fg-2/60" />
            <span aria-current="page" className="shrink-0 text-fg">
              {current.label}
            </span>
          </>
        )}
      </nav>

      {overview && (
        <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <WorkspaceAvatar name={summary.name} color={summary.color} logoUrl={summary.logoUrl} size={56} className="shadow-card" />
            <div className="min-w-0">
              <h1 className="truncate text-[24px] leading-[1.15] font-bold tracking-[-0.028em] sm:text-[30px]">{summary.name}</h1>
              <p className="mt-1 text-[13.5px] text-fg-2">
                Workspace de {orgName} · {plural(summary.enabledAccounts, "conta ativa", "contas ativas")} · {plural(summary.dashboards, "dashboard", "dashboards")} · {plural(summary.people, "pessoa", "pessoas")}
              </p>
            </div>
          </div>
          {summary.canEdit && (
            <Link href={`${projectHref(summary.id, "dashboards")}?novo=1`} className={`${btn.small} shrink-0 max-sm:w-full`}>
              <Plus size={16} aria-hidden /> Novo dashboard
            </Link>
          )}
        </header>
      )}

      {/* celular: as abas do workspace (no computador, o menu lateral faz esse papel) */}
      <div className="-mx-4 mt-4 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:hidden">
        <ul className="flex min-w-max gap-1">
          {TABS.map(({ tab, label, icon: I }) => {
            const on = current.tab === tab;
            const n = count(tab);
            return (
              <li key={tab}>
                <Link
                  href={projectHref(summary.id, tab)}
                  aria-current={on ? "page" : undefined}
                  className={`relative inline-flex h-11 items-center gap-2 rounded-t-control px-3 text-[14px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${on ? "text-fg" : "text-fg-2 hover:text-fg"}`}
                >
                  <I size={16} aria-hidden className={on ? "text-accent" : ""} />
                  {label}
                  {n !== null && <span className={`rounded-chip px-1.5 text-[11.5px] tnum ${on ? "bg-accent-soft text-fg" : "bg-surface-2 text-fg-2"}`}>{n}</span>}
                  {on && <span aria-hidden className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
