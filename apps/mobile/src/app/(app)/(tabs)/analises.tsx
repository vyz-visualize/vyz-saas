// Análises: tudo o que o VYZ encontrou nos dashboards do workspace, com o
// pulso de cada conta (investimento, receita, ROAS) e filtro por tom.

import type { ApiInsight, InsightsResponse } from "@vyz/shared";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { int, money } from "@/ui/format";
import { IconAlert, IconCheck, IconPulse, IconSpark } from "@/ui/icons";
import { InsightCard } from "@/ui/insight";
import { Chip, EmptyState, Notice, PressCard, ScreenHeader, SectionHeader, Segmented, SkeletonCard, tap } from "@/ui/kit";
import { useLayout } from "@/ui/layout";
import { radius, type as typo, useTheme } from "@/ui/theme";

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
  const L = useLayout();
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
  // em telas estreitas, os quatro números do pulso viram duas linhas de dois
  const pulseBasis = L.contentWidth < 340 ? "50%" : "25%";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[L.content, { paddingTop: L.top, paddingBottom: L.tabBarSpace, gap: 12 }]}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={load} tintColor={t.accent} colors={[t.accent]} progressBackgroundColor={t.surface} />}
    >
      <ScreenHeader title="Análises" caption="O VYZ lê suas contas e aponta o que mudou, o que vai bem e o que pede atenção." />
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      <Notice text={error} onRetry={load} />

      {data && data.insights.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { k: "bad" as const, label: "Atenção", fg: t.danger, bg: t.dangerSoft, Icon: IconAlert },
            { k: "good" as const, label: "Indo bem", fg: t.good, bg: t.goodSoft, Icon: IconCheck },
            { k: "info" as const, label: "Ideias", fg: t.accent, bg: t.accentSoft, Icon: IconSpark },
          ].map((c) => {
            const on = tone === c.k;
            return (
              <Pressable
                key={c.k}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${c.label}: ${count(c.k)}. ${on ? "Tirar o filtro" : "Filtrar"}`}
                onPress={() => {
                  tap();
                  setTone(on ? "all" : c.k);
                }}
                style={({ pressed }) => ({ flex: 1, minHeight: 78, borderRadius: radius.lg, padding: 12, backgroundColor: c.bg, borderWidth: 1.5, borderColor: on ? c.fg : "transparent", gap: 2, opacity: pressed ? 0.8 : 1 })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: c.fg, fontSize: 26, lineHeight: 31, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{count(c.k)}</Text>
                  <c.Icon color={c.fg} size={18} strokeWidth={2.2} />
                </View>
                <Text style={{ color: c.fg, fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!data && loading && !error ? (
        <View style={{ gap: 10 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : null}

      {data && data.insights.length === 0 && (
        <EmptyState icon={<IconPulse color={t.accent} size={26} />} title="Nada fora do normal por enquanto" text="Assim que suas contas tiverem movimento suficiente, as análises aparecem aqui." />
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
            <PressCard key={p.id} label={`Abrir ${p.name}`} onPress={() => router.push({ pathname: "/dashboards/[id]", params: { id: p.id } })} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ color: t.fg, ...typo.heading, flex: 1 }} numberOfLines={1}>
                  {p.name}
                </Text>
                <Chip label={p.platform === "meta" ? "Meta Ads" : "Google Ads"} tone="accent" />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
                {[
                  { l: "Investido", v: money(p.spend, p.currency) },
                  { l: "Receita", v: money(p.value, p.currency) },
                  { l: "Vendas", v: int(p.conversions) },
                  { l: "ROAS", v: p.roas !== null ? `${p.roas.toFixed(2).replace(".", ",")}×` : "—" },
                ].map((m) => (
                  <View key={m.l} style={{ width: pulseBasis, gap: 2, paddingRight: 6 }}>
                    <Text style={{ color: t.fg3, ...typo.overline, fontSize: 11 }} numberOfLines={1}>
                      {m.l}
                    </Text>
                    <Text style={{ color: t.fg, fontSize: 16, lineHeight: 21, fontWeight: "800", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {m.v}
                    </Text>
                  </View>
                ))}
              </View>
            </PressCard>
          ))}
        </>
      )}
    </ScrollView>
  );
}
