// Painel interno: usuários (Supabase e GA4) e receita por fonte. Componente
// de servidor: os números chegam prontos, nenhuma chave vai para o navegador.

import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/kit";
import { delta, int, moneyText, pct, type AdminReport, type RevenueBlock, type Source } from "./types";

function Card({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="rounded-card border border-line bg-card p-4">
      <h2 className="title text-[15px] text-fg">{title}</h2>
      <div className="mt-3">{children}</div>
      {note && <p className="mt-3 text-[12px] text-fg-2">{note}</p>}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="display text-[22px] tabular-nums">{value}</p>
      <p className="text-[12.5px] text-fg-2">{label}</p>
      {hint && <p className="text-[11.5px] text-fg-2/80">{hint}</p>}
    </div>
  );
}

function Missing({ reason }: { reason: string }) {
  return <p className="rounded-control bg-field px-3 py-2 text-[13px] text-fg-2">{reason}</p>;
}

const change = (cur: number, prev: number) => {
  const d = delta(cur, prev);
  return d === null ? "sem base na semana anterior" : `${d >= 0 ? "+" : ""}${pct(d, 0)} contra a semana anterior`;
};

function Revenue({ title, src }: { title: string; src: Source<RevenueBlock> }) {
  return (
    <Card title={title} note={src.ok ? src.data.note : undefined}>
      {src.ok ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="MRR" value={moneyText(src.data.mrr)} />
          <Stat label="Assinantes ativos" value={int(src.data.subscribers)} hint={src.data.trials ? `${int(src.data.trials)} em teste` : undefined} />
          <Stat label="Receita 30 dias" value={moneyText(src.data.revenue30)} />
          <Stat label="Cancelamentos 30 dias" value={int(src.data.churned30)} />
          <Stat label="Churn" value={pct(src.data.churnRate)} />
          <Stat label="Reembolsos 30 dias" value={Object.keys(src.data.refunds30).length ? moneyText(src.data.refunds30) : int(src.data.refundCount30)} hint={`${int(src.data.refundCount30)} reembolsos`} />
        </div>
      ) : (
        <Missing reason={src.reason} />
      )}
    </Card>
  );
}

export function AdminDashboard({ report }: { report: AdminReport }) {
  const { users, ga4 } = report;
  const maxDay = users.ok ? Math.max(1, ...users.data.signupsByDay.map((d) => d.n)) : 1;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Só admin"
        title="Interno"
        text={`Usuários e receita da Vyzualize. Atualizado em ${new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (cache de 15 minutos).`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Usuários do site (Supabase)">
          {users.ok ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Usuários" value={int(users.data.total)} />
                <Stat label="Novos em 7 dias" value={int(users.data.new7)} hint={change(users.data.new7, users.data.newPrev7)} />
                <Stat label="Novos em 30 dias" value={int(users.data.new30)} />
                <Stat label="Ativos em 7 dias" value={int(users.data.active7)} />
                <Stat label="Ativos em 30 dias" value={int(users.data.active30)} />
                <Stat label="Workspaces com plano" value={int(users.data.workspacesWithPlan)} />
              </div>
              <div>
                <p className="mb-1 text-[12px] text-fg-2">Cadastros por dia (30 dias)</p>
                <div className="flex h-16 items-end gap-[3px]" role="img" aria-label="Cadastros por dia nos últimos 30 dias">
                  {users.data.signupsByDay.map((d) => (
                    <div key={d.date} title={`${d.date}: ${d.n}`} className="flex-1 rounded-t-sm bg-accent" style={{ height: `${Math.max(3, (d.n / maxDay) * 100)}%`, opacity: d.n ? 1 : 0.25 }} />
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] tabular-nums">
                  <caption className="mb-1 text-left text-[12px] text-fg-2">Retenção: quem voltou a entrar depois da 1ª semana, por semana de cadastro</caption>
                  <thead className="text-fg-2">
                    <tr>
                      <th className="py-1 font-medium">Semana</th>
                      <th className="py-1 font-medium">Cadastros</th>
                      <th className="py-1 font-medium">Voltaram</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.cohorts.map((c) => (
                      <tr key={c.week} className="border-t border-line">
                        <td className="py-1">{c.week.split("-").reverse().join("/")}</td>
                        <td className="py-1">{int(c.size)}</td>
                        <td className="py-1">{c.size ? `${int(c.returned)} (${pct((c.returned / c.size) * 100, 0)})` : "—"}</td>
                      </tr>
                    ))}
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Ativos hoje" value={int(ga4.data.active1)} />
                <Stat label="Ativos em 7 dias" value={int(ga4.data.active7)} />
                <Stat label="Ativos em 28 dias" value={int(ga4.data.active28)} />
                <Stat label="Novos em 28 dias" value={int(ga4.data.newUsers28)} />
                <Stat label="Sessões em 28 dias" value={int(ga4.data.sessions28)} />
              </div>
              {ga4.data.topSources.length > 0 && (
                <div>
                  <p className="mb-1 text-[12px] text-fg-2">De onde vêm (28 dias)</p>
                  <ul className="space-y-1 text-[13px]">
                    {ga4.data.topSources.map((s) => (
                      <li key={s.source} className="flex justify-between gap-3">
                        <span className="truncate">{s.source}</span>
                        <span className="tabular-nums text-fg-2">{int(s.users)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ga4.data.cohorts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] tabular-nums">
                    <caption className="mb-1 text-left text-[12px] text-fg-2">Retenção semanal (GA4): % da semana 0 que voltou</caption>
                    <thead className="text-fg-2">
                      <tr>
                        <th className="py-1 font-medium">Coorte</th>
                        <th className="py-1 font-medium">Usuários</th>
                        {[1, 2, 3, 4].map((w) => (
                          <th key={w} className="py-1 font-medium">
                            Sem. {w}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ga4.data.cohorts.map((c) => (
                        <tr key={c.week} className="border-t border-line">
                          <td className="py-1">{c.week}</td>
                          <td className="py-1">{int(c.size)}</td>
                          {[1, 2, 3, 4].map((w) => (
                            <td key={w} className="py-1">
                              {c.size ? pct(c.weeks[w], 0) : "—"}
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

      <h2 className="title pt-2 text-[18px]">Receita por fonte</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Revenue title="Site (Stripe)" src={report.stripe} />
        <Revenue title="App Store" src={report.appStore} />
        <Revenue title="Google Play" src={report.googlePlay} />
        <Revenue title="RevenueCat (lojas juntas)" src={report.revenueCat} />
      </div>
    </div>
  );
}
