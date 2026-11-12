"use client";

// Aba Metas do editor: a meta de CPA de sempre (linha tracejada) e uma meta para
// qualquer KPI do dashboard, escrita em texto livre ou nos campos. O texto passa
// pelo leitor (goal-parser) e a leitura aparece para a pessoa confirmar.

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, type SelectOption } from "@/components/ui/Select";
import { TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { metric, type MetricId, type Profile } from "@/features/metrics/definitions";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { parseGoalText, type GoalParse } from "../goal-parser";
import { describeGoal, GOAL_METRICS, MAX_GOALS, withGoal, type GoalPeriod, type MetricGoal } from "../goals";

const EXAMPLES = ["CPL abaixo de 20 reais esse mês", "quero atingir um CPM de 6,50 na primeira semana", "500 leads em dezembro"];

const isMoney = (id: MetricId) => ["brl", "brlCompact"].includes(metric(id, "ecommerce").format);
const isRate = (id: MetricId) => metric(id, "ecommerce").format === "pct";

/** Valor guardado → campo (reais, % ou número). */
export function toInput(id: MetricId, v: number): string {
  const n = isMoney(id) ? v / 100 : isRate(id) ? v * 100 : v;
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
/** Campo → valor guardado. */
export function fromInput(id: MetricId, s: string): number {
  const n = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  return isMoney(id) ? Math.round(n * 100) : isRate(id) ? n / 100 : n;
}

const PERIOD_OPTIONS: SelectOption[] = [
  { value: "month", label: "Este mês" },
  { value: "firstWeek", label: "Primeira semana do mês" },
  { value: "custom", label: "De/até (datas)" },
];

type Props = {
  goals: MetricGoal[];
  onGoals: (g: MetricGoal[]) => void;
  /** KPIs que aparecem nos cards do dashboard. */
  kpis: MetricId[];
  profile: Profile;
  /** Meta de CPA de sempre (centavos). */
  cpaGoal: number;
  onCpaGoal: (cents: number) => void;
  cpaLabel: string;
};

export function GoalsPanel({ goals, onGoals, kpis, profile, cpaGoal, onCpaGoal, cpaLabel }: Props) {
  const [text, setText] = useState("");
  const [read, setRead] = useState<GoalParse | null>(null);
  const today = useMemo(() => localDate(new Date(), DEFAULT_TIME_ZONE), []);
  const label = (id: MetricId) => metric(id, profile).label;
  const options = (current?: MetricId): SelectOption[] => {
    const ids = [...new Set([...kpis, ...(current ? [current] : [])])];
    const rest = GOAL_METRICS.filter((m) => !ids.includes(m));
    return [...ids.map((m) => ({ value: m, label: label(m) })), ...rest.map((m) => ({ value: m, label: `${label(m)} (sem card)` }))];
  };
  const full = goals.length >= MAX_GOALS;
  const update = (i: number, patch: Partial<MetricGoal>) => onGoals(goals.map((g, j) => (j === i ? { ...g, ...patch, text: undefined } : g)));

  function interpret() {
    setRead(parseGoalText(text, today));
  }
  function confirm(goal: MetricGoal) {
    onGoals(withGoal(goals, goal));
    setRead(null);
    setText("");
  }
  function addBlank() {
    const free = kpis.find((m) => !goals.some((g) => g.metric === m)) ?? GOAL_METRICS.find((m) => !goals.some((g) => g.metric === m));
    if (!free) return;
    const def = metric(free, profile);
    onGoals([...goals, { metric: free, value: 0, direction: def.better === "up" ? "min" : "max", period: { kind: "month" } }]);
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold">Escreva a meta</h3>
        <p className="text-[12.5px] text-fg-2">Do jeito que você falaria. A gente mostra como entendeu antes de salvar.</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRead(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              interpret();
            }
          }}
          rows={2}
          maxLength={200}
          aria-label="Meta em texto livre"
          placeholder="Ex.: CPL abaixo de 20 reais esse mês"
          className="w-full resize-none rounded-control border border-line bg-bg px-3 py-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn.small} onClick={interpret} disabled={!text.trim() || full}>
            <Sparkles size={14} aria-hidden /> Entender meta
          </button>
          {!text &&
            EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-chip border border-line px-2 py-0.5 text-[11.5px] text-fg-2 hover:border-accent hover:text-fg">
                {ex}
              </button>
            ))}
        </div>
        {read && !read.ok && (
          <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
            {read.error}
          </p>
        )}
        {read?.ok && (
          <div className="space-y-2 rounded-control border border-accent bg-accent-soft p-3 text-[13.5px]" aria-live="polite">
            <p className="text-[12px] text-fg-2">Entendi assim:</p>
            <p className="font-semibold">{describeGoal(read.goal, profile)}</p>
            {read.assumed.map((a) => (
              <p key={a} className="text-[12px] text-fg-2">
                {a}
              </p>
            ))}
            {!kpis.includes(read.goal.metric) && <p className="text-[12px] text-fg-2">{label(read.goal.metric)} não está em nenhum card do dashboard: a meta fica salva e aparece quando o card entrar.</p>}
            {goals.some((g) => g.metric === read.goal.metric) && <p className="text-[12px] text-fg-2">Substitui a meta atual de {label(read.goal.metric)}.</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" className={btn.small} onClick={() => confirm(read.goal)}>
                Confirmar meta
              </button>
              <button type="button" className={`${btn.ghost} h-9`} onClick={() => setRead(null)}>
                Corrigir texto
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold">Metas por métrica</h3>
          <button type="button" className={`${btn.ghost} h-8 px-2 text-[13px]`} onClick={addBlank} disabled={full}>
            <Plus size={14} aria-hidden /> Nova meta
          </button>
        </div>
        {goals.length === 0 ? (
          <p className="rounded-control border border-dashed border-line p-3 text-[13px] text-fg-2">Nenhuma meta ainda. Os cards com meta mostram se estão no alvo.</p>
        ) : (
          <ul className="space-y-3">
            {goals.map((g, i) => (
              <li key={g.metric} className="space-y-2 rounded-control border border-line bg-bg p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Select ariaLabel="Métrica" size="sm" value={g.metric} onChange={(v) => !goals.some((x, j) => j !== i && x.metric === v) && update(i, { metric: v as MetricId, value: 0 })} options={options(g.metric).map((o) => ({ ...o, disabled: o.value !== g.metric && goals.some((x) => x.metric === o.value) }))} />
                  </div>
                  <button type="button" aria-label={`Tirar a meta de ${label(g.metric)}`} onClick={() => onGoals(goals.filter((_, j) => j !== i))} className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-line text-fg-2 hover:text-error-fg">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select ariaLabel="Sentido" size="sm" value={g.direction} onChange={(v) => update(i, { direction: v as MetricGoal["direction"] })} options={[{ value: "max", label: "No máximo" }, { value: "min", label: "Pelo menos" }]} />
                  <GoalValue goal={g} onChange={(value) => update(i, { value })} />
                </div>
                <Select ariaLabel="Período da meta" size="sm" value={g.period.kind} onChange={(v) => update(i, { period: periodFor(v as GoalPeriod["kind"], g.period) })} options={PERIOD_OPTIONS} />
                {g.period.kind === "custom" && (
                  <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                    <label className="space-y-1">
                      <span className="text-fg-2">De</span>
                      <input type="date" value={g.period.from} max={g.period.to} onChange={(e) => e.target.value && g.period.kind === "custom" && update(i, { period: { ...g.period, from: e.target.value } })} className="h-9 w-full rounded-control border border-line bg-bg px-2" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-fg-2">Até</span>
                      <input type="date" value={g.period.to} min={g.period.from} onChange={(e) => e.target.value && g.period.kind === "custom" && update(i, { period: { ...g.period, to: e.target.value } })} className="h-9 w-full rounded-control border border-line bg-bg px-2" />
                    </label>
                  </div>
                )}
                <p className="text-[12px] text-fg-2">{g.value > 0 ? describeGoal(g, profile) : "Informe o valor da meta."}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-line pt-4">
        <TextField
          label={cpaLabel}
          prefix="R$"
          inputMode="numeric"
          value={cpaGoal ? String(Math.round(cpaGoal / 100)) : ""}
          placeholder="60"
          hint="Vira a linha tracejada nos gráficos de custo e o alvo do pacing."
          onChange={(v) => onCpaGoal(Math.round((Number(v.replace(/\./g, "").replace(",", ".")) || 0) * 100))}
        />
      </section>
    </div>
  );
}

function periodFor(kind: GoalPeriod["kind"], prev: GoalPeriod): GoalPeriod {
  if (kind !== "custom") return { kind };
  if (prev.kind === "custom") return prev;
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { kind: "custom", from: today, to: `${today.slice(0, 8)}${String(last).padStart(2, "0")}` };
}

/** Campo do valor: guarda o texto enquanto a pessoa digita (vírgula no meio). */
function GoalValue({ goal, onChange }: { goal: MetricGoal; onChange: (v: number) => void }) {
  const [text, setText] = useState(() => (goal.value ? toInput(goal.metric, goal.value) : ""));
  const [key, setKey] = useState(`${goal.metric}:${goal.value}`);
  // meta trocada por fora (texto livre, outra métrica): o campo acompanha
  if (key !== `${goal.metric}:${goal.value}` && fromInput(goal.metric, text) !== goal.value) {
    setKey(`${goal.metric}:${goal.value}`);
    setText(goal.value ? toInput(goal.metric, goal.value) : "");
  }
  const unit = isMoney(goal.metric) ? "R$" : isRate(goal.metric) ? "%" : "";
  return (
    <div className="flex h-9 items-center rounded-control border border-line bg-bg px-2 text-[13.5px] focus-within:ring-2 focus-within:ring-accent">
      {unit === "R$" && <span className="mr-1 text-fg-2">R$</span>}
      <input
        aria-label="Valor da meta"
        inputMode="decimal"
        value={text}
        placeholder="0"
        onChange={(e) => {
          setText(e.target.value);
          const v = fromInput(goal.metric, e.target.value);
          setKey(`${goal.metric}:${v}`);
          onChange(v);
        }}
        className="min-w-0 flex-1 bg-transparent outline-none tnum"
      />
      {unit === "%" && <span className="ml-1 text-fg-2">%</span>}
    </div>
  );
}
