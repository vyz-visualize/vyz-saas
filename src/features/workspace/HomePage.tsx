"use client";

import { AlertTriangle, BarChart3, Check, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/kit";
import { UsageBar } from "@/features/accounts/AccountsPage";
import { relativeTime } from "@/features/integrations/sync-label";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import { useHydrated } from "@/lib/hooks";
import type { HomeConnection, HomeData } from "./dto";
import { useWorkspaceSession } from "./WorkspaceProvider";

function greeting(hydrated: boolean): string {
  if (!hydrated) return "Olá";
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

function ConnectionRow({ c, now, timeZone }: { c: HomeConnection; now: string; timeZone: string }) {
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
        {c.connected ? `${c.enabledCount} ${c.enabledCount === 1 ? "conta ativa" : "contas ativas"}` : ""}
      </span>
    </li>
  );
}

export function HomePage({ data }: { data: HomeData }) {
  const { user, workspace, access, usage } = useWorkspaceSession();
  const hydrated = useHydrated();
  const tier = access.tier ?? "base";
  const ent = access.entitlements ?? ENTITLEMENTS[tier];
  const connected = data.connections.some((c) => c.enabledCount > 0);
  const firstDashboard = data.recent.find((r) => r.kind === "dashboard");

  const checklist = [
    { done: connected, label: "Conectar as contas", text: "Conecte o Meta Ads e o Google Ads e escolha as contas.", href: "/painel/contas" },
    { done: usage.dashboards > 0, label: "Criar o primeiro dashboard", text: "Escolha um template e aponte as contas.", href: "/painel/dashboards/novo?novo=1" },
    { done: data.activeShareLinks > 0, label: "Compartilhar com o cliente", text: "Gere o link só de leitura ou exporte o PDF.", href: firstDashboard ? firstDashboard.href : "/painel/dashboards" },
  ];
  const name = firstName(user.fullName);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${workspace.name} · ${TIER_LABEL[tier]}`} title={`${greeting(hydrated)}${name ? `, ${name}` : ""}.`} text="O número que decide o mês, para cada cliente." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/painel/dashboards/novo?novo=1" className="group flex items-center gap-4 rounded-card bg-accent p-5 text-on-accent">
          <BarChart3 size={28} aria-hidden />
          <span>
            <span className="title block text-lg">Novo dashboard</span>
            <span className="text-[13.5px]">Meta Ads e Google Ads com os dados das suas contas</span>
          </span>
        </Link>
        <Link href="/painel/compartilhar" className="flex items-center gap-4 rounded-card border border-line bg-card p-5 hover:border-accent">
          <Share2 size={28} aria-hidden className="text-accent" />
          <span>
            <span className="title block text-lg">Compartilhar com o cliente</span>
            <span className="text-[13.5px] text-fg-2">Link só de leitura ou PDF do dashboard</span>
          </span>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-card border border-line bg-card p-5" aria-labelledby="h-recentes">
          <h2 id="h-recentes" className="title mb-3 text-lg">
            Recentes
          </h2>
          {data.recent.length === 0 ? (
            <p className="text-[14px] text-fg-2">Nada por aqui ainda. Comece por um dashboard.</p>
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
        </div>
      </div>

      <section aria-labelledby="h-passos" className="rounded-card border border-line bg-card p-5">
        <h2 id="h-passos" className="title mb-3 text-lg">
          Primeiros passos
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {checklist.map((c, i) => (
            <li key={c.label}>
              <Link href={c.href} className={`flex h-full gap-3 rounded-control border p-4 ${c.done ? "border-accent" : "border-line hover:border-accent"}`}>
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${c.done ? "bg-accent text-on-accent" : "border border-line text-fg-2"}`}>
                  {c.done ? <Check size={15} aria-label="Feito" /> : i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="text-[13px] text-fg-2">{c.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
