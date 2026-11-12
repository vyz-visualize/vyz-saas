"use client";

import { AlertTriangle, BarChart3, Check, PlugZap, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/kit";
import { UsageBar } from "@/features/accounts/AccountsPage";
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

function ConnectionRow({ c, now, timeZone, action }: { c: HomeConnection; now: string; timeZone: string; action?: React.ReactNode }) {
  const status = !c.connected
    ? { text: c.accountsCount ? "Conexão desfeita ou expirada" : "Não conectado", tone: "text-fg-2" }
    : c.syncing
      ? { text: "Sincronizando…", tone: "text-fg-2" }
      : c.syncFailed
        ? { text: "A última sincronização falhou", tone: "text-error-fg" }
        : c.lastSyncedAt
          ? { text: `Sincronizada ${relativeTime(c.lastSyncedAt, now, timeZone)}`, tone: "text-fg-2" }
          : { text: c.enabledCount ? "Aguardando a primeira sincronização" : "Escolha as contas", tone: "text-fg-2" };
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium">
          <span className={`size-2 shrink-0 rounded-full ${c.connected ? "bg-accent" : "border border-line"}`} aria-hidden />
          {c.name}
        </span>
        <span className={`flex items-center gap-1 text-[12.5px] ${status.tone}`}>
          {c.syncFailed && <AlertTriangle size={12} aria-hidden />}
          {c.syncing && <RefreshCw size={12} aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {status.text}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12.5px] text-fg-2 tnum">
        {action ?? (c.connected ? `${c.enabledCount} ${c.enabledCount === 1 ? "conta ativa" : "contas ativas"}` : "")}
      </span>
    </li>
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
      ? { label: "Compartilhar com o cliente", text: "Link só de leitura ou PDF do dashboard", href: "/painel/compartilhar", icon: Share2 }
      : { label: "Novo dashboard", text: cta.kind === "connect" ? "Com dados de exemplo até você conectar as contas" : "Meta Ads e Google Ads com os dados das suas contas", href: "/painel/dashboards/novo?novo=1", icon: BarChart3 };
  const CtaIcon = cta.kind === "connect" ? PlugZap : cta.kind === "share" ? Share2 : BarChart3;
  const name = firstName(user.fullName);
  const done = steps.filter((s) => s.done).length;

  const checklist = (
    <section aria-labelledby="h-passos" data-home-steps className="rounded-card border border-accent/50 bg-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="h-passos" className="title text-lg">
          Primeiros passos
        </h2>
        <p className="text-[13px] text-fg-2">
          <span className="tnum font-semibold text-fg">{done}</span> de {steps.length} feitos
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((c, i) => {
          const current = c.id === next?.id;
          const href = c.id === "connect" ? "/painel/contas" : c.id === "dashboard" ? "/painel/dashboards/novo?novo=1" : shareHref;
          return (
            <li key={c.id} data-step={c.id} data-done={c.done || undefined} className={`flex flex-col rounded-control border p-4 ${c.done ? "border-accent" : current ? "border-fg-2/60" : "border-line opacity-70"}`}>
              <Link href={href} className="flex gap-3 hover:text-accent">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${c.done ? "bg-accent text-on-accent" : "border border-line text-fg-2"}`}>
                  {c.done ? <Check size={15} aria-label="Feito" /> : i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="text-[13px] text-fg-2">{c.text}</span>
                </span>
              </Link>
              {/* conexões dentro do passo enquanto houver pendência (sem repetir o bloco Conexões) */}
              {c.id === "connect" && (
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {data.connections.map((con) => (
                    <ConnectionRow key={con.provider} c={con} now={data.now} timeZone={workspace.timezone} action={con.connected ? null : <a href={connectHref(con.provider)} className="text-[13px] font-semibold text-accent hover:underline">Conectar</a>} />
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
    <div className="space-y-8">
      <PageHeader eyebrow={`${workspace.name} · ${planBadge(TIER_LABEL[tier], usage.projects, access.accountsQuantity)}`} title={`${greeting(hydrated)}${name ? `, ${name}` : ""}.`} text="O número que decide o mês, para cada cliente." />

      {/* enquanto houver passo pendente, o checklist fica logo abaixo da saudação */}
      {pending && checklist}

      <div className="grid gap-4 sm:grid-cols-2">
        <a href={cta.href} data-home-cta={cta.kind} className="group flex items-center gap-4 rounded-card bg-accent p-5 text-on-accent">
          <CtaIcon size={28} aria-hidden />
          <span>
            <span className="title block text-lg">{cta.label}</span>
            <span className="text-[13.5px]">{cta.text}</span>
          </span>
        </a>
        <Link href={second.href} className="flex items-center gap-4 rounded-card border border-line bg-card p-5 hover:border-accent">
          <second.icon size={28} aria-hidden className="text-accent" />
          <span>
            <span className="title block text-lg">{second.label}</span>
            <span className="text-[13.5px] text-fg-2">{second.text}</span>
          </span>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-card border border-line bg-card p-5" aria-labelledby="h-recentes">
          <h2 id="h-recentes" className="title mb-3 text-lg">
            Recentes
          </h2>
          {data.recent.length === 0 ? (
            <p className="text-[14px] text-fg-2">Nada por aqui ainda. Comece pelo próximo passo acima.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent.map((r) => (
                <li key={`${r.kind}:${r.id}`}>
                  <Link href={r.href} className="flex items-start justify-between gap-3 py-2.5 hover:text-accent">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block truncate text-[12.5px] text-fg-2">{r.sub}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[12px] text-fg-2">{relativeTime(r.updatedAt, data.now, workspace.timezone)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-4">
          <section className="space-y-4 rounded-card border border-line bg-card p-5" aria-labelledby="h-uso">
            <h2 id="h-uso" className="title text-lg">
              Uso do plano
            </h2>
            <UsageBar used={usage.projects} limit={access.accountsQuantity} label="Projetos" />
            <UsageBar used={usage.dashboards} limit={ent.maxDashboards} label="Dashboards" />
            <Link href="/painel/plano" className="inline-block text-[13.5px] font-semibold text-accent">
              Ver limites do plano →
            </Link>
          </section>
          {!pending && (
            <section className="rounded-card border border-line bg-card p-5" aria-labelledby="h-conexoes">
              <h2 id="h-conexoes" className="title text-lg">
                Conexões
              </h2>
              <ul className="mt-1 divide-y divide-line">
                {data.connections.map((c) => (
                  <ConnectionRow key={c.provider} c={c} now={data.now} timeZone={workspace.timezone} />
                ))}
              </ul>
              <Link href="/painel/contas" className="mt-2 inline-block text-[13.5px] font-semibold text-accent">
                Abrir Contas →
              </Link>
            </section>
          )}
        </div>
      </div>

      <ConnectNudge guides={data.guides} connected={connected} onboardingDone={workspace.onboardingStep === "done"} />
      <TestReset reset={data.tools.reset} replay={data.tools.replay} />
    </div>
  );
}
