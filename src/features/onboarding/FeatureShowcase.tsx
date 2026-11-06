"use client";

// Vitrine de recursos do plano seguinte no passo Layout: cada recurso abre uma
// demonstração funcionando, com dados de exemplo, para a pessoa ver o que ganha
// antes de subir de plano. Hoje: os do Avançado.

import { Activity, ArrowRight, BarChart3, GitCompareArrows, LineChart, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Modal } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { CreativesPage } from "@/features/analytics/creatives/CreativesPage";
import { sampleCreatives } from "@/features/analytics/creatives/sample";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { TemplatePreview } from "@/features/dashboards/TemplateGallery";
import { TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { dashboardTemplate } from "@/features/templates/dashboards";

type Feature = { id: string; title: string; text: string; icon: ComponentType<{ size?: number }>; demo: () => ReactNode };

/** O comparativo de criativos de verdade (o mesmo da página Criativos), com anúncios de exemplo. */
function CompareDemo() {
  const data = useMemo(() => {
    const t = dashboardTemplate("ecommerce-completo");
    if (!t) return null;
    const spec = { name: "Loja Verde", client: "Loja Verde", settings: DEFAULT_SETTINGS };
    const opts = { period: "30d" as const, customDays: 30 };
    const gallery = sampleCreatives(t, spec, ["criativos"], { tier: "avancado", tab: "galeria" }, opts);
    const ads = (gallery?.gallery ?? []).slice(0, 2).map((c) => c.id);
    return sampleCreatives(t, spec, ["criativos"], { tier: "avancado", tab: "comparativo", ads }, opts) ?? null;
  }, []);
  if (!data) return <p className="text-fg-2">Demonstração indisponível.</p>;
  return <CreativesPage data={data} />;
}

const templateDemo = (id: string) =>
  function TemplateDemo() {
    const t = dashboardTemplate(id);
    return t ? <TemplatePreview t={t} /> : null;
  };

export const TIER_FEATURES: Partial<Record<Tier, Feature[]>> = {
  avancado: [
    {
      id: "comparativo-criativos",
      title: "Comparativo de criativos",
      text: "Dois ou três anúncios lado a lado, métrica por métrica, com a evolução por dia de veiculação.",
      icon: GitCompareArrows,
      demo: CompareDemo,
    },
    { id: "criativos-ao-vivo", title: "Criativos ao vivo", text: "Ranking que se atualiza sozinho, duelo com a confiança estatística e alerta de fadiga.", icon: Activity, demo: templateDemo("criativos-ao-vivo") },
    { id: "previsao-kpis", title: "Previsão de KPIs", text: "Fechamento do mês com faixa de confiança, chance de bater a meta e simulador de verba.", icon: LineChart, demo: templateDemo("previsao-kpis") },
    { id: "mmm", title: "MMM · Mix de mídia", text: "Quanto cada canal gera de fato, curvas de saturação e a verba redistribuída que rende mais.", icon: BarChart3, demo: templateDemo("mmm-mix-midia") },
  ],
};

export function FeatureShowcase({ tier }: { tier: Tier }) {
  const features = TIER_FEATURES[tier];
  const [open, setOpen] = useState<Feature | null>(null);
  if (!features?.length) return null;
  const Demo = open?.demo;
  return (
    <div className="mt-6">
      <p className="text-[13px] font-semibold text-fg">Veja funcionando antes de liberar</p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setOpen(f)}
                className="group flex h-full w-full flex-col rounded-card border border-line bg-card p-4 text-left outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-[10px] bg-accent-soft text-fg">
                    <Icon size={17} />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-chip border border-line px-2 py-0.5 text-[11px] text-fg-2">
                    <Lock size={11} aria-hidden /> {TIER_LABEL[tier]}
                  </span>
                </span>
                <span className="mt-3 text-[14.5px] font-semibold text-fg">{f.title}</span>
                <span className="mt-1 text-[12.5px] leading-snug text-fg-2">{f.text}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[12.5px] font-semibold text-accent">
                  <PlayCircle size={14} aria-hidden /> Ver funcionando
                  <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.title} · demonstração` : ""} full>
        {open && Demo && (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-accent-soft px-4 py-3 text-[13.5px]">
              <span>
                <strong className="font-semibold">Dados de exemplo.</strong> No {TIER_LABEL[tier]}, este recurso lê as suas contas conectadas.
              </span>
              <Link href={`/painel/plano?liberar=${tier}#h-trocar`} className={btn.small}>
                <Lock size={14} aria-hidden /> Liberar no {TIER_LABEL[tier]}
              </Link>
            </p>
            <Demo />
          </div>
        )}
      </Modal>
    </div>
  );
}
