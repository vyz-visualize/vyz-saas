"use client";

// Início do painel: a saudação com o próximo passo em destaque, os números do workspace
// (o que o plano limita e o que está no ar), os primeiros passos enquanto houver pendência,
// os dashboards recentes e a situação das conexões.

import { AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, FolderKanban, PanelsTopLeft, Plug, PlugZap, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { Badge, SectionHeader } from "@/components/ui/kit";
import { TestReset } from "@/features/checkout/TestReset";
import { connectHref } from "@/features/integrations/providers";
import { relativeTime } from "@/features/integrations/sync-label";
import { ConnectNudge } from "@/features/onboarding/Nudge";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import { useHydrated } from "@/lib/hooks";
import type { HomeConnection, HomeData } from "./dto";
import { homeCta, homeSteps, nextStep, planBadge } from "./home-steps";
import { useWorkspaceSession } from "./WorkspaceProvider";

function greeting(hydrated: boolean): string {
  if (!hydrated) return "Olá";
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const cardLink = "text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline";

function connectionStatus(c: HomeConnection, now: string, timeZone: string): { text: string; tone: "ok" | "error" | "idle" | "running" } {
  if (!c.connected) return { text: c.accountsCount ? "Conexão desfeita ou expirada" : "Não conectado", tone: "idle" };
  if (c.syncing) return { text: "Sincronizando…", tone: "running" };
  if (c.syncFailed) return { text: "A última sincronização falhou", tone: "error" };
  if (c.lastSyncedAt) return { text: `Sincronizada ${relativeTime(c.lastSyncedAt, now, timeZone)}`, tone: "ok" };
  return { text: c.enabledCount ? "Aguardando a primeira sincronização" : "Escolha as contas", tone: "idle" };
}

function ConnectionRow({ c, now, timeZone, action }: { c: HomeConnection; now: string; timeZone: string; action?: ReactNode }) {
  const status = connectionStatus(c, now, timeZone);
  return (
    <li className="flex items-center gap-3 py-3">
      <PlatformIcon id={c.provider} size={36} className={c.connected ? "" : "opacity-50 grayscale"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{c.name}</span>
        <span className={`flex items-center gap-1 text-[12.5px] ${status.tone === "error" ? "text-error-fg" : "text-fg-2"}`}>
          {status.tone === "error" && <AlertTriangle size={12} aria-hidden className="shrink-0" />}
          {status.tone === "running" && <RefreshCw size={12} aria-hidden className="shrink-0 animate-spin motion-reduce:animate-none" />}
          <span className="truncate">{status.text}</span>
        </span>
      </span>
      <span className="shrink-0 text-right text-[12.5px] text-fg-2 tnum">
        {action !== undefined ? action : c.connected ? <Badge tone={c.enabledCount ? "ok" : "neutral"}>{plural(c.enabledCount, "conta ativa", "contas ativas")}</Badge> : null}
      </span>
    </li>
  );
}

/** Número do workspace, clicável: leva à tela que cuida dele. Com limite, mostra o quanto do plano já foi. */
function StatLink({ href, icon, label, value, hint, limit, tone = "normal" }: { href: string; icon: ReactNode; label: string; value: number; hint: string; limit?: number; tone?: "normal" | "error" }) {
  const ratio = limit ? Math.min(1, value / Math.max(1, limit)) : null;
  return (
    <Link href={href} className={`group rounded-card border border-line bg-card p-4 shadow-card transition-colors hover:border-fg-2/40 sm:p-5 ${ring}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-control bg-accent-soft text-accent">{icon}</span>
        <ArrowUpRight size={15} aria-hidden className="text-fg-2/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
      </span>
      <span className="mt-3 block text-[12.5px] font-medium text-fg-2">{label}</span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[26px] leading-none font-bold tracking-[-0.03em] tnum sm:text-[30px]">{value}</span>
        {limit !== undefined && <span className="text-[13px] text-fg-2 tnum">de {limit}</span>}
      </span>
      {ratio !== null ? (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${value} de ${limit}`}>
          <span className={`block h-full rounded-full ${ratio >= 1 ? "bg-error" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(3, ratio * 100)}%` }} />
        </span>
      ) : (
        <span className={`mt-2 line-clamp-2 text-[12px] leading-snug ${tone === "error" ? "text-error-fg" : "text-fg-2"}`}>{hint}</span>
      )}
      {ratio !== null && <span className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-fg-2">{hint}</span>}
    </Link>
  );
}

export function HomePage({ data }: { data: HomeData }) {
  const { user, workspace, access, usage } = useWorkspaceSession();
  const hydrated = useHydrated();
  const tier = access.tier ?? "base";
  const ent = access.entitlements ?? ENTITLEMENTS[tier];
  const connected = data.connections.filter((c) => c.enabledCount > 0).map((c) => c.provider);
  const steps = homeSteps({ connected, realDashboards: data.realDashboards, activeShareLinks: data.activeShareLinks });
  const pending = steps.some((s) => !s.done);
  const next = nextStep(steps);
  const shareHref = data.firstRealDashboardHref ?? "/painel/dashboards";
  const cta = homeCta(steps, connected, { connectHref: (p) => connectHref(p), shareHref });
  const second =
    cta.kind === "dashboard"
      ? { label: "Compartilhar com o cliente", href: "/painel/compartilhar", icon: Share2 }
      : { label: "Novo dashboard", href: "/painel/dashboards/novo?novo=1", icon: BarChart3 };
  const CtaIcon = cta.kind === "connect" ? PlugZap : cta.kind === "share" ? Share2 : BarChart3;
  const name = firstName(user.fullName);
  const done = steps.filter((s) => s.done).length;
  const failing = data.connections.filter((c) => c.connected && c.syncFailed).length;
  const platforms = data.connections.filter((c) => c.enabledCount > 0).length;

  const checklist = (
    <section aria-labelledby="h-passos" data-home-steps className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="h-passos" className="text-[17px] font-semibold tracking-[-0.015em]">
            Primeiros passos
          </h2>
          <p className="mt-0.5 text-[13.5px] text-fg-2">Três passos para o cliente ver os números dele.</p>
        </div>
        <p className="flex items-center gap-2.5 text-[13px] text-fg-2">
          <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-brand" style={{ width: `${(done / steps.length) * 100}%` }} />
          </span>
          <span>
            <span className="font-semibold text-fg tnum">{done}</span> de {steps.length}
          </span>
        </p>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((c, i) => {
          const current = c.id === next?.id;
          const href = c.id === "connect" ? "/painel/contas" : c.id === "dashboard" ? "/painel/dashboards/novo?novo=1" : shareHref;
          return (
            <li
              key={c.id}
              data-step={c.id}
              data-done={c.done || undefined}
              className={`flex flex-col rounded-[calc(var(--r-card)-4px)] border p-4 transition-colors ${c.done ? "border-line bg-surface-2/60" : current ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]" : "border-line opacity-70"}`}
            >
              <Link href={href} className={`group flex gap-3 rounded-control ${ring}`}>
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold tnum ${c.done ? "bg-accent text-on-accent" : current ? "border-[1.5px] border-accent text-accent" : "border border-line text-fg-2"}`}>
                  {c.done ? <Check size={15} aria-label="Feito" strokeWidth={2.6} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[14.5px] font-semibold group-hover:text-accent ${c.done ? "text-fg-2" : ""}`}>{c.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-fg-2">{c.text}</span>
                </span>
              </Link>
              {/* conexões dentro do passo enquanto houver pendência (sem repetir o bloco Conexões) */}
              {c.id === "connect" && (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {data.connections.map((con) => (
                    <ConnectionRow
                      key={con.provider}
                      c={con}
                      now={data.now}
                      timeZone={workspace.timezone}
                      action={
                        con.connected ? null : (
                          <a href={connectHref(con.provider)} className={cardLink}>
                            Conectar
                          </a>
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* saudação: o momento da marca na tela, com o próximo passo em destaque */}
      <section className="relative isolate overflow-hidden rounded-[calc(var(--r-card)+8px)] bg-[linear-gradient(118deg,var(--color-army)_0%,#343b18_45%,var(--color-deep)_100%)] px-5 py-7 text-offwhite sm:px-8 sm:py-9">
        <svg aria-hidden className="absolute inset-y-0 right-0 -z-10 h-full w-[60%] text-offwhite/[0.07] [mask-image:linear-gradient(to_left,black_30%,transparent)]" preserveAspectRatio="xMaxYMid slice" viewBox="0 0 480 240">
          <defs>
            <pattern id="home-mesh" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0H0V24" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="480" height="240" fill="url(#home-mesh)" />
          {/* o corte do logo, em escala */}
          <rect x="0" y="108" width="480" height="24" fill="currentColor" />
        </svg>
        <p className="truncate text-[12.5px] font-medium text-offwhite/70">
          {workspace.name} · {planBadge(TIER_LABEL[tier], usage.projects, access.accountsQuantity)}
        </p>
        <h1 className="mt-2 text-[28px] leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-[38px]">
          {greeting(hydrated)}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-offwhite/75">O número que decide o mês, para cada cliente.</p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <a
            href={cta.href}
            data-home-cta={cta.kind}
            title={cta.text}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-offwhite px-5 text-[14px] font-semibold text-deep transition-[background-color,transform] duration-200 ease-brand hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offwhite"
          >
            <CtaIcon size={17} aria-hidden /> {cta.label}
          </a>
          <Link
            href={second.href}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-offwhite/25 px-5 text-[14px] font-semibold text-offwhite transition-colors duration-200 hover:bg-offwhite/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offwhite"
          >
            <second.icon size={17} aria-hidden /> {second.label}
          </Link>
        </div>
      </section>

      <section aria-label="Números do workspace" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatLink href="/painel/projetos" icon={<FolderKanban size={16} aria-hidden />} label="Projetos" value={usage.projects} limit={access.accountsQuantity} hint="Clientes ou marcas" />
        <StatLink href="/painel/dashboards" icon={<BarChart3 size={16} aria-hidden />} label="Dashboards" value={usage.dashboards} limit={ent.maxDashboards} hint={`Limite do ${TIER_LABEL[tier]}`} />
        <StatLink
          href="/painel/contas"
          icon={<Plug size={16} aria-hidden />}
          label="Contas ativas"
          value={usage.enabledAdAccounts}
          hint={failing ? `${plural(failing, "plataforma", "plataformas")} com falha ao sincronizar` : platforms ? `Em ${plural(platforms, "plataforma", "plataformas")}` : "Nenhuma plataforma conectada"}
          tone={failing ? "error" : "normal"}
        />
        <StatLink href="/painel/compartilhar" icon={<Share2 size={16} aria-hidden />} label="Links ativos" value={data.activeShareLinks} hint={data.activeShareLinks ? "Clientes acompanhando pelo link" : "Nenhum link ainda"} />
      </section>

      {/* enquanto houver passo pendente, o checklist fica logo abaixo dos números */}
      {pending && checklist}

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 ${pending ? "" : "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"}`}>
        <section className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby="h-recentes">
          <SectionHeader
            id="h-recentes"
            title="Recentes"
            action={
              data.recent.length > 0 && (
                <Link href="/painel/dashboards" className={cardLink}>
                  Ver todos
                </Link>
              )
            }
          />
          {data.recent.length === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5">
              <p className="text-[14px] leading-relaxed text-fg-2">Nada por aqui ainda. Os dashboards que você abrir ou editar aparecem nesta lista.</p>
              <Link href="/painel/dashboards/novo?novo=1" className={`inline-flex items-center gap-1.5 ${cardLink}`}>
                Criar o primeiro dashboard <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.recent.map((r) => {
                const Icon = r.kind === "landing" ? PanelsTopLeft : BarChart3;
                return (
                  <li key={`${r.kind}:${r.id}`}>
                    <Link href={r.href} className={`group -mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition-colors hover:bg-surface-2 ${ring}`}>
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-2 transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                        <Icon size={17} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{r.title}</span>
                        <span className="block truncate text-[12.5px] text-fg-2">{r.sub}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-fg-2 tnum">{relativeTime(r.updatedAt, data.now, workspace.timezone)}</span>
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-fg-2/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg max-sm:hidden" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!pending && (
          <section className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6" aria-labelledby="h-conexoes">
            <SectionHeader
              id="h-conexoes"
              title="Conexões"
              action={
                <Link href="/painel/contas" className={cardLink}>
                  Gerenciar
                </Link>
              }
            />
            <ul className="mt-2 divide-y divide-line">
              {data.connections.map((c) => (
                <ConnectionRow key={c.provider} c={c} now={data.now} timeZone={workspace.timezone} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <ConnectNudge guides={data.guides} connected={connected} onboardingDone={workspace.onboardingStep === "done"} />
      <TestReset reset={data.tools.reset} replay={data.tools.replay} />
    </div>
  );
}
