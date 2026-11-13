"use client";

// Otimizações no A Fazer: a faixa "Aplicar" da tarefa, a confirmação (de → para), a lista
// das mudanças aplicadas com Desfazer e o automático por projeto (Avançado).

import { ArrowRight, Bot, Undo2, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { Badge, LockBadge, Modal, SelectField, type BadgeTone } from "@/components/ui/kit";
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

const money = (v: number, currency: string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);

/** Botão pequeno "Aplicar" (a descrição da mudança fica na dica). */
export function ApplyChip({ action, onClick, disabled }: { action: OptimizationAction; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={describeAction(action)}
      className="inline-flex h-7 items-center gap-1 rounded-chip bg-accent px-2.5 text-[12px] font-semibold text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
    >
      <Zap size={12} aria-hidden />
      Aplicar
    </button>
  );
}

/** Faixa da linha da tarefa: o que o VYZ pode fazer na plataforma e o botão para ver e aplicar. */
export function ApplyStrip({ action, onClick, disabled, className = "" }: { action: OptimizationAction; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <div className={`flex w-full max-w-xl items-center gap-2 rounded-control bg-accent-soft py-1.5 pr-1.5 pl-2.5 ${className}`}>
      <PlatformIcon id={action.platform} size={20} />
      <p className="min-w-0 flex-1 truncate text-[12.5px] text-fg" title={describeAction(action)}>
        {describeAction(action)}
      </p>
      <ApplyChip action={action} onClick={onClick} disabled={disabled} />
    </div>
  );
}

/** Confirmação: mostra o que muda e onde. */
export function ApplyModal({ task, onClose, onDone }: { task: { id: string; title: string; action: OptimizationAction } | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const a = task?.action;
  const side = (v: OptimizationAction["from"], currency: string) => (typeof v === "number" ? money(v, currency) : v === "paused" ? "Pausada" : "Ativa");
  return (
    <Modal open={!!task} onClose={onClose} title="Aplicar na plataforma">
      {a && (
        <div className="space-y-4">
          <p className="text-[14px] leading-relaxed text-fg-2">{task!.title}</p>
          <div className="rounded-card border border-line bg-card p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-medium text-fg-2">
              <PlatformIcon id={a.platform} size={22} />
              {PLATFORM_NAME[a.platform] ?? a.platform}
            </p>
            <p className="mt-2.5 text-[15px] leading-snug font-semibold text-fg">{describeAction(a)}</p>
            {/* de → para, para bater o olho (a frase de cima é a que vale) */}
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] tnum" aria-hidden>
              <span className="rounded-chip bg-surface-2 px-2.5 py-1 text-fg-2">{side(a.from, a.currency)}</span>
              <ArrowRight size={14} className="text-fg-2" />
              <span className="rounded-chip bg-accent-soft px-2.5 py-1 font-semibold text-accent">{side(a.to, a.currency)}</span>
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-fg-2">A mudança vai direto para a conta de anúncios. Fica registrada aqui e dá para desfazer em até 30 dias.</p>
          {error && (
            <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={`${btn.quiet} max-sm:h-11`}>
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
              className={`${btn.small} max-sm:h-11`}
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
const STATUS_BADGE: Record<keyof typeof STATUS_TEXT, BadgeTone> = { applied: "accent", failed: "error", undone: "neutral", undo_failed: "error" };

/** Mudanças aplicadas (as mais novas primeiro). */
export function RunsSection({ state, toast }: { state: TodoState; toast: (msg: string) => void }) {
  const [pending, start] = useTransition();
  if (!state.runs.length) return null;
  return (
    <section aria-labelledby="h-mudancas" className="overflow-hidden rounded-card border border-line bg-card">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
          <Zap size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="h-mudancas" className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
            Mudanças aplicadas nas plataformas
          </h2>
          <p className="text-[12.5px] text-fg-2">Tudo o que o VYZ mudou nas contas, com Desfazer.</p>
        </div>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {state.runs.map((r) => (
          <li key={r.id} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className={`text-[14px] leading-snug ${r.status === "undone" ? "text-fg-2 line-through decoration-fg-2/50" : "text-fg"}`}>{r.description}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-2">
                <Badge tone={STATUS_BADGE[r.status]}>{STATUS_TEXT[r.status]}</Badge>
                <span className="tnum">{when(r.appliedAt)}</span>
                <span aria-hidden>·</span>
                <span>{r.mode === "auto" ? "Automático" : "Com aprovação"}</span>
                {r.error && <span className="basis-full text-error-fg">{r.error}</span>}
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
                className={`${btn.subtle} shrink-0 max-sm:h-10`}
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
          <p className="text-[13.5px] leading-relaxed text-fg-2">
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
          <div className={`rounded-card border p-4 transition-colors ${rules.enabled ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_45%,transparent)]" : "border-line bg-card"}`}>
            <Switch label={<span className="font-semibold">Ligar o automático neste projeto</span>} checked={rules.enabled} disabled={ro} onChange={(enabled) => set({ enabled })} />
          </div>
          <div role="group" aria-label="Limites do automático" className="space-y-4 rounded-card border border-line bg-card p-4">
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
          </div>
          {ro && <p className="text-[13px] text-fg-2">Só administradores do workspace mudam o automático.</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={`${btn.quiet} max-sm:h-11`}>
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
                className={`${btn.small} max-sm:h-11`}
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

/** Quantos projetos estão com o automático ligado. */
export const autopilotOn = (state: TodoState) => Object.values(state.autopilot.projects).filter((r) => r.enabled).length;

/** Botão do cabeçalho (travado fora do Avançado). */
export function AutopilotButton({ state, onOpen }: { state: TodoState; onOpen: () => void }) {
  if (!state.autopilot.allowed)
    return (
      <span className={btn.quiet.replace("hover:bg-surface-2 hover:text-fg", "cursor-not-allowed border border-dashed border-line")} aria-disabled title={availableIn("avancado")}>
        <Bot size={16} aria-hidden />
        Automático
        <LockBadge label="Avançado" />
      </span>
    );
  const on = autopilotOn(state);
  return (
    <button type="button" onClick={onOpen} className={btn.quiet}>
      <Bot size={16} aria-hidden />
      Automático
      {on > 0 && <Badge tone="accent">{on === 1 ? "1 projeto" : `${on} projetos`}</Badge>}
    </button>
  );
}
