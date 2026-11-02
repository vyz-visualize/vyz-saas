// Catálogo dos templates de dashboard com dados de exemplo.
// Cada template é um arquivo em ./catalog/<id>.ts (nicho, fontes e páginas);
// os widgets de cada página vêm de ../pages. Template novo: crie o arquivo e
// acrescente aqui, no grupo do plano. Depois: npm run db:catalog.
// Guia: docs/TEMPLATES.md

import type { DashboardCategory, DashboardTemplate } from "../types";
import ecommerceVisaoGeral from "./catalog/ecommerce-visao-geral";
import leadsVisaoGeral from "./catalog/leads-visao-geral";
import imobiliarioLeads from "./catalog/imobiliario-leads";
import localWhatsapp from "./catalog/local-whatsapp";
import metaEssencial from "./catalog/meta-essencial";
import varejoLocal from "./catalog/varejo-local";
import googlePesquisa from "./catalog/google-pesquisa";
import criativosMeta from "./catalog/criativos-meta";
import funilGa4 from "./catalog/funil-ga4";
import infoproduto from "./catalog/infoproduto";
import agenciaCarteira from "./catalog/agencia-carteira";
import infoprodutoLancamento from "./catalog/infoproduto-lancamento";
import tiktokAds from "./catalog/tiktok-ads";
import marketplace from "./catalog/marketplace";
import crmLeadVenda from "./catalog/crm-lead-venda";
import comparativoCanais from "./catalog/comparativo-canais";
import metasPacing from "./catalog/metas-pacing";
import saudeConta from "./catalog/saude-conta";
import clinicasSaude from "./catalog/clinicas-saude";
import educacaoMatriculas from "./catalog/educacao-matriculas";
import youtubeVideo from "./catalog/youtube-video";
import relatorioExecutivo from "./catalog/relatorio-executivo";
import ecommerceCompleto from "./catalog/ecommerce-completo";

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  // ---- Básico
  ecommerceVisaoGeral,
  leadsVisaoGeral,
  imobiliarioLeads,
  localWhatsapp,
  metaEssencial,
  varejoLocal,
  // ---- Padrão
  googlePesquisa,
  criativosMeta,
  funilGa4,
  infoproduto,
  agenciaCarteira,
  infoprodutoLancamento,
  // ---- Avançado
  tiktokAds,
  marketplace,
  crmLeadVenda,
  comparativoCanais,
  metasPacing,
  saudeConta,
  clinicasSaude,
  educacaoMatriculas,
  youtubeVideo,
  relatorioExecutivo,
  ecommerceCompleto,
];

export const DASHBOARD_CATEGORIES: DashboardCategory[] = ["E-commerce", "Leads", "Imobiliário", "Negócio local", "Agência", "Mídia", "Executivo"];

export function dashboardTemplate(id: string): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find((t) => t.id === id);
}
