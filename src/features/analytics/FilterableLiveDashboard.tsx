"use client";

// O dashboard com dados reais ligado à URL: clicar troca o endereço e o servidor refaz
// a conta. As prévias usam o LiveDashboardView direto, sem filtros.

import { usePathname, useRouter } from "next/navigation";
import { LiveDashboardView, type LiveDashboardViewProps } from "./LiveDashboardView";

export function FilterableLiveDashboard(props: LiveDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  return <LiveDashboardView {...props} filterNavigate={(search) => router.replace(`${pathname}${search}`, { scroll: false })} />;
}
