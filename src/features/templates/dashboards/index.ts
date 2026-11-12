// Catálogo dos modelos de dashboard: os 5 visuais (um arquivo cada, em ./visuais) ×
// os objetivos (./composed.ts). As páginas de cada dashboard saem das contas ligadas.
// Visual novo: crie o arquivo em ./visuais e acrescente em ./visuais/index.ts.
// Depois: npm run db:catalog. Guia: docs/TEMPLATES.md

import type { DashboardCategory, DashboardTemplate } from "../types";
import { COMPOSED_TEMPLATES } from "./composed";

export const DASHBOARD_CATEGORIES: DashboardCategory[] = ["E-commerce", "Leads", "Imobiliário", "Negócio local", "Agência", "Mídia", "Executivo"];

/** Modelo pelo id. */
export function dashboardTemplate(id: string): DashboardTemplate | undefined {
  return COMPOSED_TEMPLATES.find((t) => t.id === id);
}
