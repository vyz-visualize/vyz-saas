"use client";

// Otimizações no A Fazer: confirmação do "Aplicar" (de → para), a lista das
// mudanças aplicadas com Desfazer e o automático por projeto (Avançado).

import { Bot, Undo2, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { LockBadge, Modal, SelectField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { Switch } from "@/components/ui/controls";
import { availableIn } from "@/features/pricing/entitlements";
import type { TodoState } from "@/features/todo/types";
import { applyTaskAction, saveAutopilot, undoOptimization } from "@/server/optimize/actions";
import { AUTOPILOT_LIMITS, DEFAULT_AUTOPILOT, describeAction, type AutopilotRules, type OptimizationAction } from "./actions";

const PLATFORM_NAME: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

/** Botão da linha da tarefa. */
export function ApplyChip({ action, onClick, disabled }: { action: OptimizationAction; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={describeAction(action)}
      className="inline-flex h-6 items-center gap-1 rounded-chip border border-accent/50 bg-accent-soft px-2 text-[11.5px] font-semibold text-fg outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
    >
      <Zap size={11} aria-hidden className="text-accent" />
      Aplicar
    </button>
  );
}

/** Confirmação: mostra o que muda e onde. */
export function ApplyModal({ task, onClose, onDone }: { task: { id: string; title: string; action: OptimizationAction } | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const a = task?.action;
  return (
    <Modal open={!!task} onClose={onClose} title="Aplicar na plataforma">
      {a && (
        <div className="space-y-4">
          <p className="text-[14px] text-fg-2">{task!.title}</p>
          <div className="rounded-control border border-line bg-field px-4 py-3">
            <p className="text-[12px] font-medium tracking-[0.06em] text-fg-2 uppercase">{PLATFORM_NAME[a.platform] ?? a.platform}</p>
            <p className="mt-1 text-[15px] font-medium text-fg">{describeAction(a)}</p>
          </div>
          <p className="text-[13px] text-fg-2">A mudança vai direto para a conta de anúncios. Fica registrada aqui e dá para desfazer em até 30 dias.</p>
          {error && <p className="text-[13px] text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${btn.ghost} h-9`}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await applyTaskAction(task!.id);
                  if (!res.ok) return setError(res.error.message);
                  onDone("Mudança aplicada.");
                })
              }
              className={btn.small}
            >
              <Zap size={15} aria-hidden />
              {pending ? "Aplicando…" : "Aplicar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const STATUS_TEXT = {
  applied: "Aplicada",
  failed: "Falhou",
  undone: "Desfeita",
  undo_failed: "Falha ao desfazer",
} as const;

/** Mudanças aplicadas (as mais novas primeiro). */
export function RunsSection({ state, toast }: { state: TodoState; toast: (msg: string) => void }) {
  const [pending, start] = useTransition();
  if (!state.runs.length) return null;
  return (
    <section className="rounded-card border border-line bg-card">
      <h2 className="title flex items-center gap-2 px-4 py-3 text-[15px] text-fg">
        <Zap size={16} aria-hidden className="text-accent" />
        Mudanças aplicadas nas plataformas
      </h2>
      <ul className="divide-y divide-line border-t border-line">
        {state.runs.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className={`text-[14px] ${r.status === "undone" ? "text-fg-2 line-through" : "text-fg"}`}>{r.description}</p>
              <p className="mt-0.5 text-[12px] text-fg-2">
                {when(r.appliedAt)} · {r.mode === "auto" ? "Automático" : "Com aprovação"} ·{" "}
                <span className={r.status === "failed" || r.status === "undo_failed" ? "text-error" : ""}>{STATUS_TEXT[r.status]}</span>
                {r.error ? ` · ${r.error}` : ""}
              </p>
            </div>
            {r.canUndo && state.canEdit && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await undoOptimization(r.id);
                    toast(res.ok ? "Mudança desfeita." : res.error.message);
                  })
                }
                className={`${btn.ghost} h-8 shrink-0 text-[13px]`}
              >
                <Undo2 size={14} aria-hidden />
                Desfazer
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Automático por projeto (Avançado). */
export function AutopilotModal({ open, onClose, state, toast }: { open: boolean; onClose: () => void; state: TodoState; toast: (msg: string) => void }) {
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? "");
  const [rules, setRules] = useState<AutopilotRules>(state.autopilot.projects[projectId] ?? DEFAULT_AUTOPILOT);
  const [pending, start] = useTransition();
  const ro = !state.autopilot.canEdit;
  const pick = (id: string) => {
    setProjectId(id);
    setRules(state.autopilot.projects[id] ?? DEFAULT_AUTOPILOT);
  };
  const set = (p: Partial<AutopilotRules>) => setRules((r) => ({ ...r, ...p }));
  const pct = Array.from({ length: (AUTOPILOT_LIMITS.maxPct - AUTOPILOT_LIMITS.minPct) / 5 + 1 }, (_, i) => AUTOPILOT_LIMITS.minPct + i * 5);
  const ages = [3, 7, 14, 30];
  return (
    <Modal open={open} onClose={onClose} title="Otimização automática">
      {!state.projects.length ? (
        <p className="text-[14px] text-fg-2">Crie um projeto para ligar o automático.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[13.5px] text-fg-2">
            O VYZ aplica sozinho as mudanças das tarefas deste projeto, dentro dos limites abaixo, e avisa pelo app e pelo WhatsApp. Ele nunca cria campanha, nunca reativa campanha pausada e nunca
            mexe em campanha nova.
          </p>
          <SelectField
            label="Projeto"
            value={projectId}
            onChange={pick}
            options={state.projects.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
          />
          <Switch label="Ligar o automático neste projeto" checked={rules.enabled} disabled={ro} onChange={(enabled) => set({ enabled })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Mudança máxima no orçamento por dia"
              value={String(rules.maxBudgetChangePct)}
              disabled={ro || !rules.enabled}
              onChange={(v) => set({ maxBudgetChangePct: Number(v) })}
              options={pct.map((n) => ({ value: String(n), label: `${n}%` }))}
            />
            <SelectField
              label="Só em campanhas com pelo menos"
              value={String(rules.minCampaignAgeDays)}
              disabled={ro || !rules.enabled}
              onChange={(v) => set({ minCampaignAgeDays: Number(v) })}
              options={ages.map((n) => ({
                value: String(n),
                label: `${n} dias no ar`,
              }))}
            />
          </div>
          <Switch label="Pausar campanha que gasta sem converter" checked={rules.allowPause} disabled={ro || !rules.enabled} onChange={(allowPause) => set({ allowPause })} />
          <Switch
            label="Também aumentar orçamento das campanhas que vão bem"
            hint="Desligado, o automático só reduz orçamento e pausa: nunca aumenta o gasto."
            checked={rules.allowIncrease}
            disabled={ro || !rules.enabled}
            onChange={(allowIncrease) => set({ allowIncrease })}
          />
          {ro && <p className="text-[13px] text-fg-2">Só administradores do workspace mudam o automático.</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${btn.ghost} h-9`}>
              Fechar
            </button>
            {!ro && (
              <button
                type="button"
                disabled={pending || !projectId}
                onClick={() =>
                  start(async () => {
                    const res = await saveAutopilot(projectId, rules);
                    if (!res.ok) return toast(res.error.message);
                    toast(res.data.enabled ? "Automático ligado." : "Automático desligado.");
                    onClose();
                  })
                }
                className={btn.small}
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Botão do cabeçalho (travado fora do Avançado). */
export function AutopilotButton({ state, onOpen }: { state: TodoState; onOpen: () => void }) {
  if (!state.autopilot.allowed)
    return (
      <span className={`${btn.ghost} h-9 cursor-not-allowed border border-dashed border-line text-fg-2 opacity-80 hover:bg-transparent`} aria-disabled title={availableIn("avancado")}>
        <Bot size={16} aria-hidden />
        Automático
        <LockBadge label="Avançado" />
      </span>
    );
  const on = Object.values(state.autopilot.projects).filter((r) => r.enabled).length;
  return (
    <button type="button" onClick={onOpen} className={`${btn.ghost} h-9`}>
      <Bot size={16} aria-hidden />
      Automático{on ? ` · ${on} ${on === 1 ? "projeto" : "projetos"}` : ""}
    </button>
  );
}
