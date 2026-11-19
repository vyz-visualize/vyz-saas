// Entidades salvas no Store. Datas em ISO.

import type { PlatformId } from "@/features/accounts/platforms";
import type { LandingContent } from "@/features/templates/landing-pages";
import type { PageId } from "@/features/templates/types";
import type { Brand } from "./workspace";

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

export function periodDays(s: Pick<DashboardSettings, "period" | "customDays">, today = new Date()): number {
  switch (s.period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "mes":
      return Math.max(1, today.getDate());
    case "custom":
      return Math.min(60, Math.max(3, s.customDays || 14));
  }
}
