// Cartão de análise automática: tom (bom, atenção, informação), frase e
// números. Tocar abre o dashboard com a campanha ou o KPI em foco.

import type { ApiInsight } from "@vyz/shared";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { tap } from "./kit";
import { radius, useTheme } from "./theme";

const LABEL = { good: "Indo bem", bad: "Atenção", info: "Oportunidade" } as const;

export function InsightCard({ insight, showDashboard = true, onPress }: { insight: ApiInsight; showDashboard?: boolean; onPress?: () => void }) {
  const t = useTheme();
  const fg = insight.tone === "good" ? t.good : insight.tone === "bad" ? t.danger : t.accent;
  const bg = insight.tone === "good" ? t.goodSoft : insight.tone === "bad" ? t.dangerSoft : t.accentSoft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${LABEL[insight.tone]}: ${insight.title}`}
      onPress={() => {
        tap();
        if (onPress) return onPress();
        router.push({ pathname: "/dashboards/[id]", params: { id: insight.dashboardId, ...(insight.campaignId ? { campanha: insight.campaignId } : {}), ...(insight.metric ? { metrica: insight.metric } : {}) } });
      }}
      style={({ pressed }) => ({ flexDirection: "row", gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, padding: 14, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View style={{ width: 4, borderRadius: 2, backgroundColor: fg }} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: fg, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}>{LABEL[insight.tone]}</Text>
          </View>
          {showDashboard && (
            <Text style={{ color: t.fg3, fontSize: 12, flex: 1 }} numberOfLines={1}>
              {insight.dashboardName}
            </Text>
          )}
        </View>
        <Text style={{ color: t.fg, fontSize: 15.5, fontWeight: "700", letterSpacing: -0.2 }}>{insight.title}</Text>
        <Text style={{ color: t.fg2, fontSize: 13.5, lineHeight: 19 }}>{insight.body}</Text>
      </View>
    </Pressable>
  );
}
