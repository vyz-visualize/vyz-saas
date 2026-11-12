// Moldura da página pública do link (/r/<token>): só leitura, sem o painel,
// com a marca do cliente no Personalizado. E as mensagens de link inválido,
// expirado ou revogado (sem dizer qual dashboard era).

import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { brandVars } from "@/features/dashboards/brand";

export type ShareBrand = { color: string | null; logoUrl: string | null; hideVyz: boolean };

export function PublicShell({ brand, note, children }: { brand?: ShareBrand; note?: string; children: ReactNode }) {
  return (
    <div style={brandVars(brand?.color)} className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {brand?.logoUrl && (
          <div className="mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo do cliente (Storage público), tamanho livre */}
            <img src={brand.logoUrl} alt="Logo" className="h-8 w-auto max-w-[160px] object-contain" />
          </div>
        )}
        <main>{children}</main>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[12px] text-fg-2">
          <span>{note ?? "Somente leitura"}</span>
          {!brand?.hideVyz && (
            <span className="flex items-center gap-2">
              Feito com <Wordmark className="w-10 text-accent" />
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}

const MESSAGES = {
  invalid: { title: "Link não encontrado", text: "O endereço está incompleto ou não existe mais. Peça um link novo para quem compartilhou." },
  expired: { title: "Link expirado", text: "Este link passou da validade. Peça um link novo para quem compartilhou." },
  revoked: { title: "Link desativado", text: "Quem compartilhou desativou este link. Peça um novo, se precisar." },
  unavailable: { title: "Dashboard indisponível", text: "Este dashboard não está disponível agora. Tente mais tarde ou fale com quem compartilhou." },
  rate_limited: { title: "Muitos acessos seguidos", text: "Espere um minuto e abra o link de novo." },
  // sem conta ligada o dashboard só teria dados de exemplo: o link não mostra número nenhum
  sample: { title: "Dashboard ainda sem contas", text: "Os números aparecem aqui assim que quem compartilhou ligar as contas de anúncio a este dashboard." },
} as const;

export type ShareProblem = keyof typeof MESSAGES;

export function ShareMessage({ kind }: { kind: ShareProblem }) {
  const m = MESSAGES[kind];
  return (
    <PublicShell>
      <div className="rounded-card border border-dashed border-line px-6 py-14 text-center">
        <h1 className="title text-2xl">{m.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-fg-2">{m.text}</p>
      </div>
    </PublicShell>
  );
}
