// Área logada: abas (Início, Análises, VYZ, Conta) e o dashboard por cima.
// Tocar numa notificação abre o dashboard dela (com a campanha ou o KPI).

import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { WorkspaceProvider } from "@/lib/workspace";
import { onPushOpen } from "@/lib/push";
import { useTheme } from "@/ui/theme";

export default function AppLayout() {
  const t = useTheme();
  useEffect(
    () =>
      onPushOpen((data) => {
        if (typeof data.dashboardId === "string") {
          router.push({ pathname: "/dashboards/[id]", params: { id: data.dashboardId, ...(data.campaignId ? { campanha: String(data.campaignId) } : {}), ...(data.metric ? { metrica: String(data.metric) } : {}) } });
        } else router.push("/analises");
      }),
    [],
  );
  return (
    <WorkspaceProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dashboards/[id]" />
      </Stack>
    </WorkspaceProvider>
  );
}
