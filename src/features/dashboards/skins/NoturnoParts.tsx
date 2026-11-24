"use client";

// Peças do Noturno (análise): a barra de filtros fixa (plataforma, campanha, dia da semana e
// comparar), o mestre-detalhe (a lista à esquerda; o escolhido à direita, com o dia a dia, os
// dias fora do padrão e o período anterior) e a aba "Produtos" (ranking com subiu/desceu e o
// detalhe do produto). Plataforma e campanha são os filtros do dashboard (valem para a aba
// inteira); o dia da semana vale para a lista e o detalhe.

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { useDashFilters } from "@/features/analytics/filter-context";
import { delta } from "@/features/metrics/compute";
import type { Campaign, DayRow } from "@/features/metrics/source";
import { brlCompact } from "@/lib/format";
import { Block, DailyChart, dayDates, type DailySeries } from "./bklit-blocks";
import { MiniSpark, MoveTag } from "./extras";
import { FullName } from "./FullName";
import { dayNotes, productMovers, WEEKDAYS } from "./insights";
import { chrono, dayLabel, decimal, goalOf, int, label, money, pct, platformName, type SkinProps } from "./shared";

type Ctx = SkinProps["ctx"];
type Tone = { fg: string; fg2: string; line: string; accent: string; good: string; bad: string };

const ALL = "todas";

/** Dia da semana (0 = domingo) de "hoje − ago", pela data: igual no servidor e no navegador. */
const weekdayOf = (today: string, ago: number) => new Date(Date.parse(`${today}T12:00:00Z`) - ago * 86_400_000).getUTCDay();

/** Barra de filtros: plataforma e campanha (do dashboard), dia da semana e comparar (desta análise). */
export function AnalysisBar({ ctx, weekday, setWeekday, compare, setCompare, platformOnly }: { ctx: Ctx; weekday: number | null; setWeekday: (d: number | null) => void; compare: boolean; setCompare: (v: boolean) => void; platformOnly?: PlatformId }) {
  const filters = useDashFilters();
  const can = !!filters?.interactive;
  const platforms = ctx.ds.adPlatforms;
  const plat = filters?.filters.platforms[0] ?? ALL;
  const camp = filters?.filters.campaigns[0] ?? ALL;
  const campaigns = [...ctx.ds.campaigns].filter((c) => !platformOnly || c.platform === platformOnly).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const field = "h-9 min-w-0 rounded-[4px] border border-line bg-transparent px-2.5 text-[12px] font-normal tracking-normal normal-case text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-3" data-analise-filtros>
      {!platformOnly && platforms.length > 1 && (
        <label className="flex min-w-0 items-center gap-2 text-[10.5px] font-semibold tracking-[0.12em] text-fg-2 uppercase">
          Plataforma
          <select
            className={field}
            value={plat}
            disabled={!can}
            onChange={(e) => {
              const v = e.target.value;
              if (v === ALL) filters?.remove("platforms");
              else filters?.toggle("platforms", v, platformName(v as PlatformId));
            }}
          >
            <option value={ALL}>Todas</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformName(p)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex min-w-0 max-w-full items-center gap-2 text-[10.5px] font-semibold tracking-[0.12em] text-fg-2 uppercase">
        Campanha
        <select
          className={`${field} max-w-[240px]`}
          value={camp}
          disabled={!can}
          onChange={(e) => {
            const v = e.target.value;
            if (v === ALL) filters?.remove("campaigns");
            else filters?.toggle("campaigns", v, campaigns.find((c) => c.id === v)?.name ?? v);
          }}
        >
          <option value={ALL}>Todas</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {ctx.today && (
        <label className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.12em] text-fg-2 uppercase">
          Dia da semana
          <select className={field} value={weekday ?? ALL} onChange={(e) => setWeekday(e.target.value === ALL ? null : Number(e.target.value))}>
            <option value={ALL}>Todos</option>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="ml-auto flex cursor-pointer items-center gap-2 px-1 text-[12px]">
        <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Comparar com o período anterior
      </label>
    </div>
  );
}

type Row = { id: string; name: string; platform?: PlatformId; values: number[]; agos: number[]; total: number; spend: number; prevPerDay: number | null; prevValues: number[] | null; campaign?: Campaign };

/** As linhas da lista: "Todas" e cada campanha, no resultado do objetivo, dia a dia (e no dia da semana escolhido). */
function rowsOf(ctx: Ctx, weekday: number | null, platform?: PlatformId): Row[] {
  const { conv } = goalOf(ctx.profile, ctx.cur.leads);
  const days = chrono(ctx.ds.current);
  const before = chrono(ctx.ds.previous);
  const keep = (ago: number) => weekday === null || !ctx.today || weekdayOf(ctx.today, ago) === weekday;
  const idx = days.map((d, i) => (keep(d.ago) ? i : -1)).filter((i) => i >= 0);
  const pick = (d: DayRow) => d[conv];
  const all: Row = {
    id: ALL,
    name: platform ? `Todas em ${platformName(platform)}` : "Todas as campanhas",
    values: idx.map((i) => pick(days[i])),
    agos: idx.map((i) => days[i].ago),
    total: idx.reduce((a, i) => a + pick(days[i]), 0),
    spend: idx.reduce((a, i) => a + days[i].spend, 0),
    prevPerDay: null,
    // o mesmo dia do período anterior (mesma posição; com o dia da semana, o mesmo dia da semana)
    prevValues: before.length === days.length ? idx.map((i) => pick(before[i])) : null,
  };
  const camps = ctx.ds.campaigns
    .filter((c) => c.daily && (!platform || c.platform === platform))
    .map((c): Row => {
      const d = c.daily!;
      // o dia a dia da campanha vai do mais antigo ao mais recente, como os dias do período
      const off = days.length - d.conversions.length;
      const ii = idx.filter((i) => i - off >= 0);
      const prevDays = ctx.ds.previous.length || days.length;
      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        values: ii.map((i) => d.conversions[i - off] ?? 0),
        agos: ii.map((i) => days[i].ago),
        total: ii.reduce((a, i) => a + (d.conversions[i - off] ?? 0), 0),
        spend: ii.reduce((a, i) => a + (d.spend[i - off] ?? 0), 0),
        // da campanha, o período anterior só vem somado: a média por dia vira a linha de comparação
        prevPerDay: c.prev ? c.prev.conversions / prevDays : null,
        prevValues: null,
        campaign: c,
      };
    })
    .sort((a, b) => b.total - a.total);
  return [all, ...camps];
}

/**
 * Mestre-detalhe: a lista (Todas e cada campanha, com o minigráfico e a variação) e o detalhe
 * do escolhido (resultado por dia, os dias fora do padrão e o período anterior quando "comparar").
 */
export function MasterDetail({ ctx, tone, weekday, compare, platform, accent, prevColor }: { ctx: Ctx; tone: Tone; weekday: number | null; compare: boolean; platform?: PlatformId; accent: string; prevColor: string }) {
  const { conv } = goalOf(ctx.profile, ctx.cur.leads);
  const word = label(ctx, conv);
  const rows = rowsOf(ctx, weekday, platform);
  const [picked, setPicked] = useState<string>(ALL);
  const sel = rows.find((r) => r.id === picked) ?? rows[0];
  const top = Math.max(1e-9, ...rows.slice(1).flatMap((r) => r.values));
  const wd = weekday === null ? null : WEEKDAYS[weekday];
  const prevLine = compare ? (sel.prevValues ?? (sel.prevPerDay !== null ? sel.values.map(() => sel.prevPerDay!) : null)) : null;
  const points = sel.values.map((v, i) => ({ atual: v, ...(prevLine ? { anterior: prevLine[i] ?? 0 } : {}) }));
  const series: DailySeries[] = [
    { key: "atual", label: word, color: accent, kind: "area" },
    ...(prevLine ? [{ key: "anterior", label: sel.prevValues ? "Período anterior" : "Média/dia no período anterior", color: prevColor, kind: "line" as const }] : []),
  ];
  // dias fora do padrão: só com todos os dias (a tendência usa o dia da semana)
  const notes = weekday === null ? dayNotes(sel.values.map((v, i) => ({ ago: sel.agos[i], v }) as unknown as DayRow), (d) => (d as unknown as { v: number }).v, 3) : [];
  const prevTotal = sel.prevValues ? sel.prevValues.reduce((a, b) => a + b, 0) : weekday === null && sel.prevPerDay !== null ? sel.prevPerDay * (ctx.ds.previous.length || sel.values.length) : null;
  const d = prevTotal ? delta(sel.total, prevTotal) : null;
  return (
    <Block title={`${word} por ${platform ? "campanha da plataforma" : "campanha"}${wd ? ` · só ${wd}` : ""}`} aside={<span className="text-[11px] text-fg-2">escolha na lista para ver o dia a dia</span>}>
      <div className="grid min-h-0 flex-1 gap-4 @[900px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] @[900px]:grid-rows-[minmax(0,1fr)]" data-mestre-detalhe>
        <ul className="min-h-0 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin] max-[899px]:max-h-[300px]" aria-label="Lista">
          {rows.map((r) => {
            const on = r.id === sel.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setPicked(r.id)}
                  aria-pressed={on}
                  className="flex w-full min-w-0 items-center gap-3 rounded-[12px] px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={on ? { background: "color-mix(in srgb, var(--accent) 16%, transparent)" } : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <FullName text={r.name} className={`text-[12.5px] ${r.id === ALL ? "font-bold" : "font-medium"}`} />
                    {r.platform && <span className="block text-[10.5px] text-fg-2">{platformName(r.platform)}</span>}
                  </span>
                  {r.id !== ALL && <MiniSpark values={r.values} color={accent} scaleMax={top} className="h-7 w-16 shrink-0" label={`${r.name}: ${int(r.total)} ${word.toLowerCase()}`} />}
                  <span className="w-12 shrink-0 text-right text-[12.5px] font-semibold tnum">{int(r.total)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex min-h-[260px] min-w-0 flex-col" data-detalhe={sel.id} data-total={sel.total} data-anterior={prevTotal ?? undefined}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <FullName text={sel.name} className="min-w-0 text-[15px] font-bold" />
            <span className="text-[22px] font-bold tnum">{int(sel.total)}</span>
            <span className="text-[11.5px] text-fg-2">
              {word.toLowerCase()}
              {!ctx.hideSpend && sel.total > 0 ? ` · ${money(ctx, sel.spend / sel.total, true)} cada` : ""}
              {!ctx.hideSpend ? ` · ${money(ctx, sel.spend, true)} investidos` : ""}
            </span>
            {compare && d !== null && Number.isFinite(d) && d !== 0 && (
              <span className="flex items-center gap-0.5 text-[11.5px] font-semibold" style={{ color: d > 0 ? tone.good : tone.bad }}>
                {d > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {pct(Math.abs(d))} contra o anterior
              </span>
            )}
          </div>
          {prevLine && (
            <p className="mt-1 flex items-center gap-3 text-[10.5px] text-fg-2">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: accent }} aria-hidden /> {word.toLowerCase()}</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: prevColor }} aria-hidden /> {sel.prevValues ? "período anterior, dia a dia" : "média por dia no período anterior"}</span>
            </p>
          )}
          {sel.values.length >= 2 ? (
            <DailyChart
              points={points}
              dates={dayDates(sel.agos, ctx.today)}
              labels={sel.agos.map((a) => dayLabel(a, ctx.today))}
              series={series}
              // contagem por dia é inteira; só a média por dia do período anterior tem casa decimal
              format={(key, v) => (key === "anterior" && !sel.prevValues ? decimal(v, v < 10 ? 1 : 0) : int(v))}
              formatY={(v) => int(v)}
              summary={`${sel.name}: ${int(sel.total)} ${word.toLowerCase()} no período${wd ? `, só ${wd}` : ""}.`}
            />
          ) : (
            <p className="m-auto text-[12px] text-fg-2">Poucos dias para desenhar o dia a dia.</p>
          )}
          <p className="mt-2 text-[11px] text-fg-2" data-notas>
            {notes.length > 0 ? (
              <>
                Fora do padrão:{" "}
                {notes.map((n, i) => (
                  <span key={n.ago}>
                    {i > 0 && " · "}
                    <strong className="font-semibold text-fg">{dayLabel(n.ago, ctx.today)}</strong>{" "}
                    <span style={{ color: n.change > 0 ? tone.good : tone.bad }}>
                      {n.change > 0 ? "+" : "−"}
                      {decimal(Math.abs(n.change) * 100, 0)}%
                    </span>{" "}
                    contra o esperado
                  </span>
                ))}
              </>
            ) : weekday !== null ? (
              "Com um dia da semana escolhido, os dias fora do padrão não aparecem (a tendência precisa de todos os dias)."
            ) : (
              "Nenhum dia fora do padrão no período."
            )}
            {compare && !sel.prevValues && sel.prevPerDay !== null && <> · Por campanha, o período anterior só vem somado: a linha clara é a média por dia.</>}
          </p>
        </div>
      </div>
    </Block>
  );
}

/** Aba Produtos: o ranking com subiu/desceu e o detalhe do escolhido contra o período anterior. */
export function ProductsPage({ ctx, tone }: { ctx: Ctx; tone: Tone }) {
  const ranked = productMovers(ctx.ds.products, 50);
  const [picked, setPicked] = useState<string | null>(null);
  const sel = ranked.find((m) => m.item.name === picked) ?? ranked[0];
  const max = Math.max(1, ...ranked.map((m) => m.item.revenue));
  if (!sel) return <p className="py-10 text-center text-[12.5px] text-fg-2">Os produtos aparecem quando o período tem campanhas de catálogo na Meta ou de Shopping no Google.</p>;
  const p = sel.item;
  const roas = p.spend > 0 ? p.revenue / p.spend : null;
  const cmp = [
    { l: "Vendidos", now: p.sold, before: p.prev?.sold ?? null, f: (v: number) => int(v) },
    { l: "Receita", now: p.revenue, before: p.prev?.revenue ?? null, f: (v: number) => brlCompact(v) },
  ];
  return (
    <div className="grid gap-4 @[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-produtos>
      <Block title="Produtos por receita" aside={<span className="text-[11px] text-fg-2">posição contra o período anterior</span>}>
        <ol className="space-y-1">
          {ranked.map((m) => {
            const on = m.item.name === p.name;
            return (
              <li key={m.item.name}>
                <button type="button" onClick={() => setPicked(m.item.name)} aria-pressed={on} className="flex w-full min-w-0 items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left" style={on ? { background: "color-mix(in srgb, var(--accent) 16%, transparent)" } : undefined}>
                  <span className="w-5 shrink-0 text-[11px] font-bold text-fg-2 tnum">{m.rank}</span>
                  <MoveTag moved={m.moved} tone={tone} />
                  <span className="min-w-0 flex-1">
                    <FullName text={m.item.name} className="text-[12.5px] font-medium" />
                    <span className="mt-1 block h-1.5 rounded-full" style={{ width: `${Math.max(4, (m.item.revenue / max) * 100)}%`, background: tone.accent }} aria-hidden />
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold tnum">{brlCompact(m.item.revenue)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Block>
      <Block title="O produto escolhido">
        <FullName text={p.name} lines={2} className="text-[18px] leading-snug font-bold" />
        <p className="mt-1 text-[12px] text-fg-2">
          {sel.moved === null ? "Novo no ranking" : sel.moved > 0 ? `Subiu ${sel.moved} ${sel.moved === 1 ? "posição" : "posições"}` : sel.moved < 0 ? `Desceu ${-sel.moved} ${sel.moved === -1 ? "posição" : "posições"}` : "Mesma posição"} · {sel.rank}º em receita
        </p>
        <ul className="mt-4 space-y-4">
          {cmp.map((r) => {
            const d = r.before ? delta(r.now, r.before) : null;
            const topv = Math.max(r.now, r.before ?? 0, 1e-9);
            return (
              <li key={r.l}>
                <p className="flex items-baseline justify-between text-[12px]">
                  <span className="text-fg-2">{r.l}</span>
                  <span className="tnum">
                    <strong className="text-[16px] font-bold">{r.f(r.now)}</strong>{" "}
                    {d !== null && d !== 0 && <span className="text-[11px] font-semibold" style={{ color: d > 0 ? tone.good : tone.bad }}>{d > 0 ? "▲" : "▼"} {pct(Math.abs(d))}</span>}
                  </span>
                </p>
                {r.before !== null && (
                  <div className="mt-1 space-y-1" aria-hidden>
                    <span className="block h-2 rounded-full" style={{ width: `${(r.before / topv) * 100}%`, background: "color-mix(in srgb, var(--fg) 18%, transparent)" }} />
                    <span className="block h-2 rounded-full" style={{ width: `${(r.now / topv) * 100}%`, background: tone.accent }} />
                  </div>
                )}
                {r.before !== null && <p className="mt-1 text-[10.5px] text-fg-2 tnum">anterior: {r.f(r.before)}</p>}
              </li>
            );
          })}
        </ul>
        {!ctx.hideSpend && (
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[11px] text-fg-2">
            <span>
              Investimento
              <strong className="block text-[16px] text-fg tnum">{brlCompact(p.spend)}</strong>
            </span>
            {roas !== null && (
              <span>
                ROAS
                <strong className="block text-[16px] text-fg tnum">{decimal(roas, 1)}</strong>
              </span>
            )}
            {p.sold > 0 && (
              <span>
                Ticket médio
                <strong className="block text-[16px] text-fg tnum">{brlCompact(p.revenue / p.sold)}</strong>
              </span>
            )}
          </p>
        )}
        <p className="mt-auto pt-4 text-[10.5px] text-fg-2">Por produto, as plataformas mandam só o total do período: sem o dia a dia.</p>
      </Block>
    </div>
  );
}
