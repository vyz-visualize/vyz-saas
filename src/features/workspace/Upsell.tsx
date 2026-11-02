"use client";

// Vitrine dentro do painel: o que os planos acima liberam (borrado, com o
// caminho para liberar) e o outro produto da VYZ. Some quando o plano já tem tudo.

import { ArrowRight, BarChart3, PanelsTopLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Paywall } from "@/components/ui/Paywall";
import { canUse, type Tier } from "@/features/pricing/entitlements";
import { brl } from "@/lib/format";
import { lpMonthly, startingPrice, type Product } from "@/features/pricing/pricing";
import { useWorkspaceSession } from "./WorkspaceProvider";

type Feature = { required: Tier; feature: string; text: string; preview: ReactNode };

/** Prévia decorativa: barras e blocos no visual do painel. */
function Preview({ bars = [40, 65, 52, 80, 70, 92], chips = 0, rows = 0 }: { bars?: number[]; chips?: number; rows?: number }) {
  return (
    <div className="flex h-64 flex-col justify-end rounded-card border border-line bg-card p-4">
      {chips > 0 && (
        <div className="mb-3 flex gap-1.5">
          {Array.from({ length: chips }, (_, i) => (
            <span key={i} className="size-6 rounded-full bg-accent/30" />
          ))}
        </div>
      )}
      {rows > 0 ? (
        <div className="space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2.5 w-24 rounded-full bg-fg/15" />
              <span className="h-2.5 flex-1 rounded-full bg-accent/40" style={{ maxWidth: `${90 - i * 14}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-end gap-2">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 rounded-t-[4px] bg-accent/50" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

const FEATURES: Record<Product, Feature[]> = {
  dash: [
    { required: "pro", feature: "27 plataformas", text: "TikTok, LinkedIn, marketplaces e CRMs no mesmo dashboard.", preview: <Preview chips={8} bars={[30, 55, 45, 70, 60, 85]} /> },
    { required: "avancado", feature: "Análise por áudio", text: "Pergunte em voz alta e ouça a leitura dos números.", preview: <Preview bars={[20, 70, 35, 90, 45, 75, 30, 60]} /> },
    { required: "personalizado", feature: "Marca própria", text: "Seu logo e suas cores no dashboard, no link e no PDF.", preview: <Preview rows={4} /> },
  ],
  lp: [
    { required: "pro", feature: "3 landing pages e leads com UTM", text: "Teste ofertas e públicos e veja de onde veio cada lead.", preview: <Preview rows={4} /> },
    { required: "avancado", feature: "5 landing pages e todos os templates", text: "Uma página para cada campanha.", preview: <Preview bars={[50, 50, 50, 50, 50]} /> },
  ],
};

export function Upsell() {
  const { workspace, access, role } = useWorkspaceSession();
  const current = access.hasAccess ? access.tier : null;
  const locked = FEATURES[workspace.product].filter((f) => !current || !canUse(current, f.required));
  const other: Product = workspace.product === "dash" ? "lp" : "dash";

  return (
    <section aria-labelledby="h-upsell" className="space-y-4">
      {locked.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="h-upsell" className="title text-lg">
              Libere mais no seu plano
            </h2>
            {role !== "owner" && <p className="text-[12.5px] text-fg-2">Quem troca o plano é o dono do workspace.</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {locked.map((f) => (
              <Paywall key={f.feature} current={current} required={f.required} feature={f.feature} text={f.text}>
                {f.preview}
              </Paywall>
            ))}
          </div>
        </>
      )}
      <CrossSell product={other} />
    </section>
  );
}

/** O outro produto da VYZ: abre a página de planos já na visão dele. */
function CrossSell({ product }: { product: Product }) {
  const lp = product === "lp";
  const Icon = lp ? PanelsTopLeft : BarChart3;
  const from = lp ? lpMonthly("base") : startingPrice("base", "anual");
  return (
    <Link
      href={`/?produto=${product}&plano=pro&periodo=${lp ? "mensal" : "anual"}#planos`}
      className="group flex flex-col gap-3 rounded-card border border-line bg-card p-5 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-fg">
          <Icon size={18} aria-hidden />
        </span>
        <span>
          <span className="title block text-[15px] text-fg">{lp ? "Landing pages da VYZ" : "Dashboards da VYZ"}</span>
          <span className="block text-[13.5px] text-fg-2">
            {lp
              ? "Páginas feitas pelo time, com GTM e leads no painel."
              : "Meta, Google e GA4 num dashboard pronto para o cliente."}{" "}
            A partir de {brl(from)}/mês.
          </span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent">
        Conhecer <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
