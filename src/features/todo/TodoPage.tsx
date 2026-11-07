"use client";

// A Fazer: as tarefas do workspace por mês (recolhível), com status, etapa e
// prioridade editáveis na linha, situação derivada do prazo, filtros, modo
// foco e exportação em CSV. O VYZ cria tarefas a partir das análises (selo
// "Novo" até alguém abrir). Responsáveis, cronograma, grupos e roteiros são
// do plano completo; nos demais aparecem travados.

import { CalendarRange, ChevronDown, Download, FolderPlus, ListChecks, Plus, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EmptyState, LockBadge, Modal, PageHeader, SelectField, TextField } from "@/components/ui/kit";
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuTrigger } from "@/components/ui/Menu";
import { UnlockButton } from "@/components/ui/Paywall";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { Switch } from "@/components/ui/controls";
import { useToast } from "@/components/ui/Toast";
import { availableIn } from "@/features/pricing/entitlements";
import { useWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import { applyPlaybook, createTask, createTaskGroup, deleteTask, markTasksSeen, updateTask } from "@/server/todo/actions";
import { EMPTY_FILTERS, filterTasks, groupByMonth, PLAYBOOKS, situationOf, tasksCsv, type TaskFilters } from "./logic";
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
  type TaskSituation,
  type TaskStage,
  type TaskStatus,
  type TodoState,
} from "./types";

// ---- cores das pílulas (tokens da marca) --------------------------------------------------------

const STATUS_TONE: Record<TaskStatus, string> = {
  planejado: "border-line text-fg-2",
  em_andamento: "border-info/40 bg-info/10 text-info",
  concluido: "border-success/40 bg-success/10 text-success dark:text-sage",
  cancelado: "border-line text-fg-2 line-through",
};
const PRIORITY_TONE: Record<TaskPriority, string> = {
  alta: "border-error/40 bg-error/10 text-error",
  media: "border-warning/50 bg-warning/10 text-fg",
  baixa: "border-line text-fg-2",
};
const SITUATION_TONE: Record<TaskSituation, string> = {
  no_prazo: "text-fg-2",
  atrasado: "text-error font-semibold",
  concluido: "text-success dark:text-sage",
  sem_prazo: "text-fg-2/70",
};

const pill = "inline-flex h-7 max-w-full items-center gap-1 rounded-chip border px-2.5 text-[12.5px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";

function PillMenu<T extends string>({ value, options, labels, tones, onChange, disabled, label }: { value: T; options: readonly T[]; labels: Record<T, string>; tones: Record<T, string>; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  if (disabled) return <span className={`${pill} ${tones[value]}`}>{labels[value]}</span>;
  return (
    <Menu>
      <MenuTrigger className={`${pill} ${tones[value]} hover:border-accent`} aria-label={`${label}: ${labels[value]}. Alterar`}>
        {labels[value]}
        <ChevronDown size={12} aria-hidden className="opacity-60" />
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>{label}</MenuLabel>
        {options.map((o) => (
          <MenuCheckItem key={o} checked={o === value} onCheckedChange={() => o !== value && onChange(o)}>
            {labels[o]}
          </MenuCheckItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

function Avatars({ ids, members }: { ids: string[]; members: TaskMember[] }) {
  const list = ids.map((id) => members.find((m) => m.userId === id)).filter((m): m is TaskMember => !!m);
  if (!list.length) return <span className="text-[12.5px] text-fg-2">Ninguém</span>;
  return (
    <span className="flex -space-x-1.5">
      {list.slice(0, 3).map((m) => (
        <span key={m.userId} title={m.name} className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-accent-soft text-[11px] font-semibold text-accent">
          {initials(m.name)}
        </span>
      ))}
      {list.length > 3 && <span className="inline-flex size-7 items-center justify-center rounded-full border-2 border-card bg-field text-[11px] text-fg-2">+{list.length - 3}</span>}
    </span>
  );
}

function AssigneeMenu({ task, members, onChange, disabled }: { task: TaskDTO; members: TaskMember[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  if (disabled) return <Avatars ids={task.assignees} members={members} />;
  return (
    <Menu>
      <MenuTrigger className="rounded-chip outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Responsáveis. Alterar">
        <Avatars ids={task.assignees} members={members} />
      </MenuTrigger>
      <MenuContent align="start">
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

const dateInput = "h-8 rounded-control border border-line bg-field px-2 text-[12.5px] text-fg outline-none focus:border-accent disabled:opacity-60";

// ---- formulário de tarefa (criar e abrir) -------------------------------------------------------

type Draft = { title: string; detail: string; status: TaskStatus; stage: TaskStage; priority: TaskPriority; dueDate: string; startDate: string; groupId: string; projectId: string; assignees: string[] };
const emptyDraft: Draft = { title: "", detail: "", status: "planejado", stage: "outro", priority: "media", dueDate: "", startDate: "", groupId: "", projectId: "", assignees: [] };
const toDraft = (t: TaskDTO): Draft => ({ title: t.title, detail: t.detail ?? "", status: t.status, stage: t.stage, priority: t.priority, dueDate: t.dueDate ?? "", startDate: t.startDate ?? "", groupId: t.groupId ?? "", projectId: t.projectId ?? "", assignees: t.assignees });

// ---- página ------------------------------------------------------------------------------------

export function TodoPage({ state }: { state: TodoState }) {
  const toast = useToast();
  const { access } = useWorkspaceSession();
  const full = state.level === "full";
  const [tasks, setTasks] = useState(state.tasks);
  const [groups, setGroups] = useState(state.groups);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ task: TaskDTO | null } | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [playOpen, setPlayOpen] = useState(false);
  const [play, setPlay] = useState({ id: PLAYBOOKS[0].id, start: state.today, projectId: "" });
  const [pending, start] = useTransition();
  const announced = useRef(false);

  // dados novos do servidor (depois de uma ação) substituem os locais
  const [synced, setSynced] = useState({ tasks: state.tasks, groups: state.groups });
  if (synced.tasks !== state.tasks || synced.groups !== state.groups) {
    setSynced({ tasks: state.tasks, groups: state.groups });
    setTasks(state.tasks);
    setGroups(state.groups);
  }
  useEffect(() => {
    if (announced.current || state.justCreated <= 0) return;
    announced.current = true;
    toast.show(state.justCreated === 1 ? "Tarefa criada pelo VYZ a partir dos dados" : `${state.justCreated} tarefas criadas pelo VYZ a partir dos dados`);
  }, [state.justCreated, toast]);

  const visible = useMemo(() => filterTasks(tasks, filters, state.today), [tasks, filters, state.today]);
  const months = useMemo(() => groupByMonth(visible), [visible]);
  const fresh = tasks.filter((t) => t.isNew).length;
  const late = tasks.filter((t) => situationOf(t, state.today) === "atrasado").length;
  const open = tasks.filter((t) => t.status === "planejado" || t.status === "em_andamento").length;
  const filtered = JSON.stringify({ ...filters, focus: false }) !== JSON.stringify({ ...EMPTY_FILTERS });
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  function patch(task: TaskDTO, p: Partial<Record<string, unknown>>, local: Partial<TaskDTO>) {
    const before = task;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, ...local, isNew: false } : t)));
    start(async () => {
      const res = await updateTask(task.id, p);
      if (!res.ok) {
        setTasks((ts) => ts.map((t) => (t.id === task.id ? before : t)));
        toast.show(res.error.message);
      }
    });
  }

  function openTask(task: TaskDTO | null) {
    setFormError(null);
    setDraft(task ? toDraft(task) : { ...emptyDraft, groupId: filters.group !== "all" ? filters.group : "" });
    setEditing({ task });
    if (task?.isNew && state.canEdit) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, isNew: false } : t)));
      void markTasksSeen([task.id]);
    }
  }

  function save() {
    if (!editing) return;
    const payload: Record<string, unknown> = {
      title: draft.title,
      detail: draft.detail || null,
      status: draft.status,
      stage: draft.stage,
      priority: draft.priority,
      dueDate: draft.dueDate || null,
      projectId: draft.projectId || null,
      ...(full ? { startDate: draft.startDate || null, groupId: draft.groupId || null, assignees: draft.assignees } : {}),
    };
    start(async () => {
      const res = editing.task ? await updateTask(editing.task.id, payload) : await createTask(payload);
      if (!res.ok) {
        setFormError(Object.values(res.error.fields ?? {})[0] ?? res.error.message);
        return;
      }
      setTasks((ts) => (editing.task ? ts.map((t) => (t.id === res.data.id ? res.data : t)) : [res.data, ...ts]));
      toast.show(editing.task ? "Tarefa atualizada." : "Tarefa criada.");
      setEditing(null);
    });
  }

  function remove(task: TaskDTO) {
    start(async () => {
      const res = await deleteTask(task.id);
      if (!res.ok) return toast.show(res.error.message);
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
      setEditing(null);
      toast.show("Tarefa apagada.");
    });
  }

  function saveGroup() {
    start(async () => {
      const res = await createTaskGroup(groupName);
      if (!res.ok) return toast.show(res.error.message);
      setGroups((g) => [...g, res.data]);
      setGroupOpen(false);
      setGroupName("");
      toast.show("Grupo criado.");
    });
  }

  function runPlaybook() {
    start(async () => {
      const res = await applyPlaybook(play.id, { start: play.start, projectId: play.projectId || null });
      if (!res.ok) return toast.show(res.error.message);
      setPlayOpen(false);
      toast.show(`${res.data.created} tarefas criadas pelo roteiro.`);
    });
  }

  function exportCsv() {
    const csv = tasksCsv(visible, { today: state.today, members: state.members, groups, full });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `a-fazer-${state.today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const toggleMonth = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const lockedBtn = (icon: React.ReactNode, text: string) => (
    <span className={`${btn.ghost} h-9 cursor-not-allowed border border-dashed border-line text-fg-2 opacity-80 hover:bg-transparent`} aria-disabled title={availableIn("avancado")}>
      {icon}
      {text}
      <LockBadge label="Avançado" />
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rotina"
        title="A Fazer"
        text="O que precisa de atenção nos seus clientes. O VYZ cria tarefas quando os números mudam e fecha sozinho quando a métrica volta ao normal."
        actions={
          state.canEdit && (
            <>
              {full ? (
                <>
                  <button type="button" onClick={() => setPlayOpen(true)} className={`${btn.ghost} h-9`}>
                    <Wand2 size={16} aria-hidden />
                    Roteiros
                  </button>
                  <button type="button" onClick={() => setGroupOpen(true)} className={`${btn.ghost} h-9`}>
                    <FolderPlus size={16} aria-hidden />
                    Novo grupo
                  </button>
                </>
              ) : (
                lockedBtn(<Wand2 size={16} aria-hidden />, "Roteiros")
              )}
              <button type="button" onClick={() => openTask(null)} className={btn.small}>
                <Plus size={16} aria-hidden />
                Nova tarefa
              </button>
            </>
          )
        }
      />

      {/* resumo */}
      <section className="grid grid-cols-3 gap-2 sm:max-w-xl">
        {[
          { n: open, label: "abertas" },
          { n: late, label: late === 1 ? "atrasada" : "atrasadas", tone: late ? "text-error" : "" },
          { n: fresh, label: fresh === 1 ? "nova do VYZ" : "novas do VYZ" },
        ].map((s) => (
          <div key={s.label} className="rounded-card border border-line bg-card px-4 py-3">
            <p className={`display text-[24px] tabular-nums ${s.tone ?? ""}`}>{s.n}</p>
            <p className="text-[12.5px] text-fg-2">{s.label}</p>
          </div>
        ))}
      </section>

      {/* filtros */}
      <section aria-label="Filtros" className="space-y-3 rounded-card border border-line bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-field px-3 focus-within:border-accent">
            <Search size={15} aria-hidden className="shrink-0 text-fg-2" />
            <span className="sr-only">Buscar tarefa</span>
            <input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Buscar por tarefa ou projeto" className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-2/70" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Switch label="Modo foco" checked={filters.focus} onChange={(v) => set("focus", v)} />
            <button type="button" onClick={exportCsv} disabled={!visible.length} className={`${btn.ghost} h-9`}>
              <Download size={15} aria-hidden />
              Exportar CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Select size="sm" ariaLabel="Status" value={filters.status} onChange={(v) => set("status", v as TaskFilters["status"])} options={[{ value: "all", label: "Todos os status" }, ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
          <Select size="sm" ariaLabel="Etapa" value={filters.stage} onChange={(v) => set("stage", v as TaskFilters["stage"])} options={[{ value: "all", label: "Todas as etapas" }, ...TASK_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))]} />
          <Select size="sm" ariaLabel="Prioridade" value={filters.priority} onChange={(v) => set("priority", v as TaskFilters["priority"])} options={[{ value: "all", label: "Toda prioridade" }, ...TASK_PRIORITIES.map((s) => ({ value: s, label: PRIORITY_LABEL[s] }))]} />
          <Select
            size="sm"
            ariaLabel="Situação"
            value={filters.situation}
            onChange={(v) => set("situation", v as TaskFilters["situation"])}
            options={[{ value: "all", label: "Toda situação" }, ...(["no_prazo", "atrasado", "sem_prazo", "concluido"] as const).map((s) => ({ value: s, label: SITUATION_LABEL[s] }))]}
          />
          {full ? (
            <>
              <Select size="sm" ariaLabel="Responsável" value={filters.assignee} onChange={(v) => set("assignee", v)} options={[{ value: "all", label: "Todos os responsáveis" }, { value: "none", label: "Sem responsável" }, ...state.members.map((m) => ({ value: m.userId, label: m.name }))]} />
              <Select size="sm" ariaLabel="Grupo" value={filters.group} onChange={(v) => set("group", v)} options={[{ value: "all", label: "Todos os grupos" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
            </>
          ) : (
            <div className="col-span-2 flex items-center gap-2 text-[12.5px] text-fg-2">
              <LockBadge label={availableIn("avancado")} />
              <span className="hidden sm:inline">Responsáveis e grupos</span>
            </div>
          )}
        </div>
        {filtered && (
          <button type="button" onClick={() => setFilters((f) => ({ ...EMPTY_FILTERS, focus: f.focus }))} className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
            Limpar filtros
          </button>
        )}
      </section>

      {!full && (
        <section className="flex flex-col gap-3 rounded-card border border-dashed border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-fg-2">
            <span className="font-semibold text-fg">Trabalhe em equipe:</span> responsáveis, cronograma, grupos e roteiros prontos (Black Friday, queda de conversão, novo cliente).
          </p>
          <UnlockButton required="avancado" current={access.tier} feature="Usar o A Fazer completo" className="shrink-0" />
        </section>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="Nada a fazer por enquanto"
          text="Quando os números de um dashboard mudarem, o VYZ cria a tarefa aqui. Você também pode criar as suas."
          action={
            state.canEdit && (
              <button type="button" onClick={() => openTask(null)} className={btn.small}>
                <Plus size={16} aria-hidden />
                Criar tarefa
              </button>
            )
          }
        />
      ) : months.length === 0 ? (
        <p className="rounded-card border border-line bg-card p-6 text-center text-[14px] text-fg-2">Nenhuma tarefa com esses filtros.</p>
      ) : (
        <div className="space-y-4">
          {months.map((m) => {
            const isClosed = closed.has(m.key);
            return (
              <section key={m.key} className="overflow-hidden rounded-card border border-line bg-card">
                <h2>
                  <button type="button" onClick={() => toggleMonth(m.key)} aria-expanded={!isClosed} className="flex w-full items-center gap-2 px-4 py-3 text-left outline-none hover:bg-accent-soft/40 focus-visible:bg-accent-soft/40">
                    <ChevronDown size={16} aria-hidden className={`text-fg-2 transition-transform duration-200 ${isClosed ? "-rotate-90" : ""}`} />
                    <span className="title text-[15px] text-fg">{m.label}</span>
                    <span className="rounded-chip bg-field px-2 py-0.5 text-[12px] text-fg-2 tabular-nums">{m.tasks.length}</span>
                  </button>
                </h2>
                {!isClosed && (
                  <div className="border-t border-line">
                    {/* cabeçalho (telas largas) */}
                    <div className={`hidden gap-3 px-4 py-2 text-[11.5px] font-medium tracking-[0.06em] text-fg-2 uppercase lg:grid ${full ? "lg:grid-cols-[minmax(0,2.4fr)_96px_130px_110px_96px_96px_200px]" : "lg:grid-cols-[minmax(0,2.6fr)_130px_110px_96px_96px_120px]"}`}>
                      <span>Tarefa</span>
                      {full && <span>Responsáveis</span>}
                      <span>Status</span>
                      <span>Etapa</span>
                      <span>Prioridade</span>
                      <span>Situação</span>
                      <span>{full ? "Cronograma" : "Prazo"}</span>
                    </div>
                    <ul className="divide-y divide-line">
                      {m.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} state={state} full={full} onOpen={() => openTask(t)} onPatch={(p, local) => patch(t, p, local)} groupName={groups.find((g) => g.id === t.groupId)?.name ?? null} />
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* criar ou abrir tarefa */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.task ? "Tarefa" : "Nova tarefa"} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          {editing?.task?.source === "insight" && (
            <p className="flex items-start gap-2 rounded-control bg-accent-soft px-3 py-2 text-[13px] text-fg">
              <Sparkles size={15} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              Criada pelo VYZ a partir dos dados{editing.task.projectName ? ` de ${editing.task.projectName}` : ""}. Se você editar, o VYZ não fecha a tarefa sozinho.
            </p>
          )}
          {editing?.task?.autoNote && <p className="text-[13px] text-fg-2">{editing.task.autoNote}</p>}
          <TextField label="Tarefa" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} disabled={!state.canEdit} />
          <div className="space-y-1">
            <label htmlFor="task-detail" className="block text-[13px] font-medium text-fg">
              Detalhe
            </label>
            <textarea
              id="task-detail"
              value={draft.detail}
              disabled={!state.canEdit}
              onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))}
              rows={3}
              className="w-full rounded-control border border-line bg-field px-3 py-2 text-[14px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Status" value={draft.status} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, status: v as TaskStatus }))} options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
            <SelectField label="Etapa" value={draft.stage} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, stage: v as TaskStage }))} options={TASK_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
            <SelectField label="Prioridade" value={draft.priority} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, priority: v as TaskPriority }))} options={TASK_PRIORITIES.map((s) => ({ value: s, label: PRIORITY_LABEL[s] }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Projeto" value={draft.projectId} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, projectId: v }))} options={[{ value: "", label: "Sem projeto" }, ...state.projects.map((p) => ({ value: p.id, label: p.name }))]} />
            <TextField label="Prazo" type="date" value={draft.dueDate} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, dueDate: v }))} />
          </div>
          {full ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Início (cronograma)" type="date" value={draft.startDate} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, startDate: v }))} />
              <SelectField label="Grupo" value={draft.groupId} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, groupId: v }))} options={[{ value: "", label: "Sem grupo" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-[13px] font-medium text-fg">Responsáveis</legend>
                <div className="flex flex-wrap gap-2">
                  {state.members.map((m) => {
                    const on = draft.assignees.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        aria-pressed={on}
                        disabled={!state.canEdit}
                        onClick={() => setDraft((d) => ({ ...d, assignees: on ? d.assignees.filter((x) => x !== m.userId) : [...d.assignees, m.userId] }))}
                        className={`${pill} ${on ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-2"}`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          ) : (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
              <LockBadge label={availableIn("avancado")} /> Responsáveis, cronograma e grupos
            </p>
          )}
          {formError && <p className="text-[13px] text-error-fg">{formError}</p>}
          {state.canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {editing?.task ? (
                <button type="button" onClick={() => remove(editing.task!)} disabled={pending} className={`${btn.ghost} h-9 text-error hover:bg-error/10`}>
                  <Trash2 size={15} aria-hidden />
                  Apagar
                </button>
              ) : (
                <span />
              )}
              <button type="submit" disabled={pending || !draft.title.trim()} className={btn.small}>
                {editing?.task ? "Salvar" : "Criar tarefa"}
              </button>
            </div>
          )}
        </form>
      </Modal>

      <Modal open={groupOpen} onClose={() => setGroupOpen(false)} title="Novo grupo">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveGroup();
          }}
          className="space-y-4"
        >
          <TextField label="Nome do grupo" value={groupName} onChange={setGroupName} placeholder="Ex.: Lançamento de verão" />
          <div className="flex justify-end">
            <button type="submit" disabled={pending || !groupName.trim()} className={btn.small}>
              Criar grupo
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={playOpen} onClose={() => setPlayOpen(false)} title="Aplicar um roteiro" wide>
        <div className="space-y-4">
          <p className="text-[13.5px] text-fg-2">Um roteiro cria um grupo com as tarefas de uma situação comum, já com etapa, prioridade e cronograma.</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Roteiro">
            {PLAYBOOKS.map((p) => {
              const on = p.id === play.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setPlay((s) => ({ ...s, id: p.id }))} className={`rounded-card border p-3 text-left transition-colors ${on ? "border-accent bg-accent-soft" : "border-line hover:border-accent"}`}>
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                    <ListChecks size={15} aria-hidden className="text-accent" />
                    {p.name}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-fg-2">{p.description}</span>
                  <span className="mt-2 block text-[12px] text-fg-2">{p.tasks.length} tarefas</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Começa em" type="date" value={play.start} onChange={(v) => setPlay((s) => ({ ...s, start: v }))} />
            <SelectField label="Projeto" value={play.projectId} onChange={(v) => setPlay((s) => ({ ...s, projectId: v }))} options={[{ value: "", label: "Sem projeto" }, ...state.projects.map((p) => ({ value: p.id, label: p.name }))]} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={runPlaybook} disabled={pending} className={btn.small}>
              <Wand2 size={15} aria-hidden />
              Aplicar roteiro
            </button>
          </div>
        </div>
      </Modal>

      {toast.node}
    </div>
  );
}

// ---- linha ------------------------------------------------------------------------------------

function TaskRow({
  task: t,
  state,
  full,
  onOpen,
  onPatch,
  groupName,
}: {
  task: TaskDTO;
  state: TodoState;
  full: boolean;
  onOpen: () => void;
  onPatch: (p: Record<string, unknown>, local: Partial<TaskDTO>) => void;
  groupName: string | null;
}) {
  const situation = situationOf(t, state.today);
  const ro = !state.canEdit;
  const setStatus = (status: TaskStatus) => onPatch({ status }, { status, completedAt: status === "concluido" || status === "cancelado" ? new Date().toISOString() : null });
  const done = t.status === "concluido" || t.status === "cancelado";
  return (
    <li className={`grid gap-x-3 gap-y-2 px-4 py-3 lg:items-center ${full ? "lg:grid-cols-[minmax(0,2.4fr)_96px_130px_110px_96px_96px_200px]" : "lg:grid-cols-[minmax(0,2.6fr)_130px_110px_96px_96px_120px]"}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <button
          type="button"
          disabled={ro}
          onClick={() => setStatus(done ? "planejado" : "concluido")}
          aria-label={done ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
          className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${done ? "border-success bg-success text-offwhite" : "border-line hover:border-accent"}`}
        >
          {done && (
            <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div className="min-w-0">
          <button type="button" onClick={onOpen} className={`text-left text-[14.5px] leading-snug font-medium break-words outline-none hover:text-accent focus-visible:underline ${done ? "text-fg-2 line-through" : "text-fg"}`}>
            {t.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-2">
            {t.isNew && <span className="rounded-chip bg-accent px-1.5 py-px text-[10.5px] font-bold tracking-wide text-on-accent uppercase">Novo</span>}
            {t.source === "insight" && (
              <span className="inline-flex items-center gap-1">
                <Sparkles size={11} aria-hidden className="text-accent" />
                VYZ
              </span>
            )}
            {t.projectName && <span>{t.projectName}</span>}
            {groupName && <span className="rounded-chip border border-line px-1.5">{groupName}</span>}
          </div>
        </div>
      </div>

      {/* no celular as pílulas vêm em linha, abaixo do título */}
      <div className="flex flex-wrap items-center gap-2 pl-7 lg:contents">
        {full && (
          <div className="lg:pl-0">
            <AssigneeMenu task={t} members={state.members} disabled={ro} onChange={(assignees) => onPatch({ assignees }, { assignees })} />
          </div>
        )}
        <div>
          <PillMenu label="Status" value={t.status} options={TASK_STATUSES} labels={STATUS_LABEL} tones={STATUS_TONE} disabled={ro} onChange={setStatus} />
        </div>
        <div>
          <PillMenu label="Etapa" value={t.stage} options={TASK_STAGES} labels={STAGE_LABEL} tones={Object.fromEntries(TASK_STAGES.map((s) => [s, "border-line text-fg"])) as Record<TaskStage, string>} disabled={ro} onChange={(stage) => onPatch({ stage }, { stage })} />
        </div>
        <div>
          <PillMenu label="Prioridade" value={t.priority} options={TASK_PRIORITIES} labels={PRIORITY_LABEL} tones={PRIORITY_TONE} disabled={ro} onChange={(priority) => onPatch({ priority }, { priority })} />
        </div>
        <div className={`text-[12.5px] ${SITUATION_TONE[situation]}`} title="Calculada pelo prazo">
          {SITUATION_LABEL[situation]}
        </div>
        <div className="flex items-center gap-1">
          {full && (
            <>
              <CalendarRange size={13} aria-hidden className="hidden shrink-0 text-fg-2 xl:block" />
              <input type="date" aria-label="Início" value={t.startDate ?? ""} max={t.dueDate ?? undefined} disabled={ro} onChange={(e) => onPatch({ startDate: e.target.value || null }, { startDate: e.target.value || null })} className={`${dateInput} w-[92px]`} />
              <span className="text-[12px] text-fg-2" aria-hidden>
                a
              </span>
            </>
          )}
          <input type="date" aria-label="Prazo" value={t.dueDate ?? ""} min={full ? (t.startDate ?? undefined) : undefined} disabled={ro} onChange={(e) => onPatch({ dueDate: e.target.value || null }, { dueDate: e.target.value || null })} className={`${dateInput} ${full ? "w-[92px]" : "w-[120px]"}`} />
        </div>
      </div>
    </li>
  );
}
