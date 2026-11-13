"use client";

import type { PlatformId } from "@/features/accounts/platforms";
import type { DashboardSpec } from "@/features/dashboards/DashboardBody";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import type { Dataset } from "@/features/metrics/source";
import type { PageId } from "@/features/templates/types";

export function RealHarness({ dashboard, dataset, linkedPlatforms, page }: { dashboard: DashboardSpec & { id: string }; dataset: Dataset; linkedPlatforms: PlatformId[]; page?: string }) {
  return (
    <div className="min-h-dvh bg-bg p-4 lg:p-8">
      <SampleDashboard dashboard={dashboard} realData={dataset} linkedPlatforms={linkedPlatforms} initialPage={page as PageId | undefined} />
    </div>
  );
}
