"use client";

// A Fazer: o que precisa de atenção agora. No topo, os números que viram filtro num toque
// (abertas, para hoje, atrasadas, concluídas) e o aviso das tarefas novas do VYZ. A lista
// vem agrupada pelo prazo (atrasadas, hoje, próximos 7 dias…) ou por mês, com status, etapa,
// prioridade e prazo editáveis na linha (TaskRow), busca, filtros, modo foco e exportação
// em CSV. O VYZ cria tarefas a partir das análises (selo "Novo" até alguém abrir). Tarefa
// com mudança proposta ganha "Aplicar" (vai direto para a plataforma, com registro e
// Desfazer); no Avançado há o automático por projeto. Responsáveis, cronograma, grupos e
// roteiros são do plano completo; nos demais aparecem travados.

import { AlarmClock, Bot, CalendarCheck, Check, ChevronDown, CircleCheck, Download, FolderPlus, ListChecks, ListTodo, MoreHorizontal, Plus, Search, SlidersHorizontal, Sparkles, Trash2, Users, Wand2, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Badge, EmptyState, LockBadge, Modal, PageHeader, SelectField, TextField } from "@/components/ui/kit";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { UnlockButton } from "@/components/ui/Paywall";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { Switch } from "@/components/ui/controls";
import { useToast } from "@/components/ui/Toast";
import { availableIn } from "@/features/pricing/entitlements";
import { useWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import { ApplyModal, AutopilotButton, AutopilotModal, autopilotOn, RunsSection } from "@/features/optimize/OptimizePanel";
import type { OptimizationAction } from "@/features/optimize/actions";
import { applyPlaybook, createTask, createTaskGroup, deleteTask, markTasksSeen, updateTask } from "@/server/todo/actions";
import { addDays } from "./auto";
import { EMPTY_FILTERS, filterTasks, groupByMonth, PLAYBOOKS, situationOf, sortTasks, tasksCsv, type TaskFilters } from "./logic";
import { pill, TaskRow } from "./TaskRow";
import { isOpen, PRIORITY_LABEL, SITUATION_LABEL, STAGE_LABEL, STATUS_LABEL, TASK_PRIORITIES, TASK_STAGES, TASK_STATUSES, type TaskDTO, type TaskPriority, type TaskStage, type TaskStatus, type TodoState } from "./types";

// ---- visões rápidas (os cartões do topo) ----------------------------------------------------------

type View = "all" | "open" | "today" | "late" | "done" | "new";

const inView = (t: TaskDTO, view: View, today: string): boolean =>
  view === "all"
    ? true
    : view === "open"
      ? isOpen(t.status)
      : view === "today"
        ? isOpen(t.status) && t.dueDate === today
        : view === "late"
          ? situationOf(t, today) === "atrasado"
          : view === "done"
            ? t.status === "concluido"
            : t.isNew;

// ---- grupos pelo prazo ------------------------------------------------------------------------------

type Group = { key: string; label: string; tasks: TaskDTO[]; tone?: "late" | "today" };

const BUCKETS = [
  { key: "late", label: "Atrasadas", tone: "late" },
  { key: "today", label: "Hoje", tone: "today" },
  { key: "week", label: "Próximos 7 dias" },
  { key: "later", label: "Mais adiante" },
  { key: "none", label: "Sem prazo" },
  { key: "done", label: "Concluídas" },
] as const;

function bucketOf(t: TaskDTO, today: string): (typeof BUCKETS)[number]["key"] {
  if (!isOpen(t.status)) return "done";
  if (!t.dueDate) return "none";
  if (t.dueDate < today) return "late";
  if (t.dueDate === today) return "today";
  return t.dueDate <= addDays(today, 7) ? "week" : "later";
}

/** O que fazer primeiro vem primeiro: atrasadas, hoje, a semana, o resto, e as encerradas por último. */
function groupByDue(tasks: TaskDTO[], today: string): Group[] {
  return BUCKETS.map((b) => {
    const list = sortTasks(tasks.filter((t) => bucketOf(t, today) === b.key));
    const label = b.key === "done" && list.some((t) => t.status === "cancelado") ? "Concluídas e canceladas" : b.label;
    return { key: b.key, label, tasks: list, tone: "tone" in b ? b.tone : undefined };
  }).filter((g) => g.tasks.length > 0);
}

// ---- formulário de tarefa (criar e abrir) -------------------------------------------------------

type Draft = { title: string; detail: string; status: TaskStatus; stage: TaskStage; priority: TaskPriority; dueDate: string; startDate: string; groupId: string; projectId: string; assignees: string[] };
const emptyDraft: Draft = { title: "", detail: "", status: "planejado", stage: "outro", priority: "media", dueDate: "", startDate: "", groupId: "", projectId: "", assignees: [] };
const toDraft = (t: TaskDTO): Draft => ({ title: t.title, detail: t.detail ?? "", status: t.status, stage: t.stage, priority: t.priority, dueDate: t.dueDate ?? "", startDate: t.startDate ?? "", groupId: t.groupId ?? "", projectId: t.projectId ?? "", assignees: t.assignees });

// ---- peças da página ------------------------------------------------------------------------------

/** Número do topo que também filtra a lista (toque de novo para voltar a ver tudo). */
function ViewTile({ label, n, hint, icon, active, tone = "", onClick }: { label: string; n: number; hint: string; icon: ReactNode; active: boolean; tone?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group rounded-card border p-3.5 text-left transition-colors duration-150 sm:p-4 ${active ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_55%,var(--card))]" : "border-line bg-card hover:border-fg-2/40"}`}
    >
      <span className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-fg-2">
        <span className="truncate">{label}</span>
        <span className={`shrink-0 transition-colors ${active ? "text-accent" : "text-fg-2/60 group-hover:text-fg-2"}`}>{icon}</span>
      </span>
      <span className={`mt-2 block text-[26px] leading-none font-bold tracking-[-0.03em] tnum sm:text-[28px] ${tone}`}>{n}</span>
      <span className="mt-1.5 block truncate text-[12px] text-fg-2">{hint}</span>
    </button>
  );
}

/** Estado vazio que orienta: como as tarefas chegam e o que dá para fazer com elas. */
const HOW = [
  { icon: Sparkles, title: "O VYZ avisa", text: "Quando um número foge do normal num dashboard, a tarefa aparece aqui." },
  { icon: Zap, title: "Aplique num toque", text: "Pausar campanha ou ajustar o orçamento direto daqui, com Desfazer." },
  { icon: CircleCheck, title: "Fecha sozinho", text: "Quando a métrica volta ao normal, o VYZ conclui a tarefa." },
];

// variações dos botões do painel: classes trocadas, não somadas (no Tailwind a ordem na string não decide quem vence)
const quietDanger = btn.quiet.replace("text-fg-2 hover:bg-surface-2 hover:text-fg", "text-error-fg hover:bg-error-soft");
const subtleTall = btn.subtle.replace("h-9", "h-10");
const subtleIcon = btn.subtle.replace("h-9 px-3.5", "size-9 max-sm:size-11");

const textarea = "w-full rounded-control border border-line bg-field px-3 py-2 text-[14px] leading-relaxed text-fg outline-none transition-colors hover:border-fg-2/50 focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 max-sm:text-[16px]";

// ---- página ------------------------------------------------------------------------------------

export function TodoPage({ state }: { state: TodoState }) {
  const toast = useToast();
  const { access } = useWorkspaceSession();
  const full = state.level === "full";
  const [tasks, setTasks] = useState(state.tasks);
  const [groups, setGroups] = useState(state.groups);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [view, setView] = useState<View>("all");
  const [groupMode, setGroupMode] = useState<"prazo" | "mes">("prazo");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // as encerradas começam recolhidas: o que importa é o que falta fazer
  const [closed, setClosed] = useState<Set<string>>(new Set(["done"]));
  const [editing, setEditing] = useState<{ task: TaskDTO | null } | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [playOpen, setPlayOpen] = useState(false);
  const [play, setPlay] = useState({ id: PLAYBOOKS[0].id, start: state.today, projectId: "" });
  const [pending, start] = useTransition();
  const [applying, setApplying] = useState<{ id: string; title: string; action: OptimizationAction } | null>(null);
  const [pilotOpen, setPilotOpen] = useState(false);
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

  const visible = useMemo(() => filterTasks(tasks, filters, state.today).filter((t) => inView(t, view, state.today)), [tasks, filters, view, state.today]);
  const sections = useMemo<Group[]>(() => (groupMode === "prazo" ? groupByDue(visible, state.today) : groupByMonth(visible)), [visible, groupMode, state.today]);
  const fresh = tasks.filter((t) => t.isNew).length;
  const late = tasks.filter((t) => situationOf(t, state.today) === "atrasado").length;
  const open = tasks.filter((t) => isOpen(t.status)).length;
  const running = tasks.filter((t) => t.status === "em_andamento").length;
  const dueToday = tasks.filter((t) => isOpen(t.status) && t.dueDate === state.today).length;
  const finished = tasks.filter((t) => t.status === "concluido").length;
  const selects = [filters.status, filters.stage, filters.priority, filters.situation, filters.assignee, filters.group].filter((v) => v !== "all").length;
  const filtered = selects > 0 || filters.q.trim() !== "" || view !== "all";
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const pilots = autopilotOn(state);

  function clearFilters() {
    setFilters((f) => ({ ...EMPTY_FILTERS, focus: f.focus }));
    setView("all");
  }

  function pickView(v: View) {
    setView((cur) => (cur === v ? "all" : v));
  }

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

  /** O círculo da linha: conclui (ou reabre) e avisa. */
  function toggleDone(task: TaskDTO, done: boolean) {
    const status: TaskStatus = done ? "concluido" : "planejado";
    patch(task, { status }, { status, completedAt: done ? new Date().toISOString() : null });
    toast.show(done ? "Tarefa concluída." : "Tarefa reaberta.");
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

  const toggleSection = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const newTaskBtn = (label: string) => (
    <button type="button" onClick={() => openTask(null)} className={`${btn.small} max-sm:h-11`}>
      <Plus size={16} aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        eyebrow="Rotina"
        title="A Fazer"
        text="O que precisa de atenção nos seus clientes. O VYZ cria tarefas quando os números mudam e fecha sozinho quando a métrica volta ao normal."
        actions={
          state.canEdit && (
            <>
              {/* em tela larga, o que o plano libera fica à vista; nas menores (e o que está travado), no menu ao lado do botão principal */}
              {(state.autopilot.allowed || full) && (
                <div className="flex items-center gap-1 max-xl:hidden">
                  {state.autopilot.allowed && <AutopilotButton state={state} onOpen={() => setPilotOpen(true)} />}
                  {full && (
                    <>
                      <button type="button" onClick={() => setPlayOpen(true)} className={btn.quiet}>
                        <Wand2 size={16} aria-hidden />
                        Roteiros
                      </button>
                      <button type="button" onClick={() => setGroupOpen(true)} className={btn.quiet}>
                        <FolderPlus size={16} aria-hidden />
                        Novo grupo
                      </button>
                    </>
                  )}
                </div>
              )}
              <Menu>
                <MenuTrigger aria-label="Mais ações" className={`${subtleIcon} max-sm:!flex-none ${state.autopilot.allowed && full ? "xl:hidden" : ""}`}>
                  <MoreHorizontal size={18} aria-hidden />
                </MenuTrigger>
                <MenuContent align="end" className="min-w-[15rem]">
                  <MenuItem icon={<Bot size={15} />} disabled={!state.autopilot.allowed} onSelect={() => setPilotOpen(true)} className="h-10">
                    <span className="flex-1">Automático{pilots ? ` · ${pilots} ${pilots === 1 ? "projeto" : "projetos"}` : ""}</span>
                    {!state.autopilot.allowed && <LockBadge label="Avançado" />}
                  </MenuItem>
                  <MenuItem icon={<Wand2 size={15} />} disabled={!full} onSelect={() => setPlayOpen(true)} className="h-10">
                    <span className="flex-1">Roteiros</span>
                    {!full && <LockBadge label="Avançado" />}
                  </MenuItem>
                  <MenuItem icon={<FolderPlus size={15} />} disabled={!full} onSelect={() => setGroupOpen(true)} className="h-10">
                    <span className="flex-1">Novo grupo</span>
                    {!full && <LockBadge label="Avançado" />}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Download size={15} />} disabled={!visible.length} onSelect={exportCsv} className="h-10">
                    Exportar CSV
                  </MenuItem>
                </MenuContent>
              </Menu>
              {newTaskBtn("Nova tarefa")}
            </>
          )
        }
      />

      {/* resumo: cada número filtra a lista */}
      <section aria-label="Resumo das tarefas" hidden={tasks.length === 0} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ViewTile label="Abertas" n={open} hint={running ? `${running} em andamento` : "Nenhuma em andamento"} icon={<ListTodo size={16} aria-hidden />} active={view === "open"} onClick={() => pickView("open")} />
        <ViewTile label="Para hoje" n={dueToday} hint={dueToday ? "Com prazo hoje" : "Nada vence hoje"} icon={<CalendarCheck size={16} aria-hidden />} active={view === "today"} tone={dueToday ? "text-accent" : ""} onClick={() => pickView("today")} />
        <ViewTile label={late === 1 ? "Atrasada" : "Atrasadas"} n={late} hint={late ? "Passaram do prazo" : "Tudo em dia"} icon={<AlarmClock size={16} aria-hidden />} active={view === "late"} tone={late ? "text-error-fg" : ""} onClick={() => pickView("late")} />
        <ViewTile label={finished === 1 ? "Concluída" : "Concluídas"} n={finished} hint={finished ? "Já resolvidas" : "Nenhuma ainda"} icon={<CircleCheck size={16} aria-hidden />} active={view === "done"} onClick={() => pickView("done")} />
      </section>

      {fresh > 0 && (
        <section aria-label="Tarefas novas do VYZ" className="flex flex-col gap-3 rounded-card border border-accent/40 bg-[color-mix(in_srgb,var(--accent-soft)_55%,var(--card))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-[14px] leading-snug text-fg">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-accent text-on-accent">
              <Sparkles size={16} aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{fresh === 1 ? "1 nova do VYZ" : `${fresh} novas do VYZ`}</span>
              <span className="text-[13px] text-fg-2">Criadas a partir dos dados das suas contas. Abra para ver o que mudou.</span>
            </span>
          </p>
          <button type="button" onClick={() => pickView("new")} aria-pressed={view === "new"} className={`${btn.subtle} shrink-0 max-sm:h-11`}>
            {view === "new" ? "Ver todas" : fresh === 1 ? "Ver a nova" : "Ver as novas"}
          </button>
        </section>
      )}

      {/* busca e filtros */}
      <section aria-label="Filtros" hidden={tasks.length === 0} className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-field px-3 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent hover:border-fg-2/50 max-sm:h-11">
              <Search size={16} aria-hidden className="shrink-0 text-fg-2" />
              <span className="sr-only">Buscar tarefa</span>
              <input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Buscar por tarefa ou projeto" className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-2/70 max-sm:text-[16px]" />
              {filters.q && (
                <button type="button" onClick={() => set("q", "")} aria-label="Limpar a busca" className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                  <X size={15} aria-hidden />
                </button>
              )}
            </label>
            <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-controls="todo-filtros" className={`${filtersOpen || selects ? subtleTall.replace("border-line", "border-accent") : subtleTall} shrink-0 max-sm:h-11`}>
              <SlidersHorizontal size={15} aria-hidden />
              Filtros
              {selects > 0 && <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent tnum">{selects}</span>}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:justify-end">
            <Segmented
              label="Agrupar por"
              size="sm"
              value={groupMode}
              onChange={setGroupMode}
              options={[
                { value: "prazo", label: "Prazo" },
                { value: "mes", label: "Mês" },
              ]}
            />
            <span title="Só as abertas, sem as de prioridade baixa">
              <Switch label="Modo foco" checked={filters.focus} onChange={(v) => set("focus", v)} />
            </span>
            <button type="button" onClick={exportCsv} disabled={!visible.length} className={`${btn.quiet} ${state.canEdit ? "max-sm:hidden" : ""}`}>
              <Download size={15} aria-hidden />
              Exportar CSV
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div id="todo-filtros" className="space-y-3 rounded-card border border-line bg-card p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
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
          </div>
        )}

        {filtered && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-2">
            <span>
              <span className="font-semibold text-fg tnum">{visible.length}</span> de {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"}
            </span>
            <button type="button" onClick={clearFilters} className="rounded-[4px] font-semibold text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent">
              Limpar filtros
            </button>
          </p>
        )}
      </section>

      {tasks.length === 0 ? (
        <div className="space-y-4">
          <EmptyState title="Nada a fazer por enquanto" text="Quando os números de um dashboard mudarem, o VYZ cria a tarefa aqui. Você também pode criar as suas." action={state.canEdit && newTaskBtn("Criar tarefa")} />
          <ul className="grid gap-3 sm:grid-cols-3">
            {HOW.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-card border border-line bg-card p-4">
                <span className="inline-flex size-8 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <Icon size={16} aria-hidden />
                </span>
                <p className="mt-3 text-[14px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-fg-2">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line px-6 py-10 text-center">
          <p className="text-[14px] text-fg-2">Nenhuma tarefa com esses filtros.</p>
          <button type="button" onClick={clearFilters} className={btn.subtle}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((g) => {
            // com um grupo só na tela não há o que recolher
            const isClosed = sections.length > 1 && closed.has(g.key);
            return (
              <section key={g.key} className="overflow-hidden rounded-card border border-line bg-card">
                <h2>
                  <button type="button" onClick={() => toggleSection(g.key)} aria-expanded={!isClosed} className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2.5 text-left outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--surface-2)_55%,transparent)] focus-visible:bg-surface-2 sm:px-4">
                    <ChevronDown size={16} aria-hidden className={`shrink-0 text-fg-2 transition-transform duration-200 ${isClosed ? "-rotate-90" : ""}`} />
                    {g.tone && <span aria-hidden className={`size-2 shrink-0 rounded-full ${g.tone === "late" ? "bg-error" : "bg-accent"}`} />}
                    <span className={`text-[14.5px] font-semibold tracking-[-0.01em] ${g.tone === "late" ? "text-error-fg" : "text-fg"}`}>{g.label}</span>
                    <Badge tone={g.tone === "late" ? "error" : "neutral"} className="tnum">
                      {g.tasks.length}
                    </Badge>
                  </button>
                </h2>
                {!isClosed && (
                  <ul className="@container divide-y divide-line border-t border-line">
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        state={state}
                        full={full}
                        onOpen={() => openTask(t)}
                        onApply={() => t.action && setApplying({ id: t.id, title: t.title, action: t.action })}
                        onPatch={(p, local) => patch(t, p, local)}
                        onToggle={(done) => toggleDone(t, done)}
                        groupName={groups.find((x) => x.id === t.groupId)?.name ?? null}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!full && (
        <section className="flex flex-col gap-3 rounded-card border border-dashed border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-[13.5px] leading-relaxed text-fg-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg">
              <Users size={16} aria-hidden />
            </span>
            <span>
              <span className="font-semibold text-fg">Trabalhe em equipe:</span> responsáveis, cronograma, grupos e roteiros prontos (Black Friday, queda de conversão, novo cliente).
            </span>
          </p>
          <UnlockButton required="avancado" current={access.tier} feature="Usar o A Fazer completo" className="shrink-0 max-sm:h-11" />
        </section>
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
            <p className="flex items-start gap-2.5 rounded-control bg-accent-soft px-3 py-2.5 text-[13px] leading-relaxed text-fg">
              <Sparkles size={15} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span>
                Criada pelo VYZ a partir dos dados{editing.task.projectName ? ` de ${editing.task.projectName}` : ""}. Se você editar, o VYZ não fecha a tarefa sozinho.
              </span>
            </p>
          )}
          {editing?.task?.autoNote && <p className="text-[13px] leading-relaxed text-fg-2">{editing.task.autoNote}</p>}
          {editing?.task?.action && state.canEdit && (
            <div className="flex flex-col gap-2.5 rounded-control border border-accent/40 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-[13px] text-fg">
                <Zap size={15} aria-hidden className="shrink-0 text-accent" />
                O VYZ pode fazer isso por você na plataforma.
              </p>
              <button
                type="button"
                className={`${btn.small} shrink-0 max-sm:h-11`}
                onClick={() => {
                  const t = editing.task!;
                  setEditing(null);
                  setApplying({ id: t.id, title: t.title, action: t.action! });
                }}
              >
                Ver e aplicar
              </button>
            </div>
          )}
          <TextField label="Tarefa" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} disabled={!state.canEdit} />
          <div className="space-y-1.5">
            <label htmlFor="task-detail" className="block text-[13px] font-medium text-fg">
              Detalhe
            </label>
            <textarea id="task-detail" value={draft.detail} disabled={!state.canEdit} onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))} rows={3} className={textarea} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField label="Status" value={draft.status} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, status: v as TaskStatus }))} options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
            <SelectField label="Etapa" value={draft.stage} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, stage: v as TaskStage }))} options={TASK_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
            <SelectField label="Prioridade" value={draft.priority} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, priority: v as TaskPriority }))} options={TASK_PRIORITIES.map((s) => ({ value: s, label: PRIORITY_LABEL[s] }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Projeto" placeholder="Sem projeto" value={draft.projectId} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, projectId: v }))} options={[{ value: "", label: "Sem projeto" }, ...state.projects.map((p) => ({ value: p.id, label: p.name }))]} />
            <TextField label="Prazo" type="date" value={draft.dueDate} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, dueDate: v }))} />
          </div>
          {full ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Início (cronograma)" type="date" value={draft.startDate} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, startDate: v }))} />
              <SelectField label="Grupo" placeholder="Sem grupo" value={draft.groupId} disabled={!state.canEdit} onChange={(v) => setDraft((d) => ({ ...d, groupId: v }))} options={[{ value: "", label: "Sem grupo" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} />
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-[13px] font-medium text-fg">Responsáveis</legend>
                <div className="flex flex-wrap gap-x-2 gap-y-3">
                  {state.members.map((m) => {
                    const on = draft.assignees.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        aria-pressed={on}
                        disabled={!state.canEdit}
                        onClick={() => setDraft((d) => ({ ...d, assignees: on ? d.assignees.filter((x) => x !== m.userId) : [...d.assignees, m.userId] }))}
                        className={`${pill.replace("h-7", "h-8")} border ${on ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-2 hover:border-fg-2/50"}`}
                      >
                        {on && <Check size={13} aria-hidden className="text-accent" />}
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
          {formError && (
            <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
              {formError}
            </p>
          )}
          {state.canEdit && (
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              {editing?.task ? (
                <button type="button" onClick={() => remove(editing.task!)} disabled={pending} className={`${quietDanger} max-sm:h-11`}>
                  <Trash2 size={15} aria-hidden />
                  Apagar
                </button>
              ) : (
                <span />
              )}
              <button type="submit" disabled={pending || !draft.title.trim()} className={`${btn.small} max-sm:h-11`}>
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setGroupOpen(false)} className={`${btn.quiet} max-sm:h-11`}>
              Cancelar
            </button>
            <button type="submit" disabled={pending || !groupName.trim()} className={`${btn.small} max-sm:h-11`}>
              Criar grupo
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={playOpen} onClose={() => setPlayOpen(false)} title="Aplicar um roteiro" wide>
        <div className="space-y-4">
          <p className="text-[13.5px] leading-relaxed text-fg-2">Um roteiro cria um grupo com as tarefas de uma situação comum, já com etapa, prioridade e cronograma.</p>
          <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Roteiro">
            {PLAYBOOKS.map((p) => {
              const on = p.id === play.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPlay((s) => ({ ...s, id: p.id }))}
                  className={`flex flex-col rounded-card border p-3.5 text-left transition-colors ${on ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_60%,var(--card))]" : "border-line bg-card hover:border-fg-2/50"}`}
                >
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                    <ListChecks size={15} aria-hidden className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">{p.name}</span>
                    {on && <Check size={15} aria-hidden className="shrink-0 text-accent" />}
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-fg-2">{p.description}</span>
                  <span className="mt-2.5 block">
                    <Badge tone={on ? "accent" : "neutral"}>{p.tasks.length} tarefas</Badge>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Começa em" type="date" value={play.start} onChange={(v) => setPlay((s) => ({ ...s, start: v }))} />
            <SelectField label="Projeto" placeholder="Sem projeto" value={play.projectId} onChange={(v) => setPlay((s) => ({ ...s, projectId: v }))} options={[{ value: "", label: "Sem projeto" }, ...state.projects.map((p) => ({ value: p.id, label: p.name }))]} />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setPlayOpen(false)} className={`${btn.quiet} max-sm:h-11`}>
              Cancelar
            </button>
            <button type="button" onClick={runPlaybook} disabled={pending} className={`${btn.small} max-sm:h-11`}>
              <Wand2 size={15} aria-hidden />
              Aplicar roteiro
            </button>
          </div>
        </div>
      </Modal>

      <RunsSection state={state} toast={toast.show} />
      <ApplyModal
        task={applying}
        onClose={() => setApplying(null)}
        onDone={(msg) => {
          setApplying(null);
          toast.show(msg);
        }}
      />
      {state.autopilot.allowed && <AutopilotModal open={pilotOpen} onClose={() => setPilotOpen(false)} state={state} toast={toast.show} />}
      {toast.node}
    </div>
  );
}
