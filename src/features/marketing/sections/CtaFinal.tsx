// Dobra final: o convite de volta aos planos, e o especialista para quem quer conversar.

import { ArrowRight } from "lucide-react";
import { CutReveal } from "@/components/motion/CutReveal";
import { btn } from "@/components/ui/styles";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { MSG_SPECIALIST, waLink } from "@/lib/whatsapp";

export function CtaFinal() {
  return (
    <section id="cta-final" aria-labelledby="cta-title" className="relative bg-card">
      <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
        <CutReveal as="h2" id="cta-title" className="display max-w-[14em] text-[clamp(2.2rem,5.6vw,4.8rem)] text-fg" lines={["O próximo relatório", <span key="a" className="text-accent">já pode ser um link.</span>]} />
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-fg-2">Conecte as contas, escolha o modelo e mande ao cliente um dashboard que ele entende.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="#planos" className={`${btn.primary} group`} data-track="cta_final" data-track-cta="ver_planos">
            Ver planos
            <ArrowRight size={18} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a href={waLink(MSG_SPECIALIST)} target="_blank" rel="noopener noreferrer" className={btn.secondary} data-track="cta_final" data-track-cta="especialista">
            <WhatsAppIcon size={17} /> Falar com um especialista
          </a>
        </div>
      </div>
    </section>
  );
}
