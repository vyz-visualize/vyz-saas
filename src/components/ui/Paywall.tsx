"use client";

// Recurso de um plano acima do atual: aparece borrado, com o cadeado e o
// caminho para liberar. O conteúdo de baixo é só vitrine (inert): nada é
// clicável e o leitor de tela ouve só o aviso.

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { btn } from "@/components/ui/styles";
import { TIER_LABEL, canUse, type Tier } from "@/features/pricing/entitlements";
import { msgUpgrade, waLink } from "@/lib/whatsapp";

/** Para onde vai o botão: a troca de plano no painel (Personalizado: especialista). */
export function unlockHref(required: Tier, current: Tier | null, feature: string): { href: string; external: boolean } {
  if (required === "personalizado") {
    return { href: waLink(msgUpgrade(current ? TIER_LABEL[current] : "sem plano", TIER_LABEL.personalizado, `Quero ${feature.toLowerCase()}.`)), external: true };
  }
  return { href: `/painel/plano?liberar=${required}#h-trocar`, external: false };
}

export function UnlockButton({ required, current, feature, className = "" }: { required: Tier; current: Tier | null; feature: string; className?: string }) {
  const { href, external } = unlockHref(required, current, feature);
  // o Personalizado é sob consulta: conversa com o especialista, não troca de plano
  const label = required === "personalizado" ? "Falar com especialista" : `Liberar no ${TIER_LABEL[required]}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${btn.small} ${className}`}>
      <WhatsAppIcon size={15} /> {label}
    </a>
  ) : (
    <Link href={href} className={`${btn.small} ${className}`}>
      {label} <ArrowRight size={15} aria-hidden />
    </Link>
  );
}

export function Paywall({
  current,
  required,
  feature,
  text,
  children,
  className = "",
}: {
  /** Tier do workspace (null = sem plano). */
  current: Tier | null;
  /** Tier que libera o recurso. */
  required: Tier;
  /** Nome do recurso ("Marca própria"). */
  feature: string;
  /** Uma linha sobre o que o recurso faz. */
  text?: string;
  children: ReactNode;
  className?: string;
}) {
  if (current && canUse(current, required)) return <>{children}</>;
  return (
    // as duas camadas na mesma célula da grade: a área cresce com a maior (o cartão nunca é cortado)
    <div className={`relative isolate grid overflow-hidden rounded-card ${className}`} data-paywall>
      <div inert aria-hidden className="pointer-events-none blur-[6px] saturate-50 select-none [grid-area:1/1]">
        {children}
      </div>
      <div className="z-10 grid place-items-center bg-[color-mix(in_srgb,var(--bg)_45%,transparent)] p-4 [grid-area:1/1]">
        <div role="note" className="flex max-w-sm flex-col items-center gap-2.5 rounded-card border border-line bg-card px-5 py-4 text-center">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent-soft text-fg">
            <Lock size={16} aria-hidden />
          </span>
          <p className="title text-[15px] text-fg">
            {feature} <span className="text-fg-2">· {required === "personalizado" ? "sob consulta" : TIER_LABEL[required]}</span>
          </p>
          {text && <p className="text-[13px] text-fg-2">{text}</p>}
          <UnlockButton required={required} current={current} feature={feature} />
        </div>
      </div>
    </div>
  );
}
