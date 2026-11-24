"use client";

// Abas que cada visual mostra do jeito dele (antes dos blocos padrão, que seguem embaixo):
//   - Pulso, Funil: onde está o gargalo nos últimos 7 dias contra os 7 antes;
//   - Noturno, Funil: a taxa de cada etapa ao longo do tempo (por semana);
//   - Areia, Público: quem converte (a parte nos resultados), não quem só recebe a verba;
//   - Lavanda, todas as abas anexas: o capítulo (texto e destaque) antes do conteúdo.
// As contas saem das linhas do dia a dia e das quebras do conjunto: nada novo é estimado.

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { delta } from "@/features/metrics/compute";
import type { DayRow } from "@/features/metrics/source";
import { DailyChart, dayDates, weekly, weekStarts } from "./bklit-blocks";
import { chrono, dayLabel, goalOf, int, label, money, pct, type SkinProps } from "./shared";

type Ctx = SkinProps["ctx"];

// ---- etapas do funil pelo dia a dia --------------------------------------------------------------

type Step = { id: string; label: string; num: (d: DayRow) => number; den: (d: DayRow) => number };

/** As passagens que o dia a dia permite medir (a de visita só quando a visita é diferente do clique). */
export function funnelSteps(ctx: Ctx): Step[] {
  const { conv } = goalOf(ctx.profile, ctx.cur.leads);
  const word = label(ctx, conv).toLowerCase();
  const hasVisits = ctx.ds.current.some((d) => d.sessions > 0 && d.sessions !== d.clicks);
  return [
    { id: "ctr", label: "Impressão → clique", num: (d) => d.clicks, den: (d) => d.impressions },
    ...(hasVisits
      ? [
          { id: "visita", label: "Clique → visita", num: (d: DayRow) => d.sessions, den: (d: DayRow) => d.clicks },
          { id: "resultado", label: `Visita → ${word}`, num: (d: DayRow) => d[conv], den: (d: DayRow) => d.sessions },
        ]
      : [{ id: "resultado", label: `Clique → ${word}`, num: (d: DayRow) => d[conv], den: (d: DayRow) => d.clicks }]),
  ];
}

const rate = (rows: readonly DayRow[], s: Step) => {
  const den = rows.reduce((a, d) => a + s.den(d), 0);
  return den > 0 ? rows.reduce((a, d) => a + s.num(d), 0) / den : null;
};

/** Cada passagem nos últimos 7 dias e nos 7 antes; o gargalo é a que mais caiu. */
export function bottleneck(ctx: Ctx): { rows: { step: Step; now: number | null; before: number | null; change: number | null }[]; worst: string | null } {
  const days = chrono(ctx.ds.current);
  const last = days.slice(-7);
  const prev = days.slice(-14, -7);
  const rows = funnelSteps(ctx).map((step) => {
    const now = rate(last, step);
    const before = rate(prev, step);
    return { step, now, before, change: now != null && before ? delta(now, before) : null };
  });
  const drops = rows.filter((r) => r.change != null && r.change < -0.05).sort((a, b) => (a.change ?? 0) - (b.change ?? 0));
  return { rows, worst: drops[0]?.step.id ?? null };
}

export function PulsoFunnel({ ctx, tone }: { ctx: Ctx; tone: { card: string; line: string; fg: string; fg2: string; bad: string; good: string } }) {
  const b = bottleneck(ctx);
  const worst = b.rows.find((r) => r.step.id === b.worst);
  return (
    <section className="mb-4 rounded-[22px] border p-4" style={{ background: tone.card, borderColor: tone.line, color: tone.fg }} data-gargalo={b.worst ?? "nenhum"}>
      <h3 className="flex items-center gap-2 text-[14.5px] font-bold">
        <AlertTriangle size={16} aria-hidden style={{ color: worst ? tone.bad : tone.fg2 }} /> Onde está o gargalo
      </h3>
      <p className="mt-1 text-[12.5px]" style={{ color: tone.fg2 }}>
        {worst ? (
          <>
            A passagem <strong style={{ color: tone.fg }}>{worst.step.label}</strong> caiu {pct(Math.abs(worst.change ?? 0), 0)} nos últimos 7 dias contra os 7 antes.
          </>
        ) : (
          "Nenhuma passagem caiu mais de 5% nos últimos 7 dias contra os 7 antes."
        )}{" "}
        Os últimos 3 dias ainda estão em maturação.
      </p>
      <ul className="mt-3 grid gap-2 @[700px]:grid-cols-3">
        {b.rows.map((r) => {
          const bad = r.step.id === b.worst;
          return (
            <li key={r.step.id} className="rounded-[14px] border p-3" style={{ borderColor: bad ? tone.bad : tone.line }} data-etapa-funil={r.step.id}>
              <p className="text-[11.5px]" style={{ color: tone.fg2 }}>
                {r.step.label}
              </p>
              <p className="mt-0.5 text-[20px] font-bold tnum">{r.now == null ? "—" : pct(r.now, r.now < 0.1 ? 2 : 1)}</p>
              <p className="text-[11px] tnum" style={{ color: r.change == null ? tone.fg2 : r.change < 0 ? tone.bad : tone.good }}>
                {r.change == null ? "sem os 7 dias antes" : `${r.change < 0 ? "▼" : "▲"} ${pct(Math.abs(r.change), 0)} · antes ${pct(r.before ?? 0, (r.before ?? 0) < 0.1 ? 2 : 1)}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Noturno: a taxa de cada passagem por semana (uma série por passagem, cada uma na escala dela). */
export function NoturnoFunnel({ ctx, accent }: { ctx: Ctx; accent: string }) {
  const days = chrono(ctx.ds.current);
  const starts = weekStarts(days);
  const steps = funnelSteps(ctx);
  if (days.length < 14) return null;
  return (
    <section className="mb-6 border-t border-line pt-4" data-taxas-no-tempo>
      <h3 className="text-[10.5px] font-semibold tracking-[0.14em] text-fg-2 uppercase">Taxa de cada etapa, semana a semana</h3>
      <div className="mt-3 grid gap-6 @[900px]:grid-cols-3">
        {steps.map((s) => {
          const num = weekly(days.map(s.num));
          const den = weekly(days.map(s.den));
          const values = num.map((n, i) => (den[i] > 0 ? n / den[i] : 0));
          return (
            <div key={s.id} className="flex h-[220px] min-w-0 flex-col">
              <p className="mb-1 text-[13px] font-semibold text-fg">{s.label}</p>
              <DailyChart
                points={values.map((v) => ({ taxa: v }))}
                dates={dayDates(starts.map((d) => d.ago), ctx.today)}
                labels={starts.map((d) => dayLabel(d.ago, ctx.today))}
                series={[{ key: "taxa", label: s.label, color: accent, kind: "line" }]}
                format={(_, v) => pct(v, v < 0.1 ? 2 : 1)}
                formatY={(v) => pct(v, v < 0.1 ? 1 : 0)}
                summary={`${s.label} por semana: de ${pct(Math.min(...values), 1)} a ${pct(Math.max(...values), 1)}.`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Areia: quem converte ------------------------------------------------------------------------

/** Por idade: a parte da verba e a parte dos resultados (verba ÷ custo por resultado), e o custo de cada um. */
export function whoConverts(ctx: Ctx): { label: string; spendShare: number; resultShare: number; cpa: number | null }[] {
  const rows = ctx.ds.audience.filter((a) => a.share > 0);
  const weight = rows.map((a) => (a.cpa > 0 ? a.share / a.cpa : 0));
  const total = weight.reduce((a, v) => a + v, 0);
  return rows.map((a, i) => ({ label: a.label, spendShare: a.share, resultShare: total > 0 ? weight[i] / total : 0, cpa: a.cpa > 0 ? a.cpa : null })).sort((a, b) => b.resultShare - a.resultShare);
}

export function AreiaAudience({ ctx, accent }: { ctx: Ctx; accent: string }) {
  const rows = whoConverts(ctx);
  const { conv } = goalOf(ctx.profile, ctx.cur.leads);
  const word = label(ctx, conv).toLowerCase();
  if (!rows.length) return null;
  return (
    <section className="mb-4 rounded-[22px] border border-line bg-card p-4" data-quem-converte>
      <h3 className="text-[14px] font-semibold text-fg">Quem converte, não quem clica</h3>
      <p className="mt-0.5 text-[12px] text-fg-2">Por idade: a parte da verba ao lado da parte dos {word}. Quem traz mais {word} do que recebe de verba converte melhor.</p>
      <table className="mt-3 w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] text-fg-2">
            <th className="pb-1.5 font-medium">Idade</th>
            <th className="pb-1.5 font-medium">Verba × {word}</th>
            <th className="pb-1.5 text-right font-medium">Custo por {word.replace(/s$/, "")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <td className="py-2 pr-3 font-medium text-fg">{r.label}</td>
              <td className="py-2 pr-3">
                <span className="block h-1.5 rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full bg-fg-2/50" style={{ width: `${r.spendShare * 100}%` }} />
                </span>
                <span className="mt-1 block h-1.5 rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${r.resultShare * 100}%`, background: accent }} />
                </span>
                <span className="mt-1 block text-[11px] text-fg-2 tnum">
                  {pct(r.spendShare, 0)} da verba · <strong className="text-fg">{pct(r.resultShare, 0)} dos {word}</strong>
                </span>
              </td>
              <td className="py-2 text-right tnum text-fg">{r.cpa == null || ctx.hideSpend ? "—" : money(ctx, r.cpa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---- Lavanda: o anexo em capítulo ------------------------------------------------------------------

/** O capítulo de uma aba anexa: o que ela mostra numa frase, com o número de destaque, e o conteúdo embaixo. */
export function AnnexChapter({ ctx, name, children }: { ctx: Ctx; name: string; children: ReactNode }) {
  const { conv, cost } = goalOf(ctx.profile, ctx.cur.leads);
  const d = delta(ctx.cur[conv], ctx.prev[conv]);
  const word = label(ctx, conv).toLowerCase();
  return (
    <div data-anexo>
      <header className="mb-5 grid gap-4 border-b border-line pb-4 @[900px]:grid-cols-[minmax(0,1fr)_auto] @[900px]:items-end">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Anexo · {name}</p>
          <p className="mt-1.5 max-w-[75ch] text-[14px] leading-relaxed text-fg" data-texto-anexo>
            {ctx.hideSpend ? "" : `${money(ctx, ctx.cur.spend, true)} investidos, `}
            <strong>{int(ctx.cur[conv])}</strong> {word}
            {!ctx.hideSpend && ctx.cur[conv] > 0 ? ` a ${money(ctx, ctx.cur[cost])} cada` : ""}
            {ctx.prev[conv] > 0 && Number.isFinite(d) && d !== 0 ? ` (${d > 0 ? "subiu" : "caiu"} ${pct(Math.abs(d), 0)} contra o período anterior)` : ""}.
          </p>
        </div>
        <p className="rounded-[14px] bg-accent-soft px-4 py-2.5 text-right" data-destaque-anexo>
          <span className="block text-[11px] text-fg-2">{label(ctx, conv)}</span>
          <span className="block text-[26px] leading-tight font-bold tracking-tight text-fg tnum">{int(ctx.cur[conv])}</span>
        </p>
      </header>
      {children}
    </div>
  );
}
