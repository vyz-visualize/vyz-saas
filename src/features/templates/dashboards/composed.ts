// Modelos novos: o cliente escolhe o VISUAL e o OBJETIVO; as PÁGINAS saem das contas
// que ele liga ao dashboard. Cada visual × objetivo é um modelo no catálogo (o banco
// confere o modelo e as plataformas), com todas as páginas possíveis; o dashboard guarda
// só as que as contas pedem (composePages).

import type { PlatformId } from "@/features/accounts/platforms";
import { metric, type Profile } from "@/features/metrics/definitions";
import type { Tier } from "@/features/pricing/entitlements";
import { VISUAL_LIST } from "./visuais";
import { API_AD_PLATFORMS, IMPORT_PLATFORMS, isGenericAdPlatform } from "@/features/accounts/connection-modes";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import type { DashboardCategory, DashboardTemplate, PageId, PageLayout, SkinId } from "../types";

export type VisualId = "vyz" | "lavanda" | "pulso" | "noturno" | "areia" | "fachada";
export type Visual = {
  id: VisualId;
  name: string;
  skin?: SkinId;
  tier: Exclude<Tier, "personalizado">;
  description: string;
  /** Rascunho: só aparece na bancada local (/dev/templates); fica fora da galeria, do onboarding e do banco. */
  draft?: boolean;
  /**
   * Disposição própria das abas padrão neste visual (a primeira aba é desenhada pelo skin).
   * Recebe a aba, a disposição padrão dela e como pedir a de outra aba; null = fica a padrão.
   */
  layout?: (page: PageId, base: PageLayout, standard: (page: PageId) => PageLayout) => PageLayout | null;
};

/** Os visuais oferecidos (um arquivo cada, em ./visuais). */
export const VISUALS: Visual[] = VISUAL_LIST;

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

/** Também podem ser ligadas: as plataformas que entram por planilha (CSV ou Google Sheets) e os CRMs. Não entram na amostra. */
export const LINKABLE_SOURCES: PlatformId[] = [...COMPOSED_SOURCES, ...API_AD_PLATFORMS, ...IMPORT_PLATFORMS, ...CRM_PLATFORMS];

/** Todas as páginas que um modelo novo pode ter (o banco aceita só estas). */
export const COMPOSED_PAGES: PageId[] = ["visao-geral", "meta-ads", "criativos", "publico", "google-ads", "termos", "site", "canais-site", "crm", "instagram", "pagina-facebook", "conteudo", "criativos-ao-vivo", "previsao", "mmm", "metas", "comparativo", "funil", "campanhas"];

export type FeatureId = "metas" | "comparativo" | "criativos-ao-vivo" | "previsao" | "mmm";
export type Feature = { id: FeatureId; label: string; hint: string; tier: Exclude<Tier, "personalizado">; /** Plataformas que o recurso precisa (alguma delas). */ needs?: string[] };

/** Recursos que a pessoa liga no novo dashboard, depois das plataformas. */
export const FEATURES: Feature[] = [
  { id: "metas", label: "Metas e pacing", hint: "Barras de progresso da verba e das conversões no mês, com a projeção.", tier: "pro", needs: ["meta", "google"] },
  { id: "comparativo", label: "Comparativo de períodos", hint: "Este período contra o anterior e o mesmo período do ano passado.", tier: "pro" },
  { id: "criativos-ao-vivo", label: "Comparativo de criativos", hint: "Os anúncios lado a lado: o que entrega, o que cansou e o que escalar.", tier: "avancado", needs: ["meta"] },
  { id: "previsao", label: "Análise preditiva", hint: "Onde o mês fecha em investimento, conversões e custo, com a faixa de confiança.", tier: "avancado", needs: ["meta", "google"] },
  { id: "mmm", label: "Mix de mídia (MMM)", hint: "Quanto cada canal contribui de verdade e para onde mover a verba.", tier: "avancado", needs: ["meta", "google"] },
];

/** O recurso faz sentido com as plataformas escolhidas? */
export const featureFits = (f: Feature, platforms: readonly string[]) => !f.needs || f.needs.some((p) => platforms.includes(p));

export const composedId = (visual: VisualId, objective: ObjectiveId) => `${visual}-${objective}`;

/** Os modelos de uma lista de visuais (cada visual × cada objetivo). */
export const templatesOf = (visuals: readonly Visual[]): DashboardTemplate[] => visuals.flatMap((v) =>
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

export const COMPOSED_TEMPLATES: DashboardTemplate[] = templatesOf(VISUALS);

/** Páginas de uma plataforma só: os números delas vêm filtrados para aquela plataforma. */
export const PAGE_PLATFORM: Partial<Record<PageId, PlatformId>> = { "meta-ads": "meta", criativos: "meta", publico: "meta", "google-ads": "google", termos: "google" };

/**
 * As páginas que as contas escolhidas pedem, na ordem das abas:
 *   - Visão geral primeiro quando há anúncio (com mais de uma fonte, ela une todas; com uma, é a dela);
 *   - Meta: página da Meta (com mais fontes, já com o público dentro) e Criativos; só com a Meta, Criativos e Público;
 *   - Google Ads: página do Google (com mais fontes) e Termos de pesquisa;
 *   - GA4: Site e, com anúncios, a Força dos canais;
 *   - CRM (RD Station, HubSpot, Pipedrive, Kommo): a página do CRM, cruzada com a mídia;
 *   - Instagram e Página do Facebook: uma página cada, e Conteúdo (os posts);
 *   - Recursos escolhidos (metas, comparativos, preditiva, MMM) antes do funil;
 *   - Funil do objetivo no fim.
 * Sem conta nenhuma: o básico de exemplo (Visão geral, Campanhas, Funil).
 */
export function composePages(platforms: readonly string[], features: readonly FeatureId[] = []): PageId[] {
  const has = (p: string) => platforms.includes(p);
  const ads = ["meta", "google"].filter(has);
  // planilha: mídia de outras plataformas (TikTok, LinkedIn...) com os mesmos números de anúncio
  const sheets = platforms.filter((p) => isGenericAdPlatform(p));
  const organic = ["instagram", "facebook"].filter(has);
  const crm = CRM_PLATFORMS.some(has);
  const sources = ads.length + sheets.length + (has("ga4") ? 1 : 0) + (crm ? 1 : 0) + organic.length;
  if (sources === 0) return ["visao-geral", "campanhas", "funil"];
  const many = sources > 1;
  // a Visão geral é de anúncios: sem Meta nem Google, o dashboard começa pelo site ou pelo orgânico
  const out: PageId[] = ads.length || sheets.length ? ["visao-geral"] : [];
  // com a página da Meta, o público fica dentro dela; sem ela (só a Meta), ganha página própria
  if (has("meta")) out.push(...(many ? (["meta-ads", "criativos"] as PageId[]) : (["criativos", "publico"] as PageId[])));
  if (has("google")) out.push(...(many ? (["google-ads"] as PageId[]) : []), "termos");
  if (has("ga4")) out.push("site", ...(ads.length ? (["canais-site"] as PageId[]) : []));
  if (crm) out.push("crm");
  if (has("instagram")) out.push("instagram");
  if (has("facebook")) out.push("pagina-facebook");
  if (organic.length) out.push("conteudo");
  // recursos escolhidos, na ordem do catálogo, só os que combinam com as plataformas
  for (const f of FEATURES) if (features.includes(f.id) && featureFits(f, platforms)) out.push(f.id);
  if (sheets.length) out.push("campanhas");
  if (ads.length || sheets.length || has("ga4")) out.push("funil");
  return out;
}

export const isComposedTemplate = (t: Pick<DashboardTemplate, "composed">) => !!t.composed;

// ---- métricas fortes nos modelos novos --------------------------------------------------
// O topo da Visão geral e das páginas de cada plataforma traz sempre as métricas que o
// mercado usa para ler mídia paga, na ordem de leitura: quanto foi investido, o que voltou,
// a eficiência e a entrega (CTR, CPC, CPM). Muda só o resultado de cada objetivo.

type Kpis = PageLayout["kpis"];

const SALES: Kpis = [
  { metric: "spend", sub: "budget" },
  { metric: "revenue", sub: "delta" },
  { metric: "roas", sub: "breakEven", highlight: true },
  { metric: "conversions", sub: "split" },
  { metric: "cpa", sub: "goal" },
  { metric: "ticket", sub: "delta" },
  { metric: "ctr", sub: "delta" },
  { metric: "cpm", sub: "delta" },
];
const LEADS: Kpis = [
  { metric: "spend", sub: "budget" },
  { metric: "leads", sub: "split" },
  { metric: "cpl", sub: "goal", highlight: true },
  { metric: "conversions", sub: "delta" },
  { metric: "cpa", sub: "delta" },
  { metric: "ctr", sub: "delta" },
  { metric: "cpc", sub: "delta" },
  { metric: "cpm", sub: "delta" },
];
const CONTACTS: Kpis = [
  { metric: "spend", sub: "budget" },
  { metric: "conversions", sub: "split" },
  { metric: "cpa", sub: "goal", highlight: true },
  { metric: "calls", sub: "delta" },
  { metric: "clicks", sub: "delta" },
  { metric: "ctr", sub: "delta" },
  { metric: "cpc", sub: "delta" },
  { metric: "cpm", sub: "delta" },
];

const KPIS_BY_PROFILE: Partial<Record<Profile, Kpis>> = {
  ecommerce: SALES,
  infoproduto: SALES,
  leads: LEADS,
  educacao: LEADS,
  saude: LEADS,
  imob: [{ metric: "spend", sub: "budget" }, { metric: "leads", sub: "split" }, { metric: "qualified", sub: "ofLeads" }, { metric: "cplq", sub: "goal", highlight: true }, { metric: "visits", sub: "delta" }, { metric: "ctr", sub: "delta" }, { metric: "cpc", sub: "delta" }, { metric: "cpm", sub: "delta" }],
  local: CONTACTS,
  agencia: [{ metric: "spend", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta", highlight: true }, { metric: "roas", sub: "delta" }, { metric: "clicks", sub: "delta" }, { metric: "ctr", sub: "delta" }, { metric: "cpc", sub: "delta" }, { metric: "cpm", sub: "delta" }],
};

const isSales = (p: Profile) => p === "ecommerce" || p === "infoproduto";

/** Layout das páginas principais dos modelos novos (null = o padrão da página). */
export function composedLayout(page: PageId, profile: Profile): PageLayout | null {
  const listed = KPIS_BY_PROFILE[profile];
  if (!listed) return null;
  // nome repetido não entra duas vezes: no objetivo de leads, conversões também se chamam "Leads"
  // e o custo por conversão, "Custo por lead" (e os números são os mesmos)
  const names = new Set<string>();
  const kpis = listed.filter((k) => {
    const name = metric(k.metric, profile).label;
    if (names.has(name)) return false;
    names.add(name);
    return true;
  });
  const efficiency = profile === "leads" || profile === "educacao" || profile === "saude" ? "cpl" : profile === "imob" ? "cplq" : "cpa";
  // o gráfico diário troca de métrica: as do topo da página, começando pela eficiência
  const trend = { type: "trend" as const, metrics: [efficiency as "cpa", ...kpis.map((k) => k.metric).filter((m) => m !== efficiency)], span: 2 as const, rows: 12 };
  const byCampaign = isSales(profile)
    ? { type: "ranking" as const, metric: "roas" as const, span: 1 as const, title: "ROAS por campanha" }
    : { type: "ranking" as const, metric: "cpa" as const, span: 1 as const, title: "Custo por resultado, por campanha" };
  if (page === "visao-geral") return { kpis, widgets: [trend, { type: "funnel", span: 1, title: "Funil" }, byCampaign] };
  // Meta: tendência e ranking em cima; público, posicionamentos, estados e horas no meio; campanhas embaixo
  if (page === "meta-ads")
    return {
      kpis: [...kpis.filter((k) => k.metric !== "cpm"), { metric: "frequency", sub: "delta" }],
      widgets: [
        trend,
        byCampaign,
        { type: "breakdown", dimension: "placement", platform: "meta", span: 1, rows: 12, title: "Posicionamentos" },
        { type: "audience", span: 2, rows: 11, title: "Público que converte" },
        { type: "breakdown", dimension: "region", platform: "meta", span: 1, rows: 11, title: "Estados" },
        { type: "breakdown", dimension: "hour", platform: "meta", span: 1, rows: 11, title: "Horários" },
        { type: "table", source: "campaigns", span: 4, title: "Campanhas da Meta" },
      ],
    };
  // Google: tendência, ranking e termos que só gastam; vídeos do YouTube, dispositivos e horas; campanhas
  if (page === "google-ads")
    return {
      kpis,
      widgets: [
        trend,
        byCampaign,
        { type: "searchTerms", view: "waste", span: 1, rows: 12, title: "Termos que gastam sem converter" },
        { type: "videos", platform: "google", span: 2, rows: 11, title: "YouTube · retenção dos vídeos" },
        { type: "breakdown", dimension: "device", platform: "google", span: 1, rows: 11, title: "Dispositivos" },
        { type: "breakdown", dimension: "hour", platform: "google", span: 1, rows: 11, title: "Horários" },
        { type: "table", source: "campaigns", span: 4, title: "Campanhas do Google Ads" },
      ],
    };
  // Público (dashboard só com a Meta, sem a página dela): quem converte e onde
  if (page === "publico")
    return {
      kpis: [],
      widgets: [
        { type: "audience", span: 2, rows: 12, title: "Público que converte" },
        { type: "breakdown", dimension: "placement", platform: "meta", span: 1, rows: 12, title: "Posicionamentos" },
        { type: "breakdown", dimension: "region", platform: "meta", span: 1, rows: 12, title: "Estados" },
        { type: "breakdown", dimension: "hour", platform: "meta", span: 2, rows: 10, title: "Horários" },
        { type: "breakdown", dimension: "device", platform: "meta", span: 2, rows: 10, title: "Dispositivos" },
      ],
    };
  // Termos de pesquisa: a tabela completa e o desperdício; palavras, correspondência e dispositivos
  if (page === "termos")
    return {
      kpis: [
        { metric: "clicks", sub: "delta" },
        { metric: "ctr", sub: "delta" },
        { metric: "cpc", sub: "delta" },
        { metric: "conversions", sub: "delta" },
        { metric: efficiency as "cpa", sub: "goal", highlight: true },
        ...(isSales(profile) ? [{ metric: "roas" as const, sub: "breakEven" as const }] : []),
      ],
      widgets: [
        { type: "searchTerms", view: "table", span: 3, rows: 16, title: "Termos de pesquisa" },
        { type: "searchTerms", view: "waste", span: 1, rows: 16, title: "Gastam sem converter" },
        { type: "searchTerms", view: "words", span: 2, rows: 9, title: "Palavras que convertem" },
        { type: "searchTerms", view: "match", span: 1, rows: 9, title: "Tipo de correspondência" },
        { type: "breakdown", dimension: "device", platform: "google", span: 1, rows: 9, title: "Dispositivos" },
      ],
    };
  return null;
}
