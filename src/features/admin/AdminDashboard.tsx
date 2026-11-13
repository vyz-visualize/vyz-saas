// Painel interno: usuários (Supabase e GA4) e receita por fonte. Componente
// de servidor: os números chegam prontos, nenhuma chave vai para o navegador.
// Leitura de cima para baixo: o resumo da base, o detalhe de cadastros e de uso
// lado a lado, e a receita de cada fonte no mesmo formato (para comparar de relance).

import { ArrowRight, CircleAlert, TrendingDown, TrendingUp, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, PageHeader, SectionHeader, StatTile } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { delta, int, moneyText, pct, type AdminReport, type RevenueBlock, type Source } from "./types";

function Card({ title, children, note, aside }: { title: string; children: ReactNode; note?: string; aside?: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
      {note && <p className="mt-4 border-t border-line pt-3 text-[12px] text-fg-2">{note}</p>}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-fg-2">{label}</p>
      <p className="mt-1 truncate text-[19px] leading-none font-bold tracking-[-0.02em] tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-fg-2">{hint}</p>}
    </div>
  );
}

function Missing({ reason }: { reason: string }) {
  return (
    <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2.5 text-[13px] leading-snug text-fg-2">
      <CircleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
      {reason}
    </p>
  );
}

/** Variação contra a semana anterior, como selo (verde para cima, neutro sem base). */
function Change({ cur, prev }: { cur: number; prev: number }) {
  const d = delta(cur, prev);
  if (d === null) return <span>sem base na semana anterior</span>;
  const up = d >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-accent" : "text-error-fg"}`}>
        <Icon size={12} aria-hidden />
        {up ? "+" : ""}
        {pct(d, 0)}
      </span>
      contra a semana anterior
    </span>
  );
}

/** Fundo da célula de retenção: quanto maior a taxa, mais forte o destaque. */
const heat = (ratio: number) => ({ background: `color-mix(in srgb, var(--accent) ${Math.round(Math.min(1, Math.max(0, ratio)) * 42)}%, transparent)` });

const th = "px-2 py-2 text-left text-[11.5px] font-medium text-fg-2 first:pl-0";
const td = "px-2 py-2 first:pl-0";

function Revenue({ title, src }: { title: string; src: Source<RevenueBlock> }) {
  return (
    <Card title={title} note={src.ok ? src.data.note : undefined} aside={src.ok ? <Badge tone="ok">{int(src.data.subscribers)} ativos</Badge> : <Badge tone="dashed">Sem dados</Badge>}>
      {src.ok ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="text-[12px] text-fg-2">MRR</p>
              <p className="mt-1 text-[26px] leading-none font-bold tracking-[-0.03em] tabular-nums">{moneyText(src.data.mrr)}</p>
            </div>
            <Stat label="Receita 30 dias" value={moneyText(src.data.revenue30)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
            <Stat label="Assinantes ativos" value={int(src.data.subscribers)} hint={src.data.trials ? `${int(src.data.trials)} em teste` : undefined} />
            <Stat label="Cancelamentos 30 dias" value={int(src.data.churned30)} />
            <Stat label="Churn" value={pct(src.data.churnRate)} />
            <Stat label="Reembolsos 30 dias" value={Object.keys(src.data.refunds30).length ? moneyText(src.data.refunds30) : int(src.data.refundCount30)} hint={`${int(src.data.refundCount30)} reembolsos`} />
          </div>
        </>
      ) : (
        <Missing reason={src.reason} />
      )}
    </Card>
  );
}

export function AdminDashboard({ report }: { report: AdminReport }) {
  const { users, ga4 } = report;
  const maxDay = users.ok ? Math.max(1, ...users.data.signupsByDay.map((d) => d.n)) : 1;
  const maxSource = ga4.ok ? Math.max(1, ...ga4.data.topSources.map((s) => s.users)) : 1;
  const days = users.ok ? users.data.signupsByDay : [];
  const dayLabel = (iso: string) => iso.slice(5).split("-").reverse().join("/");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Só admin"
        title="Interno"
        text={`Usuários e receita da Vyzualize. Atualizado em ${new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (cache de 15 minutos).`}
        actions={
          <Link href="/painel/interno/usuarios" className={btn.small}>
            Gerenciar usuários <ArrowRight size={15} aria-hidden />
          </Link>
        }
      />

      {/* resumo da base, de relance */}
      {users.ok && (
        <section aria-label="Resumo dos usuários" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatTile label="Usuários" value={int(users.data.total)} icon={<Users size={16} aria-hidden />} hint={`${int(users.data.new30)} novos em 30 dias`} />
          <StatTile label="Novos em 7 dias" value={int(users.data.new7)} icon={<UserPlus size={16} aria-hidden />} hint={<Change cur={users.data.new7} prev={users.data.newPrev7} />} />
          <StatTile label="Ativos em 7 dias" value={int(users.data.active7)} icon={<UserCheck size={16} aria-hidden />} hint={`${int(users.data.active30)} ativos em 30 dias`} />
          <StatTile label="Workspaces com plano" value={int(users.data.workspacesWithPlan)} icon={<Wallet size={16} aria-hidden />} hint={users.data.total ? `${pct((users.data.workspacesWithPlan / users.data.total) * 100, 0)} dos usuários` : undefined} />
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card title="Usuários do site (Supabase)">
          {users.ok ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[12px] text-fg-2">Cadastros por dia (30 dias)</p>
                <div className="flex h-24 items-end gap-[3px] border-b border-line" role="img" aria-label="Cadastros por dia nos últimos 30 dias">
                  {days.map((d) => (
                    <div key={d.date} title={`${dayLabel(d.date)}: ${d.n}`} className={`flex-1 rounded-t-[3px] ${d.n ? "bg-accent" : "bg-surface-2"}`} style={{ height: `${Math.max(4, (d.n / maxDay) * 100)}%` }} />
                  ))}
                </div>
                {days.length > 1 && (
                  <p className="mt-1.5 flex justify-between text-[11px] text-fg-2 tabular-nums" aria-hidden>
                    <span>{dayLabel(days[0].date)}</span>
                    <span>{dayLabel(days[days.length - 1].date)}</span>
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] tabular-nums">
                  <caption className="mb-1 text-left text-[12px] text-fg-2">Retenção: quem voltou a entrar depois da 1ª semana, por semana de cadastro</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th className={th}>Semana</th>
                      <th className={th}>Cadastros</th>
                      <th className={th}>Voltaram</th>
                      <th className={`${th} text-right`}>Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.cohorts.map((c) => {
                      const rate = c.size ? c.returned / c.size : null;
                      return (
                        <tr key={c.week} className="border-b border-line/70 last:border-0">
                          <td className={td}>{c.week.split("-").reverse().join("/")}</td>
                          <td className={td}>{int(c.size)}</td>
                          <td className={td}>{c.size ? int(c.returned) : "—"}</td>
                          <td className={`${td} text-right`}>
                            {rate === null ? (
                              "—"
                            ) : (
                              <span className="inline-block min-w-12 rounded-[6px] px-1.5 py-0.5 text-center font-medium" style={heat(rate)}>
                                {pct(rate * 100, 0)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Missing reason={users.reason} />
          )}
        </Card>

        <Card title="Visitas e uso (GA4)">
          {ga4.ok ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                <Stat label="Ativos hoje" value={int(ga4.data.active1)} />
                <Stat label="Ativos em 7 dias" value={int(ga4.data.active7)} />
                <Stat label="Ativos em 28 dias" value={int(ga4.data.active28)} />
                <Stat label="Novos em 28 dias" value={int(ga4.data.newUsers28)} />
                <Stat label="Sessões em 28 dias" value={int(ga4.data.sessions28)} />
              </div>
              {ga4.data.topSources.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] text-fg-2">De onde vêm (28 dias)</p>
                  <ul className="space-y-2 text-[13px]">
                    {ga4.data.topSources.map((s) => (
                      <li key={s.source}>
                        <p className="flex justify-between gap-3">
                          <span className="truncate">{s.source}</span>
                          <span className="font-medium tabular-nums">{int(s.users)}</span>
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (s.users / maxSource) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ga4.data.cohorts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] tabular-nums">
                    <caption className="mb-1 text-left text-[12px] text-fg-2">Retenção semanal (GA4): % da semana 0 que voltou</caption>
                    <thead>
                      <tr className="border-b border-line">
                        <th className={th}>Coorte</th>
                        <th className={th}>Usuários</th>
                        {[1, 2, 3, 4].map((w) => (
                          <th key={w} className={`${th} text-center`}>
                            Sem. {w}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ga4.data.cohorts.map((c) => (
                        <tr key={c.week} className="border-b border-line/70 last:border-0">
                          <td className={`${td} whitespace-nowrap`}>{c.week}</td>
                          <td className={td}>{int(c.size)}</td>
                          {[1, 2, 3, 4].map((w) => (
                            <td key={w} className="px-1 py-1.5 text-center">
                              {c.size && Number.isFinite(c.weeks[w]) ? (
                                <span className="block rounded-[6px] px-1.5 py-1 font-medium" style={heat(c.weeks[w] / 100)}>
                                  {pct(c.weeks[w], 0)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <Missing reason={ga4.reason} />
          )}
        </Card>
      </div>

      <div className="space-y-4 pt-2">
        <SectionHeader title="Receita por fonte" text="MRR, assinantes e cancelamentos de cada canal de venda." />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <Revenue title="Site (Stripe)" src={report.stripe} />
          <Revenue title="App Store" src={report.appStore} />
          <Revenue title="Google Play" src={report.googlePlay} />
          <Revenue title="RevenueCat (lojas juntas)" src={report.revenueCat} />
        </div>
      </div>
    </div>
  );
}
