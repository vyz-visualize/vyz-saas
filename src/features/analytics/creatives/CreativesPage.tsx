"use client";

// Página de Criativos por plano. Básico: lista + amostra da galeria. Padrão:
// galeria + amostra do comparativo. Avançado: abas Galeria | Comparativo, com URL
// própria. Galeria e comparativo são arquivos à parte: quem não tem o recurso não
// baixa o código, e o servidor já não mandou os dados (access.ts).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CreativesData, LiveDashboardData, MetaView } from "../types";
import type { PageProps } from "../shared";
import { CreativeList } from "./CreativeList";
import { LockedCompare, LockedGallery } from "./LockedSamples";
import { creativesHref } from "./query";

const Loading = () => <div className="h-64 animate-pulse rounded-card bg-card" aria-busy="true" />;
const CreativeGallery = dynamic(() => import("./CreativeGallery").then((m) => m.CreativeGallery), { loading: Loading });
const CompareView = dynamic(() => import("./CompareView").then((m) => m.CompareView), { loading: Loading });

/** Do servidor: já cortado pelo plano. Prévias (galeria de templates, LP): a galeria, sem oferta. */
export function creativesFromData(data: LiveDashboardData): CreativesData {
  if (data.creatives) return data.creatives;
  const view = data.view as MetaView;
  return { level: "gallery", tab: "galeria", list: view.creativeList ?? [], gallery: view.creatives ?? [], compare: [], initialAds: [], hideSpend: data.hideSpend, currency: data.currency, breakEvenRoas: view.breakEvenRoas, upsellTier: null };
}

const TABS = [
  { value: "galeria", label: "Galeria" },
  { value: "comparativo", label: "Comparativo" },
] as const;

function CompareLevel({ data }: { data: CreativesData }) {
  const search = useSearchParams()?.toString() ?? "";
  return (
    <div className="space-y-3">
      <nav aria-label="Criativos" className="inline-flex rounded-chip border border-line p-0.5">
        {TABS.map((t) => (
          <Link key={t.value} href={creativesHref(search, t.value, t.value === "comparativo" ? data.initialAds : [])} scroll={false} aria-current={data.tab === t.value ? "page" : undefined} className={`rounded-chip px-3 py-1 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${data.tab === t.value ? "bg-accent text-on-accent" : "text-fg-2 hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {data.tab === "comparativo" ? <CompareView data={data} /> : <CreativeGallery data={data} compareHref={(ads) => creativesHref(search, "comparativo", ads)} />}
    </div>
  );
}

export function CreativesPage({ data }: { data: CreativesData }) {
  return (
    <div className="@container space-y-4">
      {data.level === "list" && (
        <>
          <CreativeList rows={data.list} currency={data.currency} hideSpend={data.hideSpend} />
          {data.upsellTier && <LockedGallery tier={data.upsellTier} />}
        </>
      )}
      {data.level === "gallery" && (
        <>
          <CreativeGallery data={data} />
          {data.upsellTier && <LockedCompare tier={data.upsellTier} />}
        </>
      )}
      {data.level === "compare" && <CompareLevel data={data} />}
    </div>
  );
}

/** A página no dashboard Meta com dados reais. */
export function MetaCreatives({ data }: PageProps) {
  return <CreativesPage data={creativesFromData(data)} />;
}
