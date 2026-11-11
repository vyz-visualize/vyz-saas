// Modelos novos: o cliente escolhe o VISUAL e o OBJETIVO; as PÁGINAS saem das contas
// que ele liga ao dashboard. Cada visual × objetivo é um modelo no catálogo (o banco
// confere o modelo e as plataformas), com todas as páginas possíveis; o dashboard guarda
// só as que as contas pedem (composePages).

import type { PlatformId } from "@/features/accounts/platforms";
import type { Profile } from "@/features/metrics/definitions";
import type { Tier } from "@/features/pricing/entitlements";
import type { DashboardCategory, DashboardTemplate, PageId, SkinId } from "../types";

export type VisualId = "vyz" | "lavanda" | "pulso" | "noturno" | "areia";
export type Visual = { id: VisualId; name: string; skin?: SkinId; tier: Exclude<Tier, "personalizado">; description: string };

/** Os visuais oferecidos. Básico: VYZ e Lavanda; Padrão: + Pulso; Avançado: todos. */
export const VISUALS: Visual[] = [
  { id: "vyz", name: "Padrão VYZ", tier: "base", description: "O visual da casa: claro ou escuro, números grandes e leitura rápida." },
  { id: "lavanda", name: "Lavanda", skin: "lavanda", tier: "base", description: "Claro, em lilás: cards suaves e gráficos arredondados." },
  { id: "pulso", name: "Pulso", skin: "pulso", tier: "pro", description: "Escuro, com destaque vibrante para o que importa." },
  { id: "noturno", name: "Noturno", skin: "noturno", tier: "avancado", description: "Escuro em azul-noite e âmbar, com anéis e tendências." },
  { id: "areia", name: "Areia", skin: "areia", tier: "avancado", description: "Claro, em tons de areia, editorial e calmo." },
];

export type ObjectiveId = "ecommerce" | "leads" | "local" | "infoproduto" | "imob" | "saude" | "educacao" | "agencia";
export type Objective = { id: ObjectiveId; label: string; hint: string; profile: Profile; category: DashboardCategory };

/** O objetivo decide os números do topo e o funil (compra, lead, contato...). */
export const OBJECTIVES: Objective[] = [
  { id: "ecommerce", label: "Vender online", hint: "Loja virtual: funil até a compra, receita e ROAS.", profile: "ecommerce", category: "E-commerce" },
  { id: "leads", label: "Gerar leads", hint: "Formulários e cadastros: custo por lead e funil de lead.", profile: "leads", category: "Leads" },
  { id: "local", label: "Negócio local", hint: "WhatsApp, ligações e visitas: custo por contato.", profile: "local", category: "Negócio local" },
  { id: "infoproduto", label: "Infoproduto", hint: "Lançamento e perpétuo: leads, vendas e custo por venda.", profile: "infoproduto", category: "Leads" },
  { id: "imob", label: "Imobiliário", hint: "Leads qualificados, visitas e custo por lead.", profile: "imob", category: "Imobiliário" },
  { id: "saude", label: "Clínicas e saúde", hint: "Agendamentos e consultas: custo por agendamento.", profile: "saude", category: "Negócio local" },
  { id: "educacao", label: "Educação", hint: "Matrículas: do lead à matrícula e custo por aluno.", profile: "educacao", category: "Leads" },
  { id: "agencia", label: "Agência", hint: "Vários clientes: investimento, resultado e saúde de cada conta.", profile: "agencia", category: "Agência" },
];

/** Objetivo de cada nicho do onboarding (o primeiro acesso já monta pelo segmento). */
const OBJECTIVE_BY_BUSINESS: Record<string, ObjectiveId> = { ecommerce: "ecommerce", leads: "leads", imobiliario: "imob", local: "local", infoproduto: "infoproduto", saude: "saude", educacao: "educacao", agencia: "agencia" };
export const objectiveForBusiness = (businessTypeId: string | null | undefined): ObjectiveId => OBJECTIVE_BY_BUSINESS[businessTypeId ?? ""] ?? "ecommerce";

/** Plataformas que um modelo novo aceita (as que têm dados reais no VYZ). */
export const COMPOSED_SOURCES: PlatformId[] = ["meta", "google", "ga4", "instagram", "facebook"];

/** Todas as páginas que um modelo novo pode ter (o banco aceita só estas). */
export const COMPOSED_PAGES: PageId[] = ["visao-geral", "meta-ads", "criativos", "publico", "google-ads", "termos", "site", "canais-site", "instagram", "pagina-facebook", "conteudo", "funil", "campanhas"];

export const composedId = (visual: VisualId, objective: ObjectiveId) => `${visual}-${objective}`;

export const COMPOSED_TEMPLATES: DashboardTemplate[] = VISUALS.flatMap((v) =>
  OBJECTIVES.map(
    (o): DashboardTemplate => ({
      id: composedId(v.id, o.id),
      name: `${v.name} · ${o.label}`,
      category: o.category,
      tier: v.tier,
      profile: o.profile,
      sources: COMPOSED_SOURCES,
      pages: COMPOSED_PAGES,
      description: `${v.description} ${o.hint}`,
      ...(v.skin ? { skin: v.skin } : {}),
      composed: { visual: v.id, objective: o.id },
    }),
  ),
);

/** Páginas de uma plataforma só: os números delas vêm filtrados para aquela plataforma. */
export const PAGE_PLATFORM: Partial<Record<PageId, PlatformId>> = { "meta-ads": "meta", criativos: "meta", publico: "meta", "google-ads": "google", termos: "google" };

/**
 * As páginas que as contas escolhidas pedem, na ordem das abas:
 *   - Visão geral primeiro quando há anúncio (com mais de uma fonte, ela une todas; com uma, é a dela);
 *   - Meta: página da Meta (com mais fontes), Criativos e Público;
 *   - Google Ads: página do Google (com mais fontes) e Termos de pesquisa;
 *   - GA4: Site e, com anúncios, a Força dos canais;
 *   - Instagram e Página do Facebook: uma página cada, e Conteúdo (os posts);
 *   - Funil do objetivo no fim.
 * Sem conta nenhuma: o básico de exemplo (Visão geral, Campanhas, Funil).
 */
export function composePages(platforms: readonly string[]): PageId[] {
  const has = (p: string) => platforms.includes(p);
  const ads = ["meta", "google"].filter(has);
  const organic = ["instagram", "facebook"].filter(has);
  const sources = ads.length + (has("ga4") ? 1 : 0) + organic.length;
  if (sources === 0) return ["visao-geral", "campanhas", "funil"];
  const many = sources > 1;
  // a Visão geral é de anúncios: sem Meta nem Google, o dashboard começa pelo site ou pelo orgânico
  const out: PageId[] = ads.length ? ["visao-geral"] : [];
  if (has("meta")) out.push(...(many ? (["meta-ads"] as PageId[]) : []), "criativos", "publico");
  if (has("google")) out.push(...(many ? (["google-ads"] as PageId[]) : []), "termos");
  if (has("ga4")) out.push("site", ...(ads.length ? (["canais-site"] as PageId[]) : []));
  if (has("instagram")) out.push("instagram");
  if (has("facebook")) out.push("pagina-facebook");
  if (organic.length) out.push("conteudo");
  if (ads.length || has("ga4")) out.push("funil");
  return out;
}

export const isComposedTemplate = (t: Pick<DashboardTemplate, "composed">) => !!t.composed;
