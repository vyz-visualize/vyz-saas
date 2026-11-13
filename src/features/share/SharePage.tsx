"use client";

// Central de compartilhamento: o resumo do que saiu dos dashboards (links ativos, visitas,
// relatórios e PDFs) e três abas: Links, Relatórios agendados e Histórico (envios e
// exportações). Cada lista tem colunas alinhadas no computador e vira cartões no celular,
// sem rolagem de lado. Os dados vêm do servidor (getShareCenter); revogar, pausar e apagar
// passam por Server Actions.

import { ArrowRight, CalendarClock, Eye, FileDown, Link2, Mail, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Badge, EmptyState, PageHeader, PendingChip, SectionHeader, StatTile, Tabs, type BadgeTone } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { int } from "@/lib/format";
import { deleteScheduledReport, revokeShareLink, setReportActive } from "@/server/share/actions";
import { dateIn, LINK_STATUS_LABEL, linkStatus, type LinkStatus } from "./links";
import { FORMAT_LABEL, scheduleLabel } from "./schedule";
import type { ShareCenter } from "./types";

// Colunas de cada lista no computador (a primeira é sempre o dashboard). Classes inteiras: o Tailwind lê o texto.
const COLS = {
  links: "@3xl:grid-cols-[minmax(0,1fr)_6.5rem_9.5rem_7.5rem_5.5rem]",
  reports: "@3xl:grid-cols-[minmax(0,1fr)_10rem_10.5rem_7rem_9.5rem]",
  deliveries: "@3xl:grid-cols-[minmax(0,1fr)_13.5rem_6.5rem_6.5rem]",
  exports: "@3xl:grid-cols-[minmax(0,1fr)_11rem_6.5rem]",
} as const;

/** Lista com colunas alinhadas no computador (cabeçalho de coluna em cima) e um cartão por linha no celular. */
function DataList({ label, cols, head, children }: { label: string; cols: string; head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      <div aria-hidden className={`hidden gap-4 border-b border-line px-5 py-2.5 text-[12px] font-medium text-fg-2 @3xl:grid ${cols}`}>
        {head.map((h, i) => (
          <span key={h || i} className="truncate">
            {h}
          </span>
        ))}
      </div>
      <ul aria-label={label} className="divide-y divide-line">
        {children}
      </ul>
    </div>
  );
}

/** Uma linha: a primeira célula é o dashboard; as outras vão em duas colunas no celular e viram colunas da grade no computador. */
function Row({ cols, main, children, muted = false }: { cols: string; main: ReactNode; children: ReactNode; muted?: boolean }) {
  return (
    <li className={`px-4 py-4 sm:px-5 @3xl:grid @3xl:items-center @3xl:gap-4 @3xl:py-3.5 ${cols} ${muted ? "text-fg-2" : ""}`}>
      {main}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 @3xl:contents">{children}</div>
    </li>
  );
}

/** Célula com o rótulo da coluna em cima no celular (no computador o rótulo está no cabeçalho). */
function Cell({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2 @3xl:col-span-1" : ""}`}>
      <p className="text-[11.5px] leading-snug text-fg-2 @3xl:hidden">{label}</p>
      <div className="text-[13.5px] leading-snug tnum">{children}</div>
    </div>
  );
}

/** Primeira célula: ícone, nome do dashboard e uma linha de apoio. */
function Main({ icon, title, sub }: { icon: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-2">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[14px] leading-snug font-semibold break-words @3xl:line-clamp-1">{title}</p>
        {sub && <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-snug text-fg-2">{sub}</p>}
      </div>
    </div>
  );
}

const subLine = "block text-[11.5px] leading-snug text-fg-2";
const small =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-line bg-card px-3 text-[13px] font-medium outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 max-sm:h-10";
const smallIcon = `${small} w-9 px-0 text-fg-2 hover:border-error hover:text-error-fg max-sm:w-10`;
// ir aos dashboards é navegação, não a ação da tela: contorno, sem disputar com o conteúdo
const outline = btn.secondary.replace("h-12 px-6", "h-9 px-3.5 text-[13.5px] bg-card");
const emptyBox = "rounded-card border border-dashed border-line px-5 py-8 text-center text-[14px] leading-relaxed text-fg-2";
const nameLink = "rounded-[4px] outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent";

const LINK_TONE: Record<LinkStatus, BadgeTone> = { active: "ok", expired: "warn", revoked: "error" };

type Tab = "links" | "relatorios" | "historico";

type Props = {
  center: ShareCenter;
  /** Hora do servidor (situação dos links igual no servidor e no navegador). */
  now: string;
  /** Fuso do workspace para as datas. */
  timeZone: string;
  canEdit: boolean;
};

export function SharePage({ center, now, timeZone, canEdit }: Props) {
  const date = (iso: string | null, empty = "Nunca") => (iso ? dateIn(iso, timeZone) : empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("links");
  const [, start] = useTransition();
  const at = new Date(now);

  function run(id: string, task: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null);
    setBusy(id);
    start(async () => {
      const r = await task();
      if (!r.ok) setError(r.error?.message ?? "Algo deu errado. Tente de novo.");
      setBusy(null);
    });
  }

  // resumo do topo: só conta o que já está na tela
  const activeLinks = center.links.filter((l) => linkStatus(l, at) === "active").length;
  const views = center.links.reduce((n, l) => n + l.viewCount, 0);
  const lastView = center.links.reduce<string | null>((latest, l) => (l.lastViewedAt && (!latest || l.lastViewedAt > latest) ? l.lastViewedAt : latest), null);
  const activeReports = center.reports.filter((r) => r.isActive);
  const pausedReports = center.reports.length - activeReports.length;
  const nextRun = activeReports.reduce<string | null>((first, r) => (r.nextRunAt && (!first || r.nextRunAt < first) ? r.nextRunAt : first), null);
  const lastExport = center.exports.reduce<string | null>((latest, x) => (!latest || x.createdAt > latest ? x.createdAt : latest), null);
  const hasAnything = center.links.length + center.reports.length + center.deliveries.length + center.exports.length > 0;

  return (
    <div className="@container space-y-6 lg:space-y-8">
      <PageHeader
        title="Links, relatórios e exportações"
        text="Tudo o que saiu dos seus dashboards para os clientes."
        actions={
          hasAnything && (
            <Link href="/painel/dashboards" className={outline}>
              Ver dashboards <ArrowRight size={15} aria-hidden />
            </Link>
          )
        }
      />
      {error && (
        <p role="alert" className="rounded-control border border-error/40 bg-error-soft px-3 py-2.5 text-[13.5px] text-error-fg">
          {error}
        </p>
      )}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:gap-4 @4xl:grid-cols-4">
        <StatTile label="Links ativos" value={int(activeLinks)} hint={center.links.length ? `de ${int(center.links.length)} ${center.links.length === 1 ? "gerado" : "gerados"}` : "Nenhum link gerado"} icon={<Link2 size={15} aria-hidden />} />
        <StatTile label="Visitas nos links" value={int(views)} hint={lastView ? `Última em ${date(lastView)}` : "Nenhuma visita ainda"} icon={<Eye size={15} aria-hidden />} />
        <StatTile
          label="Relatórios ativos"
          value={int(activeReports.length)}
          hint={nextRun ? `Próximo em ${date(nextRun)}` : pausedReports ? `${int(pausedReports)} ${pausedReports === 1 ? "pausado" : "pausados"}` : "Nenhum agendamento ativo"}
          icon={<CalendarClock size={15} aria-hidden />}
        />
        <StatTile label="PDFs exportados" value={int(center.exports.length)} hint={lastExport ? `Último em ${date(lastExport)}` : "Nenhum PDF ainda"} icon={<FileDown size={15} aria-hidden />} />
      </section>

      <Tabs<Tab>
        label="O que saiu dos dashboards"
        value={tab}
        onChange={setTab}
        items={[
          { value: "links", label: center.links.length ? `Links · ${center.links.length}` : "Links" },
          { value: "relatorios", label: center.reports.length ? `Relatórios · ${center.reports.length}` : "Relatórios" },
          { value: "historico", label: "Histórico" },
        ]}
      />

      {tab === "links" && (
        <section className="space-y-3.5" aria-labelledby="h-links">
          <SectionHeader id="h-links" title="Links" text="Só leitura. O link completo aparece uma vez, ao gerar; aqui fica o final dele para você reconhecer." />
          {center.links.length === 0 ? (
            <EmptyState
              title="Nenhum link ainda"
              text="Abra um dashboard e use Compartilhar para gerar um link só de leitura."
              action={
                <Link href="/painel/dashboards" className={btn.small}>
                  Ver dashboards
                </Link>
              }
            />
          ) : (
            <DataList label="Links compartilhados" cols={COLS.links} head={["Dashboard", "Expira", "Visitas", "Situação", ""]}>
              {center.links.map((l) => {
                const status = linkStatus(l, at);
                return (
                  <Row
                    key={l.id}
                    cols={COLS.links}
                    main={
                      <Main
                        icon={<Link2 size={16} />}
                        title={
                          <Link href={`/painel/dashboards/${l.dashboardId}`} className={nameLink} title={l.dashboardName}>
                            {l.dashboardName}
                          </Link>
                        }
                        sub={
                          <>
                            <span className="tnum">
                              …{l.tokenHint} · criado em {date(l.createdAt)}
                            </span>
                            {l.hideSpend && <Badge tone="outline">sem investimento</Badge>}
                          </>
                        }
                      />
                    }
                  >
                    <Cell label="Expira">{date(l.expiresAt)}</Cell>
                    <Cell label="Visitas">
                      {int(l.viewCount)}
                      {l.lastViewedAt && <span className={subLine}>última em {date(l.lastViewedAt)}</span>}
                    </Cell>
                    <Cell label="Situação">
                      <Badge tone={LINK_TONE[status]}>{LINK_STATUS_LABEL[status]}</Badge>
                      {l.revokedAt && <span className={`${subLine} mt-0.5`}>em {date(l.revokedAt)}</span>}
                    </Cell>
                    {status === "active" && l.canRevoke && (
                      <div className="flex items-end justify-end">
                        <button type="button" disabled={busy === l.id} className={`${small} hover:border-error hover:text-error-fg`} aria-label={`Revogar o link de ${l.dashboardName}`} onClick={() => run(l.id, () => revokeShareLink(l.id))}>
                          {busy === l.id ? "Revogando…" : "Revogar"}
                        </button>
                      </div>
                    )}
                  </Row>
                );
              })}
            </DataList>
          )}
        </section>
      )}

      {tab === "relatorios" && (
        <section className="space-y-3.5" aria-labelledby="h-rel">
          <SectionHeader
            id="h-rel"
            title="Relatórios agendados"
            text="O envio periódico de um dashboard, por e-mail ou WhatsApp."
            action={<PendingChip label="Envio automático pendente" detail="Os agendamentos ficam gravados. O envio por e-mail e WhatsApp entra quando o serviço de envio estiver ligado." />}
          />
          {center.reports.length === 0 ? (
            <p className={emptyBox}>Nenhum relatório agendado. Use “Agendar relatório” num dashboard.</p>
          ) : (
            <DataList label="Relatórios agendados" cols={COLS.reports} head={["Dashboard", "Quando", "Formato", "Próximo envio", ""]}>
              {center.reports.map((r) => (
                <Row
                  key={r.id}
                  cols={COLS.reports}
                  muted={!r.isActive}
                  main={
                    <Main
                      icon={<CalendarClock size={16} />}
                      title={r.dashboardName}
                      sub={
                        <span className="line-clamp-2 break-all" title={r.recipients.join(", ")}>
                          {r.recipients.join(", ")}
                        </span>
                      }
                    />
                  }
                >
                  <Cell label="Quando">
                    {scheduleLabel(r)}
                    {!r.isActive && (
                      <span className="mt-0.5 block">
                        <Badge>pausado</Badge>
                      </span>
                    )}
                  </Cell>
                  <Cell label="Formato">{FORMAT_LABEL[r.format]}</Cell>
                  <Cell label="Próximo envio">{r.isActive ? date(r.nextRunAt, "—") : "—"}</Cell>
                  {canEdit && (
                    <div className="flex items-end justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy === r.id}
                        aria-label={`${r.isActive ? "Pausar" : "Retomar"} o relatório de ${r.dashboardName}`}
                        className={`${small} text-fg`}
                        onClick={() => run(r.id, () => setReportActive(r.id, !r.isActive))}
                      >
                        {r.isActive ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {r.isActive ? "Pausar" : "Retomar"}
                      </button>
                      <button type="button" disabled={busy === r.id} aria-label={`Apagar o relatório de ${r.dashboardName}`} title="Apagar" className={smallIcon} onClick={() => run(r.id, () => deleteScheduledReport(r.id))}>
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                  )}
                </Row>
              ))}
            </DataList>
          )}
        </section>
      )}

      {tab === "historico" && (
        <>
          <section className="space-y-3.5" aria-labelledby="h-env">
            <SectionHeader id="h-env" title="Histórico de envios" text="Cada relatório que saiu por e-mail ou WhatsApp." />
            {center.deliveries.length === 0 ? (
              <p className={emptyBox}>Nenhum envio ainda. Eles aparecem aqui quando o envio automático estiver ligado.</p>
            ) : (
              <DataList label="Histórico de envios" cols={COLS.deliveries} head={["Dashboard", "Período", "Situação", "Data"]}>
                {center.deliveries.map((d) => (
                  <Row
                    key={d.id}
                    cols={COLS.deliveries}
                    main={
                      <Main
                        icon={d.channel === "email" ? <Mail size={16} /> : <WhatsAppIcon size={16} />}
                        title={d.dashboardName ?? "Dashboard apagado"}
                        sub={
                          <span className="tnum">
                            {d.channel === "email" ? "E-mail" : "WhatsApp"} · {d.recipientsCount} {d.recipientsCount === 1 ? "destinatário" : "destinatários"}
                          </span>
                        }
                      />
                    }
                  >
                    <Cell label="Período" wide>
                      {d.periodStart && d.periodEnd ? `${d.periodStart.split("-").reverse().join("/")} a ${d.periodEnd.split("-").reverse().join("/")}` : "—"}
                    </Cell>
                    <Cell label="Situação">
                      {d.status === "sent" ? (
                        <Badge tone="ok">Enviado</Badge>
                      ) : d.status === "queued" ? (
                        <Badge>Na fila</Badge>
                      ) : (
                        <Badge tone="error" title={d.error ?? undefined}>
                          Falhou
                        </Badge>
                      )}
                    </Cell>
                    <Cell label="Data">{date(d.createdAt)}</Cell>
                  </Row>
                ))}
              </DataList>
            )}
          </section>

          <section className="space-y-3.5" aria-labelledby="h-exp">
            <SectionHeader id="h-exp" title="Histórico de exportações" text="Os PDFs baixados dos dashboards." />
            {center.exports.length === 0 ? (
              <p className={emptyBox}>Nenhum PDF exportado ainda.</p>
            ) : (
              <DataList label="Histórico de exportações" cols={COLS.exports} head={["Dashboard", "Formato", "Data"]}>
                {center.exports.map((x) => (
                  <Row
                    key={x.id}
                    cols={COLS.exports}
                    main={
                      <Main
                        icon={<FileDown size={16} />}
                        title={
                          x.dashboardId ? (
                            <Link href={`/painel/dashboards/${x.dashboardId}`} className={nameLink}>
                              {x.dashboardName}
                            </Link>
                          ) : (
                            <>
                              {x.dashboardName} <span className="text-[11.5px] font-normal text-fg-2">(apagado)</span>
                            </>
                          )
                        }
                      />
                    }
                  >
                    <Cell label="Formato">PDF (A4 paisagem)</Cell>
                    <Cell label="Data">{date(x.createdAt)}</Cell>
                  </Row>
                ))}
              </DataList>
            )}
          </section>
        </>
      )}
    </div>
  );
}
