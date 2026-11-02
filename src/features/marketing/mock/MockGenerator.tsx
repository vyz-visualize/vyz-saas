"use client";

import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { scrollToId } from "@/components/motion/SmoothScroll";
import { usePlan } from "@/features/marketing/state/PlanProvider";
import { MSG_SEGMENT, waLink } from "@/lib/whatsapp";
import { DashboardMock } from "./DashboardMock";
import { LandingMock } from "./LandingMock";
import { TiltFrame } from "./TiltFrame";

type Mode = "dashboard" | "landing";
type Tipo = "ecommerce" | "imobiliario" | "outro";
type Applied = { mode: Mode; name: string; tipo: Tipo };

const DEFAULT_NAME = "Loja Verde";
export const GENERATOR_INPUT_ID = "gerador-nome";

const DASH_TEMPLATE = { ecommerce: "ecommerce-visao-geral", imobiliario: "imobiliario-leads" } as const;
const LP_TEMPLATE = { ecommerce: "produto-oferta", imobiliario: "empreendimento" } as const;

/**
 * O gestor vê o que está comprando antes de comprar. Trocar o tipo (dashboard
 * ou LP) ou o negócio regenera na hora, com o scanner; "Gerar" e Enter aplicam o nome.
 */
export function MockGenerator() {
  const { update } = usePlan();
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState<Applied>({ mode: "dashboard", name: DEFAULT_NAME, tipo: "ecommerce" });
  const [builds, setBuilds] = useState(0);

  function regenerate(patch: Partial<Applied>) {
    setApplied((a) => ({ ...a, ...patch }));
    setBuilds((b) => b + 1);
  }

  function generate(e?: FormEvent) {
    e?.preventDefault();
    regenerate({ name: draft.trim() || DEFAULT_NAME });
  }

  // o primeiro mock já chega pronto (a linha da intro pousa na meta dele);
  // a montagem peça por peça fica para cada troca
  const assemble = builds > 0;
  const isLanding = applied.mode === "landing";
  const want = isLanding ? "Quero essa landing page" : "Quero esse dashboard";
  const seed = `${applied.name}|${applied.tipo}|${applied.mode}`;

  return (
    <div className="relative">
      <form onSubmit={generate} aria-label="Gerador de exemplo" className="rounded-card border border-line bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="O que gerar"
            size="sm"
            value={applied.mode}
            onChange={(mode) => regenerate({ mode })}
            options={[
              { value: "dashboard", label: "Dashboard" },
              { value: "landing", label: "Landing page" },
            ]}
          />
          <p className="label-caps hidden text-fg-2 sm:block">Gerador de exemplo</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-[13px] font-medium text-fg-2">Nome do cliente ou da marca</span>
            <input
              id={GENERATOR_INPUT_ID}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 32))}
              placeholder={DEFAULT_NAME}
              autoComplete="off"
              enterKeyHint="go"
              className="mt-1 h-10 w-full rounded-control border border-line bg-field px-3 text-[15px] text-fg transition-colors outline-none focus-visible:border-accent"
            />
          </label>
          <button type="submit" className={`${btn.primary} h-10`}>
            Gerar
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] font-medium text-fg-2">Tipo de negócio</span>
          <Segmented
            label="Tipo de negócio"
            variant="chips"
            size="sm"
            value={applied.tipo}
            onChange={(tipo) => regenerate({ tipo })}
            options={[
              { value: "ecommerce", label: "E-commerce" },
              { value: "imobiliario", label: "Imobiliário" },
              { value: "outro", label: "Outro" },
            ]}
          />
        </div>
      </form>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate text-[13px] text-fg-2" aria-live="polite">
            {applied.tipo === "outro" ? "Outro tipo de negócio" : `${isLanding ? "Landing page" : "Dashboard"} · ${applied.name}`}
          </p>
          <p className="shrink-0 rounded-chip border border-line px-2.5 py-0.5 text-[11px] font-medium text-fg-2">Amostra · dados fictícios</p>
        </div>

        {applied.tipo === "outro" ? (
          <div className="rounded-card border border-dashed border-line bg-card p-6 sm:p-8">
            <p className="title max-w-md text-xl text-fg">Serviços, educação, saúde, negócio local: a gente parte do template mais próximo e ajusta com você.</p>
            <a href={waLink(MSG_SEGMENT)} target="_blank" rel="noopener noreferrer" className={`${btn.primary} mt-5`}>
              <WhatsAppIcon /> Falar com especialista
            </a>
          </div>
        ) : (
          <TiltFrame className="overflow-hidden rounded-card border border-line bg-bg">
            {isLanding ? (
              <LandingMock key={builds} name={applied.name} templateId={LP_TEMPLATE[applied.tipo]} assemble={assemble} />
            ) : (
              <DashboardMock key={builds} templateId={DASH_TEMPLATE[applied.tipo]} name={applied.name} seed={seed} assemble={assemble} live markGoal={builds === 0} />
            )}
          </TiltFrame>
        )}

        {applied.tipo !== "outro" && (
          <button
            type="button"
            onClick={() => {
              update({ nicho: applied.tipo as "ecommerce" | "imobiliario" });
              scrollToId("planos");
            }}
            className={`${btn.outline} group mt-3 w-full sm:w-auto`}
          >
            {want}
            <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
