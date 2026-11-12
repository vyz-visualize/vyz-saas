"use client";

// Um login conectado (Meta ou Google): quem autorizou, desde quando, status e
// as ações Reconectar e Desconectar (com confirmação).

import { CircleAlert, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal, PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { disconnect } from "@/server/integrations/actions";
import { ConnectButton } from "./ConnectButton";
import { MOCK_NOTICE } from "./mock-data";
import { PROVIDERS } from "./providers";
import { shortDate } from "./sync-label";
import type { ConnectionDTO } from "./types";
import { btnSmallDanger, btnSmallOutline } from "./ui";

const STATUS: Record<ConnectionDTO["status"], { label: string; className: string; hint?: string }> = {
  active: { label: "Conectado", className: "bg-accent-soft text-fg" },
  expired: { label: "Acesso expirado", className: "bg-error-soft text-error-fg", hint: "Reconecte para voltar a sincronizar." },
  revoked: { label: "Acesso revogado", className: "bg-error-soft text-error-fg", hint: "O acesso foi tirado no provedor. Reconecte para voltar a sincronizar." },
  error: { label: "Com erro", className: "bg-error-soft text-error-fg", hint: "A última tentativa falhou. Reconecte se continuar." },
};

type ConnectionCardProps = {
  connection: ConnectionDTO;
  canManage: boolean;
  /** Para onde a reconexão volta. */
  next?: string;
  timeZone?: string;
  /** Selo "Modo de teste" na conexão simulada: só em desenvolvimento ou para ONBOARDING_REPLAY_EMAILS. */
  showTestBadge?: boolean;
};

export function ConnectionCard({ connection: c, canManage, next, timeZone, showTestBadge = false }: ConnectionCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const info = PROVIDERS[c.provider];
  const status = STATUS[c.status];
  const login = [c.userName, c.userEmail].filter(Boolean).join(" · ") || "Login sem nome";

  function confirmDisconnect() {
    setError(null);
    start(async () => {
      const res = await disconnect(c.id);
      if (res.ok) setConfirming(false);
      else setError(res.error.message);
    });
  }

  return (
    <div className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-chip px-2.5 py-0.5 text-[12px] font-medium ${status.className}`}>{status.label}</span>
            {c.isMock && showTestBadge && <PendingChip label="Modo de teste" detail={MOCK_NOTICE[c.provider]} />}
          </div>
          <p className="font-semibold break-words">{login}</p>
          <p className="text-[13px] text-fg-2">
            {c.accountsCount === 1 ? "1 conta encontrada" : `${c.accountsCount} contas encontradas`} · conectado em {shortDate(c.connectedAt, timeZone)}
            {c.connectedByName ? ` por ${c.connectedByName}` : ""}
          </p>
          {(status.hint || (c.status !== "active" && c.lastError)) && (
            <p className="inline-flex items-start gap-1.5 text-[13px] text-error-fg">
              <CircleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
              {c.lastError ?? status.hint}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <ConnectButton provider={c.provider} next={next} connected variant={c.status === "active" ? "secondary" : "primary"} />
            <button type="button" onClick={() => setConfirming(true)} className={btnSmallOutline}>
              <Unplug size={15} aria-hidden /> Desconectar
            </button>
          </div>
        )}
      </div>

      <Modal open={confirming} onClose={() => !pending && setConfirming(false)} title={`Desconectar ${info.name}`}>
        <div className="space-y-4 text-[14px]">
          <p>
            Desconectar <strong>{login}</strong>?
          </p>
          <p className="text-fg-2">
            As contas deste login saem do ar no VYZ e param de sincronizar. Os dados já importados e os dashboards continuam; para voltar, é só conectar de novo.
            {!c.isMock && ` O VYZ também pede ao ${info.name} para tirar o acesso.`}
          </p>
          {error && (
            <p role="alert" className="rounded-control border border-error/60 bg-error-soft p-3 text-error-fg">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={confirmDisconnect} disabled={pending} className={btnSmallDanger}>
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={`${btn.ghost} h-9`}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
