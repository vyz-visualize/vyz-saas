"use client";

// Visão geral de um workspace: o que falta para o cliente ver os números, os números do
// workspace, os destaques da semana (dos dashboards com dados reais), os dashboards recentes,
// a saúde das contas por plataforma, a equipe e as tarefas.

import { AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Check, ListChecks, Plug, Share2, Sparkles, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { Badge, SectionHeader } from "@/components/ui/kit";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { relativeTime } from "@/features/integrations/sync-label";
import { anyDashboardTemplate } from "@/features/templates/live";
import { projectHref } from "@/features/workspace/nav";
import { ROLE_LABEL } from "@/features/workspace/session";
import { initials } from "@/features/workspace/Sidebar";
import type { ProjectHighlights, ProjectOverviewData, ProjectSummary } from "../types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const ring = "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const cardLink = "text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline";

function Tile({ href, icon, label, value, hint, tone = "normal" }: { href: string; icon: ReactNode; label: string; value: number; hint: string; tone?: "normal" | "error" }) {
  return (
    <Link href={href} className={`group rounded-card border border-line bg-card p-4 shadow-card transition-colors hover:border-fg-2/40 sm:p-5 ${ring}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-control bg-accent-soft text-accent">{icon}</span>
        <ArrowUpRight size={15} aria-hidden className="text-fg-2/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
      </span>
      <span className="mt-3 block text-[12.5px] font-medium text-fg-2">{label}</span>
      <span className="mt-1 block text-[28px] leading-none font-bold tracking-[-0.03em] tnum">{value}</span>
      <span className={`mt-2 line-clamp-2 text-[12px] leading-snug ${tone === "error" ? "text-error-fg" : "text-fg-2"}`}>{hint}</span>
    </Link>
  );
}

/** Os 3 passos para o cliente ver os números (some quando está tudo feito). */
function Setup({ summary, overview }: { summary: ProjectSummary; overview: ProjectOverviewData }) {
  const steps = [
    { id: "contas", done: summary.enabledAccounts > 0, label: "Ligar as contas do cliente", text: "Meta, Google, GA4 ou CRM: escolha nos seus logins ou conecte um novo.", href: projectHref(summary.id, "contas"), cta: "Ligar contas" },
    { id: "dashboard", done: summary.dashboards > 0, label: "Criar o primeiro dashboard", text: "Escolha o visual e o objetivo; ele já abre com os números das contas daqui.", href: `${projectHref(summary.id, "dashboards")}?novo=1`, cta: "Criar dashboard" },
    { id: "compartilhar", done: overview.activeLinks > 0 || summary.people > overview.team.filter((t) => t.role === "owner" || t.role === "admin").length, label: "Chamar o cliente ou a equipe", text: "Mande o link só de leitura do dashboard ou convide quem trabalha neste cliente.", href: projectHref(summary.id, "pessoas"), cta: "Convidar pessoa" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section aria-labelledby="h-passos-ws" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="h-passos-ws" className="text-[17px] font-semibold tracking-[-0.015em]">
            Deixe {summary.name} pronto
          </h2>
          <p className="mt-0.5 text-[13.5px] text-fg-2">Três passos para o cliente ver os números dele.</p>
        </div>
        <p className="flex items-center gap-2.5 text-[13px] text-fg-2">
          <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(done / steps.length) * 100}%` }} />
          </span>
          <span>
            <span className="font-semibold text-fg tnum">{done}</span> de {steps.length}
          </span>
        </p>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => {
          const current = s.id === next.id;
          return (
            <li key={s.id} className={`flex flex-col rounded-[calc(var(--r-card)-4px)] border p-4 ${s.done ? "border-line bg-surface-2/60" : current ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]" : "border-line"}`}>
              <span className="flex gap-3">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${s.done ? "bg-accent text-on-accent" : current ? "border-[1.5px] border-accent text-accent" : "border border-line text-fg-2"}`}>
                  {s.done ? <Check size={15} aria-label="Feito" strokeWidth={2.6} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[14.5px] font-semibold ${s.done ? "text-fg-2" : ""}`}>{s.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-fg-2">{s.text}</span>
                </span>
              </span>
              {!s.done && (
                <Link href={s.href} className={`mt-4 inline-flex items-center gap-1.5 self-start pl-10 ${cardLink}`}>
                  {s.cta} <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const money = (v: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

/** Destaques da semana (carrega à parte: lê os dashboards com dados reais). */
export function Highlights({ data, projectId }: { data: ProjectHighlights; projectId: string }) {
  return (
    <section aria-labelledby="h-destaques" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
      <SectionHeader id="h-destaques" title="Destaques da semana" text={data.spend !== null ? `Últimos 7 dias: ${money(data.spend, data.currency)} investidos · ${plural(data.conversions, "conversão", "conversões")}` : "O que o VYZ encontrou nos números deste cliente."} />
      {data.insights.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.insights.map((i) => {
            const Icon = i.tone === "good" ? TrendingUp : i.tone === "bad" ? TrendingDown : Sparkles;
            return (
              <li key={i.id}>
                <Link href={`/painel/dashboards/${i.dashboardId}${i.metric ? `?metrica=${i.metric}` : ""}`} className={`group flex h-full gap-3 rounded-[calc(var(--r-card)-4px)] border border-line p-4 transition-colors hover:border-fg-2/40 hover:bg-surface-2/40 ${ring}`}>
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${i.tone === "good" ? "bg-accent-soft text-accent" : i.tone === "bad" ? "bg-error-soft text-error-fg" : "bg-surface-2 text-fg-2"}`}>
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-snug font-semibold group-hover:text-accent">{i.title}</span>
                    <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-fg-2">{i.body}</span>
                    <span className="mt-2 block truncate text-[11.5px] text-fg-2/80">{i.dashboardName}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5 text-[14px] text-fg-2">
          {data.spend === null ? "Os destaques aparecem quando um dashboard deste workspace tiver contas com dados." : "Nada fora do normal nos últimos 7 dias."}{" "}
          <Link href={projectHref(projectId, "dashboards")} className={cardLink}>
            Ver dashboards
          </Link>
        </p>
      )}
    </section>
  );
}

export function HighlightsSkeleton() {
  return <div className="h-48 animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none" aria-busy="true" aria-label="Carregando os destaques" />;
}

export function Overview({ summary, overview, highlights }: { summary: ProjectSummary; overview: ProjectOverviewData; highlights: ReactNode }) {
  const failing = overview.platforms.reduce((n, p) => n + p.failing, 0);
  const id = summary.id;
  return (
    <div className="space-y-5 lg:space-y-6">
      <Setup summary={summary} overview={overview} />

      <section aria-label="Números do workspace" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Tile href={projectHref(id, "contas")} icon={<Plug size={16} aria-hidden />} label="Contas ativas" value={summary.enabledAccounts} hint={failing ? `${plural(failing, "conta", "contas")} com falha ao sincronizar` : summary.accounts > summary.enabledAccounts ? `${summary.accounts - summary.enabledAccounts} desligadas` : "Todas sincronizando"} tone={failing ? "error" : "normal"} />
        <Tile href={projectHref(id, "dashboards")} icon={<BarChart3 size={16} aria-hidden />} label="Dashboards" value={summary.dashboards} hint={summary.dashboards ? "Deste cliente" : "Nenhum ainda"} />
        <Tile href={projectHref(id, "pessoas")} icon={<Users size={16} aria-hidden />} label="Pessoas" value={summary.people} hint="Com acesso a este workspace" />
        <Tile href="/painel/compartilhar" icon={<Share2 size={16} aria-hidden />} label="Links ativos" value={overview.activeLinks} hint={overview.activeLinks ? "O cliente acompanhando pelo link" : "Nenhum link ainda"} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5 lg:space-y-6">
          {highlights}

          <section aria-labelledby="h-recentes-ws" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
            <SectionHeader
              id="h-recentes-ws"
              title="Dashboards"
              text="Os mais recentes deste cliente."
              action={
                <Link href={projectHref(id, "dashboards")} className={cardLink}>
                  Ver todos
                </Link>
              }
            />
            {overview.recent.length ? (
              <ul className="mt-2 divide-y divide-line">
                {overview.recent.map((d) => (
                  <li key={d.id}>
                    <Link href={`/painel/dashboards/${d.id}`} className={`group -mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition-colors hover:bg-surface-2 ${ring}`}>
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-2 group-hover:bg-accent-soft group-hover:text-accent">
                        <BarChart3 size={17} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{d.name}</span>
                        <span className="block truncate text-[12.5px] text-fg-2">{anyDashboardTemplate(d.templateId)?.name ?? "Dashboard"}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-fg-2 tnum">{relativeTime(d.updatedAt, overview.now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5">
                <p className="text-[14px] text-fg-2">Nenhum dashboard ainda. Com as contas ligadas, ele já abre com os números reais.</p>
                {summary.canEdit && (
                  <Link href={`${projectHref(id, "dashboards")}?novo=1`} className={`inline-flex items-center gap-1.5 ${cardLink}`}>
                    Criar o primeiro dashboard <ArrowRight size={15} aria-hidden />
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-5 lg:space-y-6">
          <section aria-labelledby="h-saude" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
            <SectionHeader
              id="h-saude"
              title="Contas"
              text="Por plataforma, com a última sincronização."
              action={
                <Link href={projectHref(id, "contas")} className={cardLink}>
                  Gerenciar
                </Link>
              }
            />
            {overview.platforms.length ? (
              <ul className="mt-2 divide-y divide-line">
                {overview.platforms.map((p) => (
                  <li key={p.platformId} className="flex items-center gap-3 py-3">
                    <PlatformIcon id={p.platformId} size={34} className={p.enabled ? "" : "opacity-50 grayscale"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{PLATFORMS[p.platformId as PlatformId]?.name ?? p.platformId}</span>
                      <span className={`flex items-center gap-1 text-[12.5px] ${p.failing ? "text-error-fg" : "text-fg-2"}`}>
                        {p.failing ? <AlertTriangle size={12} aria-hidden /> : null}
                        <span className="truncate">{p.failing ? `${plural(p.failing, "conta", "contas")} com falha` : p.lastSyncedAt ? `Sincronizada ${relativeTime(p.lastSyncedAt, overview.now)}` : p.enabled ? "Aguardando a primeira sincronização" : "Desligada"}</span>
                      </span>
                    </span>
                    <Badge tone={p.enabled ? "ok" : "neutral"}>
                      {p.enabled} de {p.total}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5 text-[14px] text-fg-2">
                Nenhuma conta ainda.{" "}
                <Link href={projectHref(id, "contas")} className={cardLink}>
                  Ligar contas
                </Link>
              </p>
            )}
          </section>

          <section aria-labelledby="h-equipe-ws" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
            <SectionHeader
              id="h-equipe-ws"
              title="Equipe"
              text={`${plural(overview.team.length, "pessoa acessa", "pessoas acessam")} este workspace.`}
              action={
                <Link href={projectHref(id, "pessoas")} className={cardLink}>
                  Gerenciar
                </Link>
              }
            />
            <ul className="mt-3 space-y-2.5">
              {overview.team.slice(0, 5).map((p) => (
                <li key={p.userId} className="flex items-center gap-3">
                  <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11.5px] font-bold text-accent">
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{p.name}</span>
                  <span className="shrink-0 text-[12px] text-fg-2">{ROLE_LABEL[p.role]}</span>
                </li>
              ))}
            </ul>
            {overview.team.length > 5 && <p className="mt-2 text-[12.5px] text-fg-2">e mais {overview.team.length - 5}</p>}
          </section>

          <Link href="/painel/a-fazer" className={`group flex items-center gap-3 rounded-card border border-line bg-card p-5 shadow-card transition-colors hover:border-fg-2/40 ${ring}`}>
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
              <ListChecks size={18} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold">{plural(overview.openTasks, "tarefa aberta", "tarefas abertas")}</span>
              <span className={`block text-[12.5px] ${overview.dueTasks ? "text-error-fg" : "text-fg-2"}`}>{overview.dueTasks ? `${plural(overview.dueTasks, "vence", "vencem")} hoje ou já passou` : "Neste cliente, no A Fazer"}</span>
            </span>
            <ArrowUpRight size={16} aria-hidden className="text-fg-2 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
