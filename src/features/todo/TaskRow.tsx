"use client";

// Linha de uma tarefa do A Fazer: concluir num toque, título que abre a tarefa, de onde ela
// veio (VYZ, projeto, grupo) e, à direita, prioridade, status, etapa, prazo e responsáveis,
// todos editáveis ali mesmo. Em lista estreita (celular ou menu aberto) as pílulas descem
// para a linha de baixo; a mudança que o VYZ pode aplicar aparece numa faixa própria.

import { CalendarDays, Check, ChevronDown, Sparkles } from "lucide-react";
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuTrigger } from "@/components/ui/Menu";
import { ApplyStrip } from "@/features/optimize/OptimizePanel";
import { addDays } from "./auto";
import { situationOf } from "./logic";
import {
  PRIORITY_LABEL,
  SITUATION_LABEL,
  STAGE_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STAGES,
  TASK_STATUSES,
  type TaskDTO,
  type TaskMember,
  type TaskPriority,
  type TaskStage,
  type TaskStatus,
  type TodoState,
} from "./types";

// ---- pílulas (tokens do painel) -------------------------------------------------------------------

const STATUS_TONE: Record<TaskStatus, string> = {
  planejado: "bg-surface-2 text-fg-2",
  em_andamento: "bg-info/12 text-info dark:bg-info/25 dark:text-[#9cc3e6]",
  concluido: "bg-accent-soft text-accent",
  cancelado: "bg-surface-2 text-fg-2 line-through",
};
const PRIORITY_TONE: Record<TaskPriority, string> = {
  alta: "bg-error-soft text-error-fg",
  media: "bg-[color-mix(in_srgb,var(--color-warning)_22%,transparent)] text-fg",
  baixa: "bg-surface-2 text-fg-2",
};
const PRIORITY_DOT: Record<TaskPriority, string> = { alta: "bg-error", media: "bg-warning", baixa: "bg-muted" };
const STAGE_TONE = Object.fromEntries(TASK_STAGES.map((s) => [s, "border border-line text-fg-2"])) as Record<TaskStage, string>;

/** Pílula de 28 px com a área de toque esticada para 40 px (o ::before). */
export const pill =
  "relative inline-flex h-7 max-w-full items-center gap-1.5 rounded-chip px-2.5 text-[12.5px] font-medium whitespace-nowrap outline-none transition-[background-color,border-color,color,box-shadow] duration-150 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";

function PillMenu<T extends string>({ value, options, labels, tones, dots, onChange, disabled, label }: { value: T; options: readonly T[]; labels: Record<T, string>; tones: Record<T, string>; dots?: Record<T, string>; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  const dot = dots && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dots[value]}`} />;
  if (disabled)
    return (
      <span className={`${pill} ${tones[value]}`}>
        {dot}
        {labels[value]}
      </span>
    );
  return (
    <Menu>
      <MenuTrigger className={`${pill} ${tones[value]} hover:ring-1 hover:ring-fg-2/40 data-[state=open]:ring-1 data-[state=open]:ring-accent`} aria-label={`${label}: ${labels[value]}. Alterar`}>
        {dot}
        <span className="truncate">{labels[value]}</span>
        <ChevronDown size={12} aria-hidden className="-mr-0.5 shrink-0 opacity-50" />
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>{label}</MenuLabel>
        {options.map((o) => (
          <MenuCheckItem key={o} checked={o === value} onCheckedChange={() => o !== value && onChange(o)}>
            {dots && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dots[o]}`} />}
            {labels[o]}
          </MenuCheckItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

// ---- responsáveis ---------------------------------------------------------------------------------

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

function Avatars({ ids, members }: { ids: string[]; members: TaskMember[] }) {
  const list = ids.map((id) => members.find((m) => m.userId === id)).filter((m): m is TaskMember => !!m);
  if (!list.length) return <span className="inline-flex h-7 items-center rounded-chip border border-dashed border-line px-2.5 text-[12.5px] text-fg-2">Ninguém</span>;
  return (
    <span className="flex -space-x-1.5">
      {list.slice(0, 3).map((m) => (
        <span key={m.userId} title={m.name} className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-accent-soft text-[10.5px] font-bold text-accent">
          {initials(m.name)}
        </span>
      ))}
      {list.length > 3 && <span className="inline-flex size-7 items-center justify-center rounded-full border-2 border-card bg-surface-2 text-[10.5px] font-semibold text-fg-2">+{list.length - 3}</span>}
    </span>
  );
}

function AssigneeMenu({ task, members, onChange, disabled }: { task: TaskDTO; members: TaskMember[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  if (disabled) return <Avatars ids={task.assignees} members={members} />;
  return (
    <Menu>
      <MenuTrigger className="relative rounded-chip outline-none before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-accent" aria-label="Responsáveis. Alterar">
        <Avatars ids={task.assignees} members={members} />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>Responsáveis</MenuLabel>
        {members.map((m) => {
          const on = task.assignees.includes(m.userId);
          return (
            <MenuCheckItem key={m.userId} checked={on} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onChange(on ? task.assignees.filter((x) => x !== m.userId) : [...task.assignees, m.userId])}>
              {m.name}
            </MenuCheckItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

// ---- prazo ----------------------------------------------------------------------------------------

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Hoje", "Amanhã", "Ontem", "19 nov" ou "5 jan 2027" (o ano só quando não é o corrente). */
export function shortDate(iso: string, today: string): string {
  if (iso === today) return "Hoje";
  if (iso === addDays(today, 1)) return "Amanhã";
  if (iso === addDays(today, -1)) return "Ontem";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}${String(y) === today.slice(0, 4) ? "" : ` ${y}`}`;
}

/**
 * Um pedaço da pílula do prazo. Quem pode editar tem um campo de data invisível por cima do
 * texto: o toque abre o calendário do aparelho e o teclado continua funcionando.
 */
function DatePart({ label, value, text, disabled, min, max, onChange }: { label: string; value: string | null; text: string; disabled?: boolean; min?: string; max?: string; onChange: (v: string | null) => void }) {
  if (disabled) return <span>{text}</span>;
  return (
    <span className="relative inline-flex items-center rounded-[6px] focus-within:ring-2 focus-within:ring-accent">
      <span aria-hidden>{text}</span>
      <input
        type="date"
        aria-label={label}
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => {
          // abre o calendário no toque (onde o navegador deixa); senão, o campo segue editável pelo teclado
          try {
            e.currentTarget.showPicker();
          } catch {}
        }}
        className="absolute -inset-x-1 -inset-y-2.5 cursor-pointer opacity-0"
      />
    </span>
  );
}

function DueChip({ task: t, today, full, disabled, onPatch }: { task: TaskDTO; today: string; full: boolean; disabled: boolean; onPatch: (p: Record<string, unknown>, local: Partial<TaskDTO>) => void }) {
  const situation = situationOf(t, today);
  const tone =
    situation === "atrasado"
      ? "bg-error-soft font-semibold text-error-fg"
      : situation === "concluido"
        ? "text-fg-2"
        : !t.dueDate
          ? "border border-dashed border-line text-fg-2"
          : t.dueDate === today
            ? "bg-accent-soft font-semibold text-accent"
            : "bg-surface-2 text-fg";
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-chip px-2.5 text-[12.5px] whitespace-nowrap tnum ${tone}`} title={`${SITUATION_LABEL[situation]} (calculada pelo prazo)`}>
      <CalendarDays size={13} aria-hidden className="shrink-0 opacity-70" />
      <span className="sr-only">{SITUATION_LABEL[situation]}: </span>
      {full && t.startDate && (
        <>
          <DatePart label="Início" value={t.startDate} text={shortDate(t.startDate, today)} disabled={disabled} max={t.dueDate ?? undefined} onChange={(startDate) => onPatch({ startDate }, { startDate })} />
          <span aria-hidden className="opacity-50">
            a
          </span>
        </>
      )}
      <DatePart label="Prazo" value={t.dueDate} text={t.dueDate ? shortDate(t.dueDate, today) : "Sem prazo"} disabled={disabled} min={full ? (t.startDate ?? undefined) : undefined} onChange={(dueDate) => onPatch({ dueDate }, { dueDate })} />
    </span>
  );
}

// ---- linha ----------------------------------------------------------------------------------------

export function TaskRow({
  task: t,
  state,
  full,
  onOpen,
  onApply,
  onPatch,
  onToggle,
  groupName,
}: {
  task: TaskDTO;
  state: TodoState;
  full: boolean;
  onOpen: () => void;
  onApply: () => void;
  onPatch: (p: Record<string, unknown>, local: Partial<TaskDTO>) => void;
  /** Concluir ou reabrir (o círculo da esquerda). */
  onToggle: (done: boolean) => void;
  groupName: string | null;
}) {
  const ro = !state.canEdit;
  const done = t.status === "concluido" || t.status === "cancelado";
  const setStatus = (status: TaskStatus) => onPatch({ status }, { status, completedAt: status === "concluido" || status === "cancelado" ? new Date().toISOString() : null });
  // a lista larga alinha as pílulas em colunas; o corte depende de quantas colunas o plano mostra
  const wide = full
    ? { row: "@[900px]:flex-row @[900px]:items-center @[900px]:gap-4", side: "@[900px]:shrink-0 @[900px]:flex-nowrap @[900px]:gap-2 @[900px]:pl-0", cell: "@[900px]:w-[var(--w)]", end: "@[900px]:justify-end" }
    : { row: "@[760px]:flex-row @[760px]:items-center @[760px]:gap-4", side: "@[760px]:shrink-0 @[760px]:flex-nowrap @[760px]:gap-2 @[760px]:pl-0", cell: "@[760px]:w-[var(--w)]", end: "@[760px]:justify-end" };
  const cell = (w: number) => ({ "--w": `${w}px` }) as React.CSSProperties;
  return (
    <li className={`flex flex-col gap-2.5 px-3 py-3 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--surface-2)_45%,transparent)] sm:px-4 ${wide.row}`}>
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <button
          type="button"
          disabled={ro}
          onClick={() => onToggle(!done)}
          aria-label={done ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
          aria-pressed={done}
          className="group/check -my-2 -ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
        >
          <span
            className={`inline-flex size-[22px] items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,transform] duration-200 ease-brand group-active/check:scale-90 ${
              done ? "border-accent bg-accent text-on-accent" : "border-fg-2/45 text-transparent group-hover/check:border-accent group-hover/check:text-accent/60 group-disabled/check:border-line"
            }`}
          >
            <Check size={13} strokeWidth={3} aria-hidden />
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-px">
          <button type="button" onClick={onOpen} className={`rounded-[4px] text-left text-[14.5px] leading-snug font-medium break-words outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent ${done ? "text-fg-2 line-through decoration-fg-2/50" : "text-fg"}`}>
            {t.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-2">
            {t.isNew && <span className="rounded-chip bg-accent px-1.5 py-px text-[10.5px] font-bold tracking-wide text-on-accent uppercase">Novo</span>}
            {t.source === "insight" && (
              <span className="inline-flex items-center gap-1 font-medium text-fg">
                <Sparkles size={12} aria-hidden className="text-accent" />
                VYZ
              </span>
            )}
            {t.projectName && <span className="max-w-full truncate">{t.projectName}</span>}
            {groupName && <span className="max-w-full truncate rounded-chip border border-line px-1.5 text-[12px]">{groupName}</span>}
          </div>
          {t.action && !done && state.canEdit && <ApplyStrip action={t.action} onClick={onApply} className="mt-2.5" />}
        </div>
      </div>

      {/* em lista estreita as pílulas vêm em linha, abaixo do título */}
      <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-3 pl-[34px] ${wide.side}`}>
        <div className={wide.cell} style={cell(92)}>
          <PillMenu label="Prioridade" value={t.priority} options={TASK_PRIORITIES} labels={PRIORITY_LABEL} tones={PRIORITY_TONE} dots={PRIORITY_DOT} disabled={ro} onChange={(priority) => onPatch({ priority }, { priority })} />
        </div>
        <div className={wide.cell} style={cell(128)}>
          <PillMenu label="Status" value={t.status} options={TASK_STATUSES} labels={STATUS_LABEL} tones={STATUS_TONE} disabled={ro} onChange={setStatus} />
        </div>
        <div className={wide.cell} style={cell(112)}>
          <PillMenu label="Etapa" value={t.stage} options={TASK_STAGES} labels={STAGE_LABEL} tones={STAGE_TONE} disabled={ro} onChange={(stage) => onPatch({ stage }, { stage })} />
        </div>
        <div className={wide.cell} style={cell(full ? 150 : 108)}>
          <DueChip task={t} today={state.today} full={full} disabled={ro} onPatch={onPatch} />
        </div>
        {full && (
          <div className={`flex ${wide.cell} ${wide.end}`} style={cell(72)}>
            <AssigneeMenu task={t} members={state.members} disabled={ro} onChange={(assignees) => onPatch({ assignees }, { assignees })} />
          </div>
        )}
      </div>
    </li>
  );
}
