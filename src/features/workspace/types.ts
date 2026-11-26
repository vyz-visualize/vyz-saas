// Entidades salvas no Store. Datas em ISO.

import type { PlatformId } from "@/features/accounts/platforms";
import type { LandingContent } from "@/features/templates/landing-pages";
import type { PageId } from "@/features/templates/types";
import type { Brand } from "./workspace";
import { localDate } from "@/features/sync/dates";

export type PeriodId = "7d" | "30d" | "mes" | "custom";

export const PERIODS: { value: PeriodId; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "custom", label: "Personalizado" },
];

export const ATTRIBUTIONS = [
  { value: "7c1v", label: "7 dias após o clique e 1 dia após a visualização" },
  { value: "1c", label: "1 dia após o clique" },
  { value: "7c", label: "7 dias após o clique" },
  { value: "28c", label: "28 dias após o clique" },
];

export type DashboardSettings = {
  /** Meta de CPA ou CPL, em centavos. */
  goal: number;
  /** Margem (0–1). ROAS de equilíbrio = 1 ÷ margem. */
  margin: number;
  /** Verba mensal, em centavos (pacing). */
  budget: number;
  period: PeriodId;
  /** Dias do período personalizado. */
  customDays: number;
  attribution: string;
  currency: "BRL";
};

export type Dashboard = {
  id: string;
  templateId: string;
  name: string;
  client: string;
  accounts: Partial<Record<PlatformId, string>>;
  pages: PageId[];
  settings: DashboardSettings;
  brand?: Brand;
  createdAt: string;
  updatedAt: string;
};

export type Tracking = { gtm: string; pixel: string; adsConversion: string; ga4: string };

export type LandingPage = {
  id: string;
  templateId: string;
  content: LandingContent;
  tracking: Tracking;
  slug: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LandingDraft = Partial<LandingPage> & { step: number };

/**
 * Dias que o período cobre. "Este mês": até o dia de hoje no fuso de São Paulo (o mesmo do
 * `today` do dashboard), nunca o relógio da máquina: o servidor (UTC) e o navegador (Brasil)
 * dariam dias diferentes das 21h à meia-noite e o texto do período não bateria na hidratação.
 */
export function periodDays(s: Pick<DashboardSettings, "period" | "customDays">, today?: Date): number {
  switch (s.period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "mes":
      return Math.max(1, today ? today.getDate() : Number(localDate(new Date()).slice(8, 10)));
    case "custom":
      return Math.min(60, Math.max(3, s.customDays || 14));
  }
}
