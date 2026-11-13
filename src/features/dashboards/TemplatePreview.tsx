"use client";

// Prévia de um modelo de dashboard com dados de exemplo: a página inteira (TemplatePreview)
// e a miniatura escalada (TemplateThumb), usadas na escolha do visual, nos recursos,
// no onboarding e na vitrine das páginas travadas.

import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { datasetFor, pageLayout } from "./data";
import { SkinView } from "./skins";
import { PageView } from "./widgets/PageView";
import { makeContext } from "./widgets/Widgets";

const SAMPLE_CLIENT: Record<string, string> = {
  "E-commerce": "Loja Verde",
  Leads: "Escola Aurora",
  Imobiliário: "Incorporadora Sul",
  "Negócio local": "Clínica Sol",
  Agência: "Minha agência",
  Mídia: "Pet Mais",
  Executivo: "Grupo Horizonte",
};

const PREVIEW_TABS: PageId[] = ["visao-geral", "meta-ads", "google-ads", "site", "funil"];

/** client: o nome do cliente de verdade (primeiro acesso); sem ele, um cliente de exemplo do nicho. */
export function TemplatePreview({ t, page, variant = "full", client: clientName }: { t: DashboardTemplate; page?: PageId; variant?: "full" | "compact"; client?: string }) {
  const client = clientName?.trim() || SAMPLE_CLIENT[t.category];
  const ds = datasetFor({ templateId: t.id, name: t.name, client }, 30);
  const p = page ?? t.pages[0];
  // modelo novo: as abas de um exemplo com Meta, Google e GA4 (não as 13 possíveis)
  const tabs = t.composed ? PREVIEW_TABS : t.pages;
  if (t.skin && p === t.pages[0]) {
    return <SkinView skin={t.skin} ctx={makeContext(ds)} name={t.name} client={client} pages={tabs} active={p} periodLabel="Últimos 30 dias" />;
  }
  // recursos do Avançado têm desenho próprio (prévia do passo Recursos)
  if (p === "previsao" || p === "mmm" || p === "criativos-ao-vivo") {
    return <SkinView skin={p} ctx={makeContext(ds)} name={t.name} client={client} pages={[p]} active={p} periodLabel="Últimos 30 dias" />;
  }
  return (
    <div className="bg-bg p-3">
      <p className="mb-2 text-[14px] font-bold tracking-[-0.02em]">
        {client} · {PAGES[page ?? t.pages[0]].name}
      </p>
      <PageView layout={pageLayout(t, page ?? t.pages[0])} ctx={makeContext(ds)} variant={variant} />
    </div>
  );
}

/** Miniatura real do modelo (primeira aba), escalada para caber. */
export function TemplateThumb({ t, height = 168, page, client }: { t: DashboardTemplate; height?: number; page?: PageId; client?: string }) {
  return (
    <ScaledPreview height={height} width={t.skin ? 1100 : 760}>
      <div inert>
        <TemplatePreview t={t} page={page} variant="compact" client={client} />
      </div>
    </ScaledPreview>
  );
}

