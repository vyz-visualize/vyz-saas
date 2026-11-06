"use client";

// Botão da conta de teste: apaga a assinatura e os workspaces dela e volta
// para os planos (o login fica). Só aparece para isTestAccount.

import { FlaskConical, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { btn } from "@/components/ui/styles";
import { resetTestAccount } from "@/server/billing/test-reset";

export function TestReset({ className = "" }: { className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className={`rounded-card border border-dashed border-warning/60 bg-card p-4 ${className}`}>
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
        <FlaskConical size={15} aria-hidden /> Conta de teste
      </p>
      <p className="mt-1 text-[13px] text-fg-2">Recomeçar apaga a assinatura, os dashboards e as contas deste teste e volta para os planos. O login continua o mesmo.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirm ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await resetTestAccount();
                  if (res && !res.ok) setError(res.error.message);
                })
              }
              className={btn.small}
            >
              {pending && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {pending ? "Apagando…" : "Sim, recomeçar do zero"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirm(false)} className={`${btn.ghost} h-9`}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className={`${btn.secondary} h-9`}>
            Recomeçar teste
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[13px] text-error-fg">{error}</p>}
    </div>
  );
}
