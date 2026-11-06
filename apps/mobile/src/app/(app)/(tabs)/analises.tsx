// Análises: tudo o que o VYZ encontrou nos dashboards do workspace, com o
// pulso de cada conta (investimento, receita, ROAS) e filtro por tom.

import type { ApiInsight, InsightsResponse } from "@vyz/shared";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { int, money } from "@/ui/format";
import { InsightCard } from "@/ui/insight";
import { Notice, SectionHeader, Segmented, Skeleton, tap } from "@/ui/kit";
import { radius, useTheme } from "@/ui/theme";

type Period = InsightsResponse["period"];
type Tone = "all" | ApiInsight["tone"];

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "mes", label: "Este mês" },
];
const TONES: { value: Tone; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "bad", label: "Atenção" },
  { value: "good", label: "Indo bem" },
  { value: "info", label: "Ideias" },
];

export default function Analises() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { workspace } = useWorkspace();
  const [period, setPeriod] = useState<Period>("7d");
  const [tone, setTone] = useState<Tone>("all");
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ws = workspace?.id;

  const load = useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      setData(await api<InsightsResponse>(`/workspaces/${ws}/insights?periodo=${period}`));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ws, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const list = (data?.insights ?? []).filter((i) => tone === "all" || i.tone === tone);
  const count = (k: ApiInsight["tone"]) => data?.insights.filter((i) => i.tone === k).length ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={load} tintColor={t.accent} />}
    >
      <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 30, fontWeight: "800", letterSpacing: -0.9 }}>
        Análises
      </Text>
      <Text style={{ color: t.fg2, fontSize: 14, marginTop: -6 }}>O VYZ lê suas contas e aponta o que mudou, o que vai bem e o que pede atenção.</Text>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <Notice text={error} />

      {data && data.insights.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { k: "bad" as const, label: "Atenção", fg: t.danger, bg: t.dangerSoft },
            { k: "good" as const, label: "Indo bem", fg: t.good, bg: t.goodSoft },
            { k: "info" as const, label: "Ideias", fg: t.accent, bg: t.accentSoft },
          ].map((c) => (
            <Pressable
              key={c.k}
              onPress={() => {
                tap();
                setTone(tone === c.k ? "all" : c.k);
              }}
              style={{ flex: 1, borderRadius: radius.lg, padding: 12, backgroundColor: c.bg, borderWidth: 1.5, borderColor: tone === c.k ? c.fg : "transparent" }}
            >
              <Text style={{ color: c.fg, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{count(c.k)}</Text>
              <Text style={{ color: c.fg, fontSize: 12, fontWeight: "700" }}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!data && loading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={100} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </View>
      ) : null}

      {data && data.insights.length === 0 && (
        <Notice tone="info" text="Nada fora do normal por enquanto. Assim que suas contas tiverem movimento suficiente, as análises aparecem aqui." />
      )}

      {tone !== "all" && <Segmented options={TONES} value={tone} onChange={setTone} />}
      <View style={{ gap: 10, opacity: loading ? 0.6 : 1 }}>
        {list.map((i) => (
          <InsightCard key={`${i.dashboardId}:${i.id}`} insight={i} />
        ))}
      </View>

      {data && data.pulse.length > 0 && (
        <>
          <SectionHeader title="Pulso das contas" caption={`Investimento e retorno · ${PERIODS.find((p) => p.value === period)?.label.toLowerCase()}`} />
          {data.pulse.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                tap();
                router.push({ pathname: "/dashboards/[id]", params: { id: p.id } });
              }}
              style={({ pressed }) => ({ borderRadius: radius.lg, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, padding: 14, gap: 10, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <Text style={{ color: t.fg, fontSize: 15.5, fontWeight: "700" }} numberOfLines={1}>
                {p.name} <Text style={{ color: t.fg3, fontWeight: "500" }}>· {p.platform === "meta" ? "Meta Ads" : "Google Ads"}</Text>
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {[
                  { l: "Investido", v: money(p.spend, p.currency) },
                  { l: "Receita", v: money(p.value, p.currency) },
                  { l: "Vendas", v: int(p.conversions) },
                  { l: "ROAS", v: p.roas !== null ? `${p.roas.toFixed(2).replace(".", ",")}×` : "—" },
                ].map((m) => (
                  <View key={m.l} style={{ gap: 2 }}>
                    <Text style={{ color: t.fg3, fontSize: 11.5, fontWeight: "600", textTransform: "uppercase" }}>{m.l}</Text>
                    <Text style={{ color: t.fg, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{m.v}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
