"use client";

import { useInView } from "motion/react";
import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { COMPANY, companyIdentity } from "@/features/legal/company";
import { BILLING_LIVE } from "@/lib/flags";
import { MSG_SPECIALIST, waLink } from "@/lib/whatsapp";

const noop = () => () => {};
// o mesmo e-mail dos Termos e da Privacidade
const SUPPORT_EMAIL = COMPANY.supportEmail;

export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  // ano do navegador; no HTML pré-renderizado fica vazio (Cache Components)
  const year = useSyncExternalStore(noop, () => String(new Date().getFullYear()), () => "");
  const company = companyIdentity();

  return (
    <footer className="relative overflow-hidden border-t border-line pt-16 pb-10">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        {/* wordmark: as metades do V e do Z se juntam e o corte reabre. No celular, a largura toda;
            no desktop, metade, centralizado */}
        <div ref={ref} className="wm-assemble mx-auto lg:w-1/2" data-state={inView ? "play" : "idle"}>
          <Wordmark className="w-full text-accent" title="VYZ" />
        </div>
        <p className="mt-6 text-center text-[clamp(1rem,2.6vw,1.75rem)] font-medium tracking-[0.34em] text-fg" aria-hidden>
          vyzualize
        </p>
        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-sm text-fg-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-1">
            {/* "Simulação" sai quando a cobrança for de verdade (BILLING_LIVE) */}
            <p className="tnum">
              {BILLING_LIVE ? "VYZ · Vyzualize" : "Simulação · não é cobrança"}
              {year ? ` · ${year}` : ""}
            </p>
            {/* razão social e CNPJ: só aparecem quando preenchidos em features/legal/company */}
            {company && <p className="text-[12.5px]">{company}</p>}
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="basis-full transition-colors hover:text-accent sm:basis-auto">
              {SUPPORT_EMAIL}
            </a>
            <Link href="/termos" className="transition-colors hover:text-accent">Termos de Uso</Link>
            <Link href="/privacidade" className="transition-colors hover:text-accent">Privacidade</Link>
            <Link href="/exclusao-de-dados" className="transition-colors hover:text-accent">Exclusão de dados</Link>
          </nav>
          <a
            href={waLink(MSG_SPECIALIST)}
            data-track="whatsapp_click"
            data-track-origem="rodape"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-fg transition-colors hover:text-accent"
          >
            <WhatsAppIcon size={16} /> Falar no WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
