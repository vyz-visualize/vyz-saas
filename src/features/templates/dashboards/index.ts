// Catálogo dos modelos de dashboard: os 6 visuais (um arquivo cada, em ./visuais) ×
// os objetivos (./composed.ts). As páginas de cada dashboard saem das contas ligadas.
// Visual novo: crie o arquivo em ./visuais e acrescente em ./visuais/index.ts.
// Depois: npm run db:catalog. Guia: docs/TEMPLATES.md

import type { DashboardCategory, DashboardTemplate } from "../types";
import { COMPOSED_TEMPLATES, templatesOf } from "./composed";
import { DRAFT_VISUALS } from "./visuais";

export const DASHBOARD_CATEGORIES: DashboardCategory[] = ["E-commerce", "Leads", "Imobiliário", "Negócio local", "Agência", "Mídia", "Executivo"];

/** Modelos dos visuais em rascunho: só existem fora de produção (bancada local). */
export const DRAFT_TEMPLATES: DashboardTemplate[] = process.env.NODE_ENV === "production" ? [] : templatesOf(DRAFT_VISUALS);

/** Modelo pelo id (os rascunhos também, mas só no ambiente local). */
export function dashboardTemplate(id: string): DashboardTemplate | undefined {
  return COMPOSED_TEMPLATES.find((t) => t.id === id) ?? DRAFT_TEMPLATES.find((t) => t.id === id);
}
