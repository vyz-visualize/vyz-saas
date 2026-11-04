"use client";

// Comparativo de criativos (Avançado). Este arquivo só é baixado por quem tem o
// recurso e abriu a aba. "Personalizar métricas" não se aplica aqui: mostra todas
// as métricas que o anúncio tem.

import { AlertTriangle, ChevronDown, Clipboard, ExternalLink, Plus, Replace, Sparkles, Trash2, Trophy, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortalContainer } from "@/components/ui/portal";
import { SelectField } from "@/components/ui/Select";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { creativeAnalysis, type CreativeAnalysis } from "@/features/agent/engine/creative-analysis";
import type { CompareAd, CreativesData } from "../types";
import { Chip, NoData, Panel, Thumb } from "../ui";
import { CompareChart } from "./CompareChart";
import { adStats, axisLabel, chartRange, compareTable, COMPARE_METRICS, defaultAds, diffLabel, evolution, EVOLUTION_BLOCK_NOTE, objectiveHighlights, objectiveWarning, shortName, type AdStats, type CompareMode, type CompareGroup } from "./compare";
import { MAX_COMPARE, MIN_COMPARE } from "./limits";
import { OBJECTIVE_LABEL, objectiveKey } from "./objectives";
import { setQueryParam } from "./query";

/** Uma cor por anúncio. Mesmas cores nos temas claro e escuro. */
const COLORS = ["var(--accent)", "#C2703D", "#5B7FA6"] as const;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const postPlace = (url: string) => (/instagram/i.test(url) ? "Instagram" : /facebook|fb\.com/i.test(url) ? "Facebook" : null);

export function CompareView({ data }: { data: Pick<CreativesData, "compare" | "initialAds" | "hideSpend" | "currency"> }) {
  const { compare: pool, hideSpend, currency } = data;
  // sem anúncios na URL, já abre comparando os 2 de maior investimento
  const [preselected] = useState(() => !data.initialAds.some((id) => pool.some((a) => a.id === id)));
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const ok = preselected ? defaultAds(pool, MIN_COMPARE) : data.initialAds.filter((id) => pool.some((a) => a.id === id)).slice(0, MAX_COMPARE);
    return ok.length >= MIN_COMPARE ? ok : [...ok, ...Array<null>(MIN_COMPARE - ok.length).fill(null)];
  });
  const [mode, setMode] = useState<CompareMode>("day");
  const byId = useMemo(() => new Map(pool.map((a) => [a.id, a])), [pool]);
  const chosen = slots.filter((id): id is string => !!id && byId.has(id));
  const key = chosen.join(",");
  const first = useRef(true);

  useEffect(() => {
    // a URL já diz o que está aberto, a não ser que a escolha tenha vindo do padrão
    if (first.current) {
      first.current = false;
      if (!preselected) return;
    }
    setQueryParam("anuncios", key || null);
  }, [key, preselected]);

  const stats = useMemo(() => key.split(",").flatMap((id) => (byId.has(id) ? [adStats(byId.get(id)!)] : [])), [byId, key]);
  const colorOf = (id: string) => COLORS[slots.indexOf(id)] ?? COLORS[0];
  const colors = stats.map((s) => colorOf(s.ad.id));
  const warning = objectiveWarning(stats, hideSpend);

  if (!pool.length) return <NoData text="Nenhum anúncio veiculou no período." />;

  const setSlot = (i: number, id: string) => setSlots((s) => s.map((v, x) => (x === i ? id : v)));
  // o card mantém a posição (e a cor): com o mínimo de 2, volta a ficar vazio em vez de sumir
  const remove = (i: number) => setSlots((s) => (s.length > MIN_COMPARE ? s.filter((_, x) => x !== i) : s.map((v, x) => (x === i ? null : v))));

  return (
    <div className="space-y-3">
      <ul className={`grid grid-cols-1 gap-3 @[520px]:grid-cols-2 ${slots.length > 2 ? "@[840px]:grid-cols-3" : ""}`}>
        {slots.map((id, i) => {
          const s = stats.find((x) => x.ad.id === id);
          return (
            <li key={`${i}-${id ?? "vazio"}`} className="min-w-0">
              {s ? <AdCard s={s} color={COLORS[i]} pool={pool} chosen={chosen} onPick={(next) => setSlot(i, next)} onRemove={() => remove(i)} /> : <EmptySlot pool={pool} chosen={chosen} onPick={(next) => setSlot(i, next)} onRemove={slots.length > MIN_COMPARE ? () => remove(i) : undefined} />}
            </li>
          );
        })}
      </ul>

      {slots.length < MAX_COMPARE && (
        <button type="button" onClick={() => setSlots((s) => [...s, null])} className={`${btn.ghost} h-9 border border-line text-[13px] whitespace-nowrap`}>
          <Plus size={14} aria-hidden /> Adicionar card (até {MAX_COMPARE})
        </button>
      )}

      {warning && (
        <p role="note" className="flex items-start gap-2 rounded-card border border-warning/60 bg-warning/10 px-3 py-2.5 text-[13px] leading-snug text-fg">
          <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-warning" />
          {warning}
        </p>
      )}

      {stats.length < MIN_COMPARE ? (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-fg-2">Escolha pelo menos {MIN_COMPARE} anúncios para comparar.</p>
      ) : (
        <>
          <Panel
            title="Métricas lado a lado"
            subtitle="Todas as métricas disponíveis de cada anúncio, no período selecionado."
            aside={
              <Segmented<CompareMode>
                label="Como ver os números"
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "day", label: "Média/dia" },
                  { value: "total", label: "Total" },
                ]}
              />
            }
          >
            <CompareTable stats={stats} colors={colors} mode={mode} hideSpend={hideSpend} currency={currency} />
          </Panel>
          <EvolutionPanel stats={stats} colors={colors} hideSpend={hideSpend} currency={currency} />
          <AnalysisPanel stats={stats} hideSpend={hideSpend} currency={currency} />
        </>
      )}
    </div>
  );
}

// ---- cards -----------------------------------------------------------------------------------------

function AdCard({ s, color, pool, chosen, onPick, onRemove }: { s: AdStats; color: string; pool: CompareAd[]; chosen: string[]; onPick: (id: string) => void; onRemove: () => void }) {
  const { ad } = s;
  const place = ad.postUrl?.startsWith("https://") ? postPlace(ad.postUrl) : null;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-card" aria-label={ad.name}>
      <span className="h-1.5 shrink-0" style={{ background: color }} aria-hidden />
      <Thumb seed={ad.id} url={ad.thumbnailUrl} label={ad.headline ?? ad.name} badge={ad.format} className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="accent">{s.objectiveLabel}</Chip>
          {ad.status !== "active" && <Chip>{ad.status === "paused" ? "Pausado" : ad.status}</Chip>}
          {s.fatigue && <Chip tone="bad">Cansando</Chip>}
        </div>
        <h4 className="text-[14px] leading-snug font-semibold text-fg [overflow-wrap:anywhere]" title={ad.name}>
          {ad.name}
        </h4>
        <p className="text-[12px] text-fg-2 tnum">
          {s.activeDays === 1 ? "1 dia veiculado" : `${s.activeDays} dias veiculados`} no período · {ad.campaignName}
        </p>
        {s.fatigue && <p className="text-[12px] leading-snug text-error-fg">CTR caindo ao longo dos dias de veiculação: a frequência subiu e o CTR caiu na 2ª metade.</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {place && (
            <a href={ad.postUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-control border border-line px-2.5 text-[12.5px] font-medium whitespace-nowrap outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
              <ExternalLink size={13} aria-hidden /> Ver post
              <span className="sr-only"> no {place}</span>
            </a>
          )}
          <AdPicker pool={pool} chosen={chosen} current={ad.id} onPick={onPick} label="Trocar" icon={<Replace size={13} aria-hidden />} />
          <button type="button" onClick={onRemove} aria-label={`Remover ${ad.name}`} title="Remover card" className="ml-auto inline-flex size-8 items-center justify-center rounded-control border border-line text-fg-2 outline-none hover:border-error hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent">
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptySlot({ pool, chosen, onPick, onRemove }: { pool: CompareAd[]; chosen: string[]; onPick: (id: string) => void; onRemove?: () => void }) {
  return (
    <div className="relative flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line p-4">
      <p className="text-[13px] text-fg-2">Escolha um anúncio</p>
      <AdPicker pool={pool} chosen={chosen} onPick={onPick} label="Escolher" icon={<Plus size={13} aria-hidden />} />
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remover card" className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-control text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}

function AdPicker({ pool, chosen, current, onPick, label, icon }: { pool: CompareAd[]; chosen: string[]; current?: string; onPick: (id: string) => void; label: string; icon: React.ReactNode }) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = fold(query.trim());
    return pool.filter((a) => !q || fold(`${a.name} ${a.campaignName} ${OBJECTIVE_LABEL[objectiveKey(a.objective)]}`).includes(q));
  }, [pool, query]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="inline-flex h-8 items-center gap-1 rounded-control border border-line px-2.5 text-[12.5px] font-medium whitespace-nowrap outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
        {icon} {label}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content sideOffset={4} collisionPadding={8} align="start" className="pop z-[90] flex max-h-[min(60dvh,var(--radix-popover-content-available-height))] w-[min(22rem,calc(100vw-16px))] flex-col rounded-card border border-line bg-card">
          <div className="border-b border-line p-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar anúncio" placeholder="Buscar anúncio" className="h-9 w-full rounded-control border border-line bg-field px-2.5 text-[14px] outline-none focus:border-accent" />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {list.map((a) => {
              const taken = chosen.includes(a.id) && a.id !== current;
              const isCurrent = a.id === current;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={taken || isCurrent}
                    onClick={() => {
                      onPick(a.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left outline-none hover:bg-accent-soft focus-visible:bg-accent-soft disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Thumb seed={a.id} url={a.thumbnailUrl} label="" className="h-9 w-12 shrink-0 rounded-[6px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{a.name}</span>
                      <span className="block truncate text-[11.5px] text-fg-2">{taken || isCurrent ? "já selecionado" : OBJECTIVE_LABEL[objectiveKey(a.objective)]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="px-2 py-4 text-center text-[13px] text-fg-2">Nenhum anúncio com esse nome.</li>}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---- tabela ----------------------------------------------------------------------------------------

function CompareTable({ stats, colors, mode, hideSpend, currency }: { stats: AdStats[]; colors: string[]; mode: CompareMode; hideSpend: boolean; currency: string }) {
  const groups = useMemo(() => compareTable(stats, mode, { hideSpend, currency }), [stats, mode, hideSpend, currency]);
  const highlights = useMemo(() => objectiveHighlights(stats, mode, { hideSpend, currency }), [stats, mode, hideSpend, currency]);
  const [closed, setClosed] = useState<ReadonlySet<CompareGroup>>(new Set());
  const toggle = (g: CompareGroup) =>
    setClosed((c) => {
      const next = new Set(c);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  const label = "sticky left-0 z-10 bg-card py-2 pr-3 text-left align-top";
  return (
    // a única rolagem horizontal da página: tabela de 3 anúncios no celular, com a coluna de métricas fixa
    <div className="-mx-4 overflow-x-auto px-4 contain-paint">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[12.5px] tnum" style={{ minWidth: Math.max(430, (stats.length * 110) / 0.65) }}>
        <caption className="sr-only">Comparativo de {stats.length} anúncios</caption>
        <colgroup>
          <col style={{ width: "35%" }} />
          {stats.map((s) => (
            <col key={s.ad.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${label} border-b border-line text-[11px] font-medium text-fg-2`}>
              Métrica
            </th>
            {stats.map((s, i) => (
              <th key={s.ad.id} scope="col" title={s.ad.name} className="border-b border-line px-2 py-2 text-right align-bottom text-[12px] font-semibold text-fg">
                <span className="mb-1 ml-auto block h-1 w-8 rounded-full" style={{ background: colors[i] }} aria-hidden />
                <span className="line-clamp-2 [overflow-wrap:anywhere]">{shortName(s.ad.name)}</span>
              </th>
            ))}
          </tr>
          <tr>
            <th scope="row" className={`${label} border-b border-line text-[11.5px] font-semibold text-fg`}>
              Destaque por objetivo
            </th>
            {stats.map((s, i) => {
              const mine = highlights.filter((h) => h.winner === i);
              return (
                <td key={s.ad.id} className="border-b border-line px-2 py-2 text-right align-top text-[11.5px] leading-snug">
                  {mine.length ? (
                    mine.map((h) => (
                      <span key={h.objective} className="block font-medium text-accent">
                        <Trophy size={11} aria-hidden className="mr-1 inline align-[-1px]" />
                        {h.alone ? `Único em ${h.label}` : `Melhor em ${h.label}`}
                        <span className="block font-normal text-fg-2">
                          {h.metric.label}: {h.text}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-fg-2">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        </thead>
        {groups.map((g) => {
          const open = !closed.has(g.group);
          return (
            <tbody key={g.group}>
              <tr>
                <th colSpan={stats.length + 1} scope="colgroup" className="border-b border-line p-0 text-left">
                  <span className="sticky left-0 inline-block">
                    <button type="button" aria-expanded={open} onClick={() => toggle(g.group)} className="inline-flex items-center gap-1 rounded-[4px] py-2 text-[12px] font-semibold whitespace-nowrap text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      <ChevronDown size={14} aria-hidden className={`transition-transform duration-150 ${open ? "" : "-rotate-90"}`} />
                      {g.label}
                    </button>
                  </span>
                </th>
              </tr>
              {open &&
                g.rows.map((r) => (
                  <tr key={r.metric.id}>
                    <th scope="row" title={r.metric.help} className={`${label} border-b border-line/60 font-normal text-fg-2 @[480px]:whitespace-nowrap`}>
                      {r.metric.label}
                      {r.metric.better === "down" && <span className="block text-[10.5px] text-fg-2/80">menor é melhor</span>}
                    </th>
                    {r.cells.map((c, i) => (
                      <td key={stats[i].ad.id} className="border-b border-line/60 px-2 py-2 text-right align-top">
                        <span className={c.isBest ? "font-semibold text-accent" : "text-fg"}>
                          {c.isBest && <Trophy size={12} aria-label="Melhor valor" className="mr-1 inline align-[-2px]" />}
                          {c.text}
                        </span>
                        {c.diff != null && <span className="block text-[10.5px] whitespace-nowrap text-fg-2">{diffLabel(c.diff)}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

// ---- evolução ---------------------------------------------------------------------------------------

function EvolutionPanel({ stats, colors, hideSpend, currency }: { stats: AdStats[]; colors: string[]; hideSpend: boolean; currency: string }) {
  const options = useMemo(() => COMPARE_METRICS.filter((m) => !(hideSpend && m.spendDerived) && stats.some((s) => m.value(s.sums) != null)), [stats, hideSpend]);
  const [picked, setPicked] = useState("linkCtr");
  const metric = options.find((m) => m.id === picked) ?? options[0];
  const ev = useMemo(() => (metric ? evolution(stats.map((s) => s.ad), metric) : null), [stats, metric]);
  if (!metric || !ev) return null;
  return (
    <Panel
      title="Evolução por dia de veiculação"
      subtitle="Alinhada pelo dia de veiculação de cada anúncio (Dia 1, Dia 2…), não pela data."
      aside={
        <div className="w-52 max-w-full">
          <SelectField label="Métrica" size="sm" value={metric.id} onChange={setPicked} options={options.map((m) => ({ value: m.id, label: m.label }))} />
        </div>
      }
    >
      <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-fg-2" aria-hidden>
        {stats.map((s, i) => (
          <li key={s.ad.id} className="inline-flex min-w-0 items-center gap-1.5" title={s.ad.name}>
            <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: colors[i] }} />
            <span className="max-w-[14rem] truncate">{shortName(s.ad.name)}</span>
          </li>
        ))}
      </ul>
      <CompareChart labels={ev.labels} series={ev.series} colors={colors} range={chartRange(ev.series.flat(), metric)} format={(v, step) => axisLabel(metric, v, step, currency)} summary={`${metric.label} por dia de veiculação`} />
      {ev.blocked && <p className="mt-2 text-[12px] leading-snug text-fg-2">{EVOLUTION_BLOCK_NOTE}</p>}
    </Panel>
  );
}

// ---- análise ----------------------------------------------------------------------------------------

function AnalysisPanel({ stats, hideSpend, currency }: { stats: AdStats[]; hideSpend: boolean; currency: string }) {
  const [analysis, setAnalysis] = useState<CreativeAnalysis | null>(null);
  const [copied, setCopied] = useState(false);
  const key = stats.map((s) => s.ad.id).join(",");
  const [forKey, setForKey] = useState(key);
  // trocou os anúncios: a análise anterior não vale mais
  if (forKey !== key) {
    setForKey(key);
    setAnalysis(null);
    setCopied(false);
  }
  const copy = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  };
  return (
    <Panel
      title="Análise"
      subtitle="Texto em linguagem simples, feito só com os números acima."
      aside={
        analysis ? (
          <button type="button" onClick={() => void copy()} className={`${btn.ghost} h-8 border border-line text-[12.5px] whitespace-nowrap`}>
            <Clipboard size={13} aria-hidden /> {copied ? "Copiado" : "Copiar texto"}
          </button>
        ) : undefined
      }
    >
      {analysis ? (
        <div className="space-y-3 text-[13.5px] leading-relaxed">
          {analysis.perAd.map((a) => (
            <p key={a.id}>
              <strong className="font-semibold">{a.name}.</strong> <span className="text-fg-2">{a.text}</span>
            </p>
          ))}
          <p className="border-t border-line pt-3">
            <strong className="font-semibold">Comparação.</strong> <span className="text-fg-2">{analysis.comparison}</span>
          </p>
        </div>
      ) : (
        <button type="button" onClick={() => setAnalysis(creativeAnalysis(stats, { hideSpend, currency }))} className={`${btn.small} whitespace-nowrap`}>
          <Sparkles size={14} aria-hidden /> Gerar análise
        </button>
      )}
    </Panel>
  );
}
