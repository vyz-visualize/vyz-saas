"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/motion/Magnetic";
import { btn } from "@/components/ui/styles";
import { hasDemoVideo, VIDEO_SECTION_ID } from "@/features/marketing/video";

export function HeroActions() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Magnetic>
        <a href="#planos" className={`${btn.primary} group`} data-track="hero_cta" data-track-cta="ver_planos">
          Ver planos
          <ArrowRight size={18} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </Magnetic>
      {hasDemoVideo && (
        <a href={`#${VIDEO_SECTION_ID}`} className={`${btn.ghost} group`} data-track="hero_cta" data-track-cta="ver_por_dentro">
          Ver por dentro
          <ArrowDown size={17} aria-hidden className="transition-transform duration-200 group-hover:translate-y-0.5" />
        </a>
      )}
    </div>
  );
}
