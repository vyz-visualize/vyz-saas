"use client";

// Ferramentas de teste, no rodapé da Início:
// - "Recomeçar teste" (contas de teste, isTestAccount): apaga a assinatura e os
//   workspaces dela e volta para os planos (o login fica).
// - "Refazer primeiro acesso" (e-mails de ONBOARDING_REPLAY_EMAILS): volta o
//   primeiro acesso do workspace aberto ao começo, sem apagar nada.

import { FlaskConical, LoaderCircle, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { btn } from "@/components/ui/styles";
import { resetTestAccount } from "@/server/billing/test-reset";
import { replayFirstAccess } from "@/server/onboarding/replay";
import type { ActionResult } from "@/server/supabase/errors";

function Confirmable({ label, confirmLabel, pendingLabel, action }: { label: string; confirmLabel: string; pendingLabel: string; action: () => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirm ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await action();
                  if (res && !res.ok) setError(res.error.message);
                })
              }
              className={btn.small}
            >
              {pending && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {pending ? pendingLabel : confirmLabel}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirm(false)} className={`${btn.ghost} h-9`}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className={`${btn.secondary} h-9`}>
            {label}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[13px] text-error-fg">{error}</p>}
    </>
  );
}

export function TestReset({ reset = false, replay = false, className = "" }: { reset?: boolean; replay?: boolean; className?: string }) {
  if (!reset && !replay) return null;
  return (
    <div className={`space-y-4 rounded-card border border-dashed border-warning/60 bg-card p-4 ${className}`}>
      {replay && (
        <div>
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
            <RotateCcw size={15} aria-hidden /> Refazer primeiro acesso
          </p>
          <p className="mt-1 text-[13px] text-fg-2">Volta o primeiro acesso deste workspace ao começo, com o tour e os lembretes. Não apaga nada: projetos, contas e dashboards ficam.</p>
          <Confirmable label="Refazer primeiro acesso" confirmLabel="Sim, refazer agora" pendingLabel="Voltando…" action={replayFirstAccess} />
        </div>
      )}
      {reset && (
        <div>
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
            <FlaskConical size={15} aria-hidden /> Conta de teste
          </p>
          <p className="mt-1 text-[13px] text-fg-2">Recomeçar apaga a assinatura, os dashboards e as contas deste teste e volta para os planos. O login continua o mesmo.</p>
          <Confirmable label="Recomeçar teste" confirmLabel="Sim, recomeçar do zero" pendingLabel="Apagando…" action={resetTestAccount} />
        </div>
      )}
    </div>
  );
}
