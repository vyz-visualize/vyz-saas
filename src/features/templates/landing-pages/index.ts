// Catálogo dos templates de landing page.
// Cada template é um arquivo em ./catalog/<id>.ts (textos padrão, seções e
// campos). Template novo: crie o arquivo e acrescente aqui, no grupo do plano.
// Depois: npm run db:catalog. Guia: docs/TEMPLATES.md

import type { LandingContent, LandingSection, LandingTemplate } from "./types";
import capturaLeads from "./catalog/captura-leads";
import produtoOferta from "./catalog/produto-oferta";
import whatsapp from "./catalog/whatsapp";
import linkNaBio from "./catalog/link-na-bio";
import empreendimento from "./catalog/empreendimento";
import evento from "./catalog/evento";
import servicoLocal from "./catalog/servico-local";
import diagnosticoGratuito from "./catalog/diagnostico-gratuito";
import lancamento from "./catalog/lancamento";
import clinica from "./catalog/clinica";
import educacao from "./catalog/educacao";
import sazonal from "./catalog/sazonal";
import restauranteDelivery from "./catalog/restaurante-delivery";

export * from "./types";

export const LANDING_TEMPLATES: LandingTemplate[] = [
  // ---- Básico
  capturaLeads,
  produtoOferta,
  whatsapp,
  linkNaBio,
  // ---- Padrão
  empreendimento,
  evento,
  servicoLocal,
  diagnosticoGratuito,
  // ---- Avançado
  lancamento,
  clinica,
  educacao,
  sazonal,
  restauranteDelivery,
];

export function landingTemplate(id: string): LandingTemplate | undefined {
  return LANDING_TEMPLATES.find((t) => t.id === id);
}

/** Conteúdo inicial a partir do template. */
export function landingDefaults(t: LandingTemplate, brand = "Sua marca"): LandingContent {
  return { ...t.defaults, sections: { ...t.defaults.sections }, fields: [...t.defaults.fields], brand, whatsapp: "" };
}

export const LANDING_SECTIONS: LandingSection[] = ["beneficios", "prova", "oferta", "agenda", "local", "galeria", "contagem", "faq", "whatsapp"];
