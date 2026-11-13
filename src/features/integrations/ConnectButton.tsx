"use client";

// Botão que começa a conexão (Meta Ads ou Google Ads). É um link comum para a
// rota de início: o servidor confere papel e plano e manda ao provedor (ou à
// tela simulada). Reaproveitado no onboarding (/comecar).

import { LoaderCircle, Lock, PlugZap, RefreshCw } from "lucide-react";
import { btn } from "@/components/ui/styles";
import { useLeaving } from "./leaving";
import { connectHref, PROVIDERS, type ProviderId } from "./providers";
import { btnSmallOutline } from "./ui";

type ConnectButtonProps = {
  provider: ProviderId;
  /** Para onde voltar depois do login (padrão: /painel/contas). */
  next?: string;
  /** Já tem conexão: o texto vira "Reconectar". */
  connected?: boolean;
  /** Só admin conecta. Sem permissão, o botão aparece travado com o motivo. */
  canManage?: boolean;
  /** "primary" (destaque) ou "secondary" (contorno). */
  variant?: "primary" | "secondary";
  /** Texto próprio (ex.: "Conectar outro login"). */
  label?: string;
  /** Só "Conectar" no botão (cartões da tela de contas, onde o nome da ferramenta já está ao lado); o nome inteiro vai no rótulo acessível. */
  compact?: boolean;
  className?: string;
};

export function ConnectButton({ provider, next = "/painel/contas", connected = false, canManage = true, variant = "primary", label, compact = false, className = "" }: ConnectButtonProps) {
  const { leaving, leave } = useLeaving<ProviderId>();
  const opening = leaving !== null;
  const name = PROVIDERS[provider].name;
  const full = connected ? `Reconectar ${name}` : `Conectar ${name}`;
  const text = label ?? (connected ? "Reconectar" : compact ? "Conectar" : full);
  const look = `${variant === "primary" ? btn.small : btnSmallOutline} ${className}`;

  if (!canManage) {
    return (
      <span className={`${look} cursor-not-allowed opacity-50`} aria-disabled="true" aria-label={label ? undefined : full} title="Só administradores do workspace conectam contas.">
        <Lock size={15} aria-hidden /> {text}
      </span>
    );
  }

  return (
    <a
      href={connectHref(provider, next)}
      onClick={leave(provider)}
      aria-busy={opening}
      aria-label={!label && (connected || compact) ? full : undefined}
      className={look}
    >
      {opening ? <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" /> : connected ? <RefreshCw size={15} aria-hidden /> : <PlugZap size={15} aria-hidden />}
      {opening ? "Abrindo…" : text}
    </a>
  );
}
