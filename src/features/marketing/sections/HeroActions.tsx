"use client";

import { ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/motion/Magnetic";
import { btn } from "@/components/ui/styles";

export function HeroActions() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Magnetic>
        <a href="#planos" className={`${btn.primary} group`}>
          Ver planos
          <ArrowRight size={18} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </Magnetic>
    </div>
  );
}
