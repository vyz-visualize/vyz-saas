// DTOs da central de compartilhamento (montados em src/server/share/queries.ts).

import type { ReportFormat, ReportFrequency } from "./schedule";

export type ShareLinkItem = {
  id: string;
  dashboardId: string;
  dashboardName: string;
  tokenHint: string;
  /** Para quem é o link (nulo = sem nome). */
  recipientName: string | null;
  hideSpend: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  /** Quem criou ou admin pode revogar (o banco confere de novo). */
  canRevoke: boolean;
};

export type ReportItem = {
  id: string;
  dashboardId: string;
  dashboardName: string;
  frequency: ReportFrequency;
  weekday: number | null;
  monthDay: number | null;
  sendHour: number;
  timezone: string;
  format: ReportFormat;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  recipients: string[];
  createdAt: string;
};

export type ExportItem = { id: string; dashboardId: string | null; dashboardName: string; kind: "pdf"; createdAt: string };

export type DeliveryItem = {
  id: string;
  dashboardName: string | null;
  status: "queued" | "sent" | "failed";
  channel: "email" | "whatsapp";
  recipientsCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  error: string | null;
  createdAt: string;
};

export type ShareCenter = { links: ShareLinkItem[]; reports: ReportItem[]; exports: ExportItem[]; deliveries: DeliveryItem[] };
