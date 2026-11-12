// Entrada das ações de dashboard (criar e editar), validada no servidor. O
// navegador só manda a escolha: plano, páginas liberadas e contas ativas são
// conferidos de novo no servidor e no banco.

import { z } from "zod";
import type { MetricId } from "@/features/metrics/definitions";
import { GOAL_METRICS, MAX_GOALS } from "./goals";
import { ATTRIBUTION_IDS, CUSTOM_DAYS_MAX, CUSTOM_DAYS_MIN, NAME_MAX } from "./model";

const text = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`);
const cents = z.number().int().min(0).max(1_000_000_000_00);

export const dashboardFieldsSchema = z.object({
  name: text(NAME_MAX).min(1, "Dê um nome ao dashboard."),
  client: text(NAME_MAX),
  goal: cents,
  budget: cents,
  /** 0 a 1; null = sem margem. */
  margin: z.number().gt(0).max(1).nullable(),
  period: z.enum(["7d", "30d", "mes", "custom"]),
  customDays: z.number().int().min(CUSTOM_DAYS_MIN).max(CUSTOM_DAYS_MAX),
  attribution: z.enum(ATTRIBUTION_IDS as [string, ...string[]]),
  pages: z.array(z.string().max(40)).min(1, "Escolha pelo menos uma página.").max(20),
  /** Contas de anúncio (só templates com dados reais). */
  accountIds: z.array(z.uuid()).max(30),
  /** Marca própria do dashboard (Personalizado). */
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor no formato #RRGGBB.")
    .nullable(),
  hideVyz: z.boolean(),
  /** Metas por métrica (editor). Sem o campo, as metas ficam como estão. */
  metricGoals: z
    .array(
      z.object({
        metric: z.enum(GOAL_METRICS as [MetricId, ...MetricId[]]),
        value: z.number().min(0).max(1e13),
        direction: z.enum(["max", "min"]),
        period: z.union([
          z.object({ kind: z.literal("month") }),
          z.object({ kind: z.literal("firstWeek") }),
          z.object({ kind: z.literal("custom"), from: z.iso.date(), to: z.iso.date() }).refine((p) => p.from <= p.to, "O fim vem depois do início."),
        ]),
        text: z.string().trim().max(200).optional(),
      }),
    )
    .max(MAX_GOALS)
    .optional(),
});

export const createDashboardSchema = dashboardFieldsSchema.extend({ templateId: z.string().min(1).max(60) });

export type DashboardFields = z.infer<typeof dashboardFieldsSchema>;
export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
