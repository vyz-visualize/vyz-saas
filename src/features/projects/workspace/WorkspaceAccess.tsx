"use client";

// Aba Acessos de um workspace: se o cliente está usando o dashboard. A situação (usando,
// esfriando, parado, nunca abriu), os números dos últimos 7 e 30 dias, cada pessoa (um link
// por pessoa), os dashboards mais vistos e a linha do tempo das visitas, com as telas vistas.
// Conta as visitas aos links só de leitura; vale em todos os planos.

import { Clock, Eye, Link2, Monitor, Smartphone, Tablet, Users } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, SectionHeader, StatTile } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { relativeTime } from "@/features/integrations/sync-label";
import { LINK_STATUS_LABEL } from "@/features/share/links";
import { projectHref } from "@/features/workspace/nav";
import { CLIENT_STATUS, DEVICE_LABEL, formatDuration, type ClientStatus, type ProjectClientActivity, type VisitDevice } from "../client-activity";
import { initials } from "../identity";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cardLink = "text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline";
const DEVICE_ICON: Record<VisitDevice, typeof Monitor> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

/** "20/11 às 14:32" no fuso do workspace. */
function dayTime(iso: string, timeZone: string) {
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
}

function StatusBadge({ status, className = "" }: { status: ClientStatus; className?: string }) {
  const s = CLIENT_STATUS[status];
  return (
    <Badge tone={s.tone} className={className} title={s.text}>
      {s.label}
    </Badge>
  );
}

function trend(now: number, before: number) {
  if (!now && !before) return "Nenhuma nos 30 dias anteriores";
  if (now === before) return "Igual aos 30 dias anteriores";
  const diff = now - before;
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff)} em relação aos 30 dias anteriores`;
}

export function WorkspaceAccess({ data, projectId, projectName }: { data: ProjectClientActivity; projectId: string; projectName: string }) {
  const tz = data.timeZone;
  const ago = (iso: string) => relativeTime(iso, data.now, tz);
  const shareCta = data.canShare && (
    <Link href={projectHref(projectId, "dashboards")} className={btn.small}>
      <Link2 size={15} aria-hidden /> Mandar link
    </Link>
  );

  const header = (
    <PageHeader
      title="Acessos do cliente"
      text={
        <>
          Quem de {projectName} abriu os dashboards, quando e por quanto tempo. Conta pelos links que você manda: com um link por pessoa, você vê quem é quem.
        </>
      }
      actions={shareCta || undefined}
    />
  );

  if (data.status === "sem_link") {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          title="Nenhum link mandado para este cliente"
          text="Abra um dashboard, use Compartilhar e escreva para quem é o link. As visitas aparecem aqui: quem abriu, quando, por quanto tempo e quais telas viu."
          action={
            <Link href={projectHref(projectId, "dashboards")} className={btn.small}>
              Ver dashboards
            </Link>
          }
        />
      </div>
    );
  }

  const status = CLIENT_STATUS[data.status];
  const lastWho = data.timeline[0]?.who;

  return (
    <div className="space-y-6 lg:space-y-7">
      {header}

      <section aria-label="Situação do cliente" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <StatusBadge status={data.status} className="px-2.5 py-1 text-[12.5px]" />
          <p className="mt-2 text-[17px] font-semibold tracking-[-0.015em]">
            {data.lastVisitAt ? (
              <>
                Última visita {ago(data.lastVisitAt)}
                {lastWho ? <span className="font-normal text-fg-2"> · {lastWho}</span> : null}
              </>
            ) : (
              "Ninguém abriu os links ainda"
            )}
          </p>
          <p className="mt-0.5 text-[13.5px] text-fg-2">{status.text}</p>
        </div>
        {(data.status === "parado" || data.status === "nunca_abriu" || data.status === "esfriando") && (
          <p className="max-w-sm rounded-control bg-surface-2 px-3.5 py-2.5 text-[13px] leading-snug text-fg-2">
            {data.status === "nunca_abriu" ? "Confira se o link chegou e mande de novo, com uma mensagem curta sobre o que olhar primeiro." : "Bom momento para mandar o link de novo com um destaque do mês ou marcar uma conversa."}
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Visitas em 7 dias" value={data.visits7} icon={<Eye size={15} aria-hidden />} />
        <StatTile label="Visitas em 30 dias" value={data.visits30} hint={trend(data.visits30, data.visitsPrev30)} icon={<Eye size={15} aria-hidden />} />
        <StatTile label="Tempo nos dashboards" value={data.seconds30 ? formatDuration(data.seconds30) : "0 min"} hint="Nos últimos 30 dias, com a tela aberta" icon={<Clock size={15} aria-hidden />} />
        <StatTile label="Pessoas que abriram" value={data.people30} hint={`Em 30 dias · ${plural(data.activeLinks, "link ativo", "links ativos")}`} icon={<Users size={15} aria-hidden />} />
      </div>

      <section aria-labelledby="h-pessoas" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
        <SectionHeader id="h-pessoas" title="Pessoas" text="Cada link é uma pessoa. Dê nome ao link quando compartilhar." />
        <ul className="mt-4 divide-y divide-line">
          {data.people.map((p) => (
            <li key={p.linkId} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${p.named ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-2"}`}>
                  {p.named ? initials(p.name) : <Link2 size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`truncate text-[14.5px] font-semibold ${p.named ? "" : "text-fg-2"}`}>{p.name}</span>
                    {p.linkState !== "active" && <Badge tone="outline">Link {LINK_STATUS_LABEL[p.linkState].toLowerCase()}</Badge>}
                  </span>
                  <span className="block truncate text-[12.5px] text-fg-2">{p.dashboardName}</span>
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-[13px] text-fg-2 sm:justify-end sm:pl-0">
                <span>{p.lastVisitAt ? `Abriu ${ago(p.lastVisitAt)}` : "Ainda não abriu"}</span>
                {p.visits30 > 0 && (
                  <span className="tnum">
                    {plural(p.visits30, "visita", "visitas")} · {formatDuration(p.seconds30)}
                  </span>
                )}
                <StatusBadge status={p.status} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6">
        <section aria-labelledby="h-linha" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
          <SectionHeader id="h-linha" title="Linha do tempo" text="As visitas mais recentes, com as telas que a pessoa viu." />
          {data.timeline.length ? (
            <ol className="mt-4 space-y-3.5">
              {data.timeline.map((v) => {
                const Icon = v.device ? DEVICE_ICON[v.device] : Monitor;
                return (
                  <li key={v.id} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-2">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-snug">
                        <span className="font-semibold">{v.who}</span> abriu <span className="font-semibold">{v.dashboardName}</span>
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-fg-2 tnum">
                        {dayTime(v.at, tz)} · {formatDuration(v.seconds)}
                        {v.device ? ` · ${DEVICE_LABEL[v.device]}` : ""}
                      </span>
                      {v.pages.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {v.pages.map((page) => (
                            <Badge key={page} tone="outline">
                              {page}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5 text-[14px] text-fg-2">As visitas aparecem aqui assim que alguém abrir um link deste cliente.</p>
          )}
        </section>

        <section aria-labelledby="h-mais-vistos" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
          <SectionHeader id="h-mais-vistos" title="Dashboards mais vistos" text="Nos últimos 30 dias." />
          <ul className="mt-4 divide-y divide-line">
            {data.dashboards.map((d) => (
              <li key={d.dashboardId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <Link href={`/painel/dashboards/${d.dashboardId}`} className="block truncate text-[14px] font-semibold hover:text-accent">
                    {d.name}
                  </Link>
                  <span className="block text-[12.5px] text-fg-2">{d.lastVisitAt ? `Última visita ${ago(d.lastVisitAt)}` : "Sem visitas"}</span>
                </span>
                <span className="shrink-0 text-right text-[13px] tnum">
                  <span className="block font-semibold">{plural(d.visits30, "visita", "visitas")}</span>
                  {d.seconds30 > 0 && <span className="block text-[12px] text-fg-2">{formatDuration(d.seconds30)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-snug text-fg-2">
            Para revogar um link ou ver todos,{" "}
            <Link href="/painel/compartilhar" className={cardLink}>
              abra Compartilhar
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
