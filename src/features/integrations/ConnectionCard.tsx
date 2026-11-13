"use client";

// Um login conectado (Meta ou Google): quem autorizou, desde quando, status e
// as ações Reconectar e Desconectar (com confirmação).

import { CircleAlert, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge, Modal, PendingChip, type BadgeTone } from "@/components/ui/kit";
import { disconnect } from "@/server/integrations/actions";
import { ConnectButton } from "./ConnectButton";
import { MOCK_NOTICE } from "./mock-data";
import { PROVIDERS } from "./providers";
import { shortDate } from "./sync-label";
import type { ConnectionDTO } from "./types";
import { btnSmallDanger, btnSmallGhost, btnSmallOutline, errorBox, modalFooter } from "./ui";

const STATUS: Record<ConnectionDTO["status"], { label: string; tone: BadgeTone; hint?: string }> = {
  active: { label: "Conectado", tone: "ok" },
  expired: { label: "Acesso expirado", tone: "error", hint: "Reconecte para voltar a sincronizar." },
  revoked: { label: "Acesso revogado", tone: "error", hint: "O acesso foi tirado no provedor. Reconecte para voltar a sincronizar." },
  error: { label: "Com erro", tone: "error", hint: "A última tentativa falhou. Reconecte se continuar." },
};

const initials = (text: string) =>
  text
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

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
    <div className="rounded-card border border-line bg-card p-4">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-fg-2">
            {initials(c.userName ?? c.userEmail ?? "")}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={status.tone}>{status.label}</Badge>
              {c.isMock && showTestBadge && <PendingChip label="Modo de teste" detail={MOCK_NOTICE[c.provider]} />}
            </div>
            <p className="text-[14px] leading-snug font-semibold break-words">{login}</p>
            <p className="text-[12.5px] leading-snug text-fg-2">
              {c.accountsCount === 1 ? "1 conta encontrada" : `${c.accountsCount} contas encontradas`} · conectado em {shortDate(c.connectedAt, timeZone)}
              {c.connectedByName ? ` por ${c.connectedByName}` : ""}
            </p>
            {(status.hint || (c.status !== "active" && c.lastError)) && (
              <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-error-fg">
                <CircleAlert size={14} aria-hidden className="mt-px shrink-0" />
                {c.lastError ?? status.hint}
              </p>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2 max-sm:[&>*]:flex-1">
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
          <p className="leading-relaxed text-fg-2">
            As contas deste login saem do ar no VYZ e param de sincronizar. Os dados já importados e os dashboards continuam; para voltar, é só conectar de novo.
            {!c.isMock && ` O VYZ também pede ao ${info.name} para tirar o acesso.`}
          </p>
          {error && (
            <p role="alert" className={errorBox}>
              {error}
            </p>
          )}
          <div className={modalFooter}>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={btnSmallGhost}>
              Cancelar
            </button>
            <button type="button" onClick={confirmDisconnect} disabled={pending} className={btnSmallDanger}>
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
