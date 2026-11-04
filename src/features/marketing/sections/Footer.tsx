"use client";

import { useInView } from "motion/react";
import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { MSG_SPECIALIST, waLink } from "@/lib/whatsapp";

const noop = () => () => {};

export function Footer() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  // ano do navegador; no HTML pré-renderizado fica vazio (Cache Components)
  const year = useSyncExternalStore(noop, () => String(new Date().getFullYear()), () => "");

  return (
    <footer className="relative overflow-hidden border-t border-line pt-16 pb-10">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        {/* wordmark gigante: as metades do V e do Z se juntam e o corte reabre */}
        <div ref={ref} className="wm-assemble" data-state={inView ? "play" : "idle"}>
          <Wordmark className="w-full text-accent" title="VYZ" />
        </div>
        <p className="mt-6 text-center text-[clamp(1rem,2.6vw,1.75rem)] font-medium tracking-[0.34em] text-fg" aria-hidden>
          vyzualize
        </p>
        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-sm text-fg-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="tnum">
            Simulação · não é cobrança{year ? ` · ${year}` : ""}
          </p>
          <nav className="flex gap-5">
            <Link href="/termos" className="transition-colors hover:text-accent">Termos de Uso</Link>
            <Link href="/privacidade" className="transition-colors hover:text-accent">Privacidade</Link>
          </nav>
          <a
            href={waLink(MSG_SPECIALIST)}
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
