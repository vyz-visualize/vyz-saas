"use client";

// "Pedir ao Vyz" dentro do editor do dashboard: a pessoa escreve o que quer ver, o painel
// propõe os blocos (com o nome, o que cada um mostra e uma prévia dos números) e os cards que
// faltam; ela tira o que não quer, renomeia e aplica. Os blocos entram na aba aberta, logo
// abaixo dos cards, como qualquer mudança do editor: valem depois do Salvar.

import { Check, CirclePlay, Clock, Filter, GitCompareArrows, Info, LineChart, ListOrdered, LoaderCircle, MapPin, Search, Sparkles, Table2, Target, Users, X, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { CustomSpec } from "../layout/custom-blocks";
import { examplesFor, planLayout, type LayoutPlan, type PlanContext, type PlannedBlock } from "./planner";

export type AskHost = {
  /** Nome da aba aberta (onde os blocos entram). */
  pageName: string;
  /** Onde, na aba: "logo abaixo dos cards" (Avançado) ou "no primeiro espaço livre". */
  where: string;
  context: PlanContext;
  /** As primeiras linhas do bloco, com os números deste dashboard (prévia antes de aplicar). */
  preview?: (spec: CustomSpec) => { label: string; value: string }[] | null;
  /** Põe os blocos na aba; devolve os ids que entraram. */
  apply: (blocks: { id: string; title: string; spec: CustomSpec }[]) => string[];
  /** Leitura do pedido com IA (Claude, no servidor). null ou erro: vale a leitura local. */
  ai?: (text: string) => Promise<LayoutPlan | null>;
};

/** O que veio da IA, conferido com a regra da aba aberta (a mesma do Salvar). */
function screen(plan: LayoutPlan, ctx: PlanContext): LayoutPlan {
  const blocks = plan.blocks.filter((b) => ctx.accepts(b.id));
  const kpis = plan.kpis.filter((k) => ctx.kpiIds.includes(k) && !ctx.visibleKpis.includes(k));
  const understood = blocks.length > 0 || kpis.length > 0;
  return understood === plan.understood ? { ...plan, blocks, kpis } : { ...plan, blocks, kpis, understood, summary: understood ? plan.summary : "Não consegui montar isso nesta aba. Tente dizer o que quer ver e por qual número." };
}

type KpiOps = { add: (id: string) => void; canAdd: (id: string) => boolean; labelOf: (id: string) => string };

export function useAsk(host: AskHost | undefined, kpi: KpiOps, onApplied?: () => void) {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ plan: LayoutPlan; page: string } | null>(null);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  /** Pedido sendo lido pela IA (a resposta leva alguns segundos). */
  const [pending, setPending] = useState<{ text: string; page: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // só a resposta do último pedido conta (a pessoa pode pedir de novo ou fechar antes)
  const seq = useRef(0);
  // trocou de aba: o pedido era para a outra
  const plan = host && state && state.page === host.pageName ? state.plan : null;
  const reading = host && pending && pending.page === host.pageName ? pending.text : null;

  const run = async (t = text) => {
    if (!host || !t.trim()) return;
    const n = ++seq.current;
    const page = host.pageName;
    setText(t);
    setOff(new Set());
    setNames({});
    setDone(null);
    let plan: LayoutPlan | null = null;
    if (host.ai) {
      setState(null);
      setPending({ text: t, page });
      try {
        const got = await host.ai(t);
        plan = got && screen(got, host.context);
      } catch {
        plan = null;
      }
      if (n !== seq.current) return;
      setPending(null);
    }
    setState({ plan: plan ?? planLayout(t, host.context), page });
  };

  const clear = () => {
    seq.current++;
    setPending(null);
    setState(null);
    setDone(null);
  };

  const toggle = (id: string) =>
    setOff((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = plan ? plan.blocks.filter((b) => !off.has(b.id)) : [];
  const cards = plan ? plan.kpis.filter((k) => !off.has(`kpi:${k}`) && kpi.canAdd(k)) : [];

  const apply = () => {
    if (!host || !plan) return;
    const ids = host.apply(chosen.map((b) => ({ id: b.id, title: names[b.id]?.trim() || b.title, spec: b.spec })));
    for (const k of cards) kpi.add(k);
    const n = ids.length;
    setDone(
      n || cards.length
        ? `${n ? `${n} ${n === 1 ? "bloco novo" : "blocos novos"} em ${host.pageName}` : ""}${n && cards.length ? " e " : ""}${cards.length ? `${cards.length} ${cards.length === 1 ? "card" : "cards"}` : ""}. Salve para manter.`
        : "Esses blocos já estavam na aba.",
    );
    setState(null);
    setText("");
    onApplied?.();
    // mostra o que entrou: rola até o primeiro e acende a borda de cada um
    if (n)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const els = ids.map((id) => document.querySelector<HTMLElement>(`[data-block="${CSS.escape(id)}"]`)).filter((el): el is HTMLElement => !!el);
          els[0]?.style.setProperty("scroll-margin-top", "150px");
          els[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
          for (const el of els) el.animate([{ boxShadow: "0 0 0 3px var(--accent)" }, { boxShadow: "0 0 0 3px var(--accent)", offset: 0.6 }, { boxShadow: "0 0 0 0 transparent" }], { duration: 2200, easing: "ease-out" });
        }),
      );
  };

  return { host, text, setText, plan, reading, run, clear, off, toggle, names, setNames, chosen, cards, apply, done, inputRef, kpi };
}

export type AskState = ReturnType<typeof useAsk>;

/** A faixa de cima do editor: o campo do pedido. */
export function AskInput({ ask }: { ask: AskState }) {
  const { host, text, setText, run, inputRef, done, reading } = ask;
  if (!host) return null;
  const examples = examplesFor(host.context.profile).slice(0, 3);
  return (
    <form
      data-ask
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
      className="flex shrink-0 items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-3 py-2 md:px-4"
    >
      <span className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),color-mix(in_srgb,var(--accent)_45%,#8b5cf6))] text-on-accent shadow-[0_6px_16px_-8px_var(--accent)] sm:inline-flex" aria-hidden>
        <Sparkles size={15} />
      </span>
      <label htmlFor="vyz-ask" className="hidden shrink-0 text-[12.5px] font-semibold whitespace-nowrap lg:block">
        Pedir ao Vyz
      </label>
      <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-line bg-field pr-1 pl-4 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <input
          id="vyz-ask"
          ref={inputRef}
          data-ask-input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Pedir ao Vyz: o que você quer ver neste dashboard"
          placeholder="Diga o que quer ver. Ex.: qual produto teve a maior receita e o melhor retorno"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-2/70"
        />
        <button type="submit" disabled={!text.trim() || !!reading} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-on-accent outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
          {reading ? <LoaderCircle size={13} aria-hidden className="animate-spin" /> : <Sparkles size={13} aria-hidden />} {reading ? "Montando" : "Montar"}
        </button>
      </div>
      {done ? (
        <p role="status" className="hidden max-w-[34%] shrink-0 truncate text-[12px] font-medium text-fg-2 xl:block" title={done}>
          <Check size={13} aria-hidden className="mr-1 inline text-accent" />
          {done}
        </p>
      ) : (
        <div className="hidden shrink-0 items-center gap-1 2xl:flex" aria-label="Exemplos de pedido">
          {examples.map((ex) => (
            <button key={ex} type="button" disabled={!!reading} onClick={() => void run(ex)} className="h-7 rounded-full border border-line bg-card px-2.5 text-[11.5px] whitespace-nowrap text-fg-2 outline-none transition-colors hover:border-accent/70 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
              {ex}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

const ICON: Record<CustomSpec["type"], LucideIcon> = {
  rank: ListOrdered,
  trend: LineChart,
  breakdown: MapPin,
  searchTerms: Search,
  videos: CirclePlay,
  table: Table2,
  funnel: Filter,
  audience: Users,
  compare: GitCompareArrows,
  goals: Target,
  creatives: ListOrdered,
};
const iconOf = (b: PlannedBlock) => (b.spec.type === "breakdown" && b.spec.dimension === "hour" ? Clock : ICON[b.spec.type]);

/** O que o pedido montou (no lugar da lista de métricas, até aplicar ou fechar). */
export function AskPlan({ ask }: { ask: AskState }) {
  const { host, plan, reading, off, toggle, names, setNames, chosen, cards, apply, clear, run, kpi } = ask;
  if (!host) return null;
  if (reading) return <AskReading text={reading} onCancel={clear} />;
  if (!plan) return null;
  const total = chosen.length + cards.length;
  return (
    <div data-ask-plan className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[12.5px] leading-snug font-semibold">{plan.summary}</p>
        <button type="button" onClick={clear} aria-label="Fechar o pedido" title="Fechar o pedido" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
          <X size={14} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {plan.blocks.length > 0 && (
          <ul className="grid auto-rows-min grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {plan.blocks.map((b) => {
              const on = !off.has(b.id);
              const Icon = iconOf(b);
              const rows = host.preview?.(b.spec) ?? null;
              return (
                <li key={b.id} data-ask-block={b.id} className={`flex flex-col gap-1.5 rounded-[14px] border p-2.5 transition-colors ${on ? "border-accent/60 bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))]" : "border-line bg-bg/40 opacity-60"}`}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`Incluir ${names[b.id] ?? b.title}`}
                      onClick={() => toggle(b.id)}
                      className={`mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "border-accent bg-accent text-on-accent" : "border-line bg-card"}`}
                    >
                      {on && <Check size={12} strokeWidth={3} aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <input
                        value={names[b.id] ?? b.title}
                        onChange={(e) => setNames((n) => ({ ...n, [b.id]: e.target.value }))}
                        maxLength={60}
                        aria-label="Nome do bloco"
                        title="Clique para renomear"
                        className="w-full truncate rounded-[6px] bg-transparent text-[12.5px] leading-tight font-semibold text-fg outline-none hover:bg-surface-2/60 focus:bg-field focus:ring-1 focus:ring-accent"
                      />
                      <p className="mt-0.5 text-[11px] leading-snug text-fg-2">{b.why}</p>
                    </div>
                    <Icon size={15} aria-hidden className="mt-px shrink-0 text-fg-2" />
                  </div>
                  {rows && rows.length > 0 && (
                    <ol className="space-y-0.5 border-t border-line/60 pt-1.5">
                      {rows.map((r, i) => (
                        <li key={`${r.label}-${i}`} className="flex items-baseline gap-2 text-[11px]">
                          <span className="w-3 shrink-0 text-fg-2 tnum">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-fg">{r.label}</span>
                          <span className="shrink-0 font-semibold tnum">{r.value}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {plan.kpis.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-semibold">Cards:</span>
            {plan.kpis.map((k) => {
              const on = !off.has(`kpi:${k}`) && kpi.canAdd(k);
              return (
                <button key={k} type="button" role="checkbox" aria-checked={on} disabled={!kpi.canAdd(k)} onClick={() => toggle(`kpi:${k}`)} className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${on ? "border-accent/60 bg-accent-soft text-fg" : "border-line text-fg-2"}`}>
                  {on ? <Check size={12} aria-hidden /> : <span aria-hidden>+</span>} {kpi.labelOf(k)}
                </button>
              );
            })}
          </div>
        )}

        {plan.notes.map((n) => (
          <p key={n} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-2">
            <Info size={13} aria-hidden className="mt-px shrink-0" /> {n}
          </p>
        ))}

        {!plan.understood && (
          <div className="flex flex-wrap gap-1.5" aria-label="Exemplos de pedido">
            {plan.examples.map((ex) => (
              <button key={ex} type="button" onClick={() => void run(ex)} className="h-7 rounded-full border border-line bg-card px-2.5 text-[11.5px] text-fg-2 outline-none transition-colors hover:border-accent/70 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {plan.understood && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <button type="button" onClick={apply} disabled={!total} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40">
            <Check size={14} aria-hidden /> Aplicar no dashboard{total ? ` (${total})` : ""}
          </button>
          <p className="min-w-0 flex-1 text-[11.5px] text-fg-2">
            {chosen.length ? `Entram em ${host.pageName}, ${host.where}. Dá para tirar depois pelo ✕ de cada bloco.` : "Marque o que deve entrar."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Enquanto a IA lê o pedido: o texto pedido e o lugar dos blocos. */
function AskReading({ text, onCancel }: { text: string; onCancel: () => void }) {
  return (
    <div data-ask-reading role="status" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-start gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] leading-snug font-semibold">
          <LoaderCircle size={14} aria-hidden className="shrink-0 animate-spin text-accent" />
          Lendo o pedido e escolhendo os blocos…
        </p>
        <button type="button" onClick={onCancel} aria-label="Cancelar o pedido" title="Cancelar o pedido" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
          <X size={14} aria-hidden />
        </button>
      </div>
      <p className="truncate text-[11.5px] text-fg-2" title={text}>
        “{text}”
      </p>
      <ul aria-hidden className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex flex-col gap-2 rounded-[14px] border border-line p-2.5" style={{ opacity: 1 - i * 0.25 }}>
            <span className="h-3 w-3/4 animate-pulse rounded-full bg-surface-2" />
            <span className="h-2.5 w-full animate-pulse rounded-full bg-surface-2/70" />
            <span className="h-2.5 w-2/3 animate-pulse rounded-full bg-surface-2/70" />
          </li>
        ))}
      </ul>
    </div>
  );
}
