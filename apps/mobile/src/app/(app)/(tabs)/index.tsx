// Início: saudação, o workspace (tocar troca), os destaques das análises e os
// dashboards, cada um já com o número principal dos últimos 30 dias e a curva
// (carregados em paralelo).

import type { ApiInsight, ApiKpi, DashboardDataResponse, DashboardsResponse, InsightsResponse } from "@vyz/shared";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { InsightCard } from "@/ui/insight";
import { IconChevron } from "@/ui/icons";
import { Sparkline } from "@/ui/charts";
import { deltaTone, formatKpi } from "@/ui/format";
import { Chip, DeltaPill, Notice, PressCard, SectionHeader, Skeleton, tap } from "@/ui/kit";
import { radius, useTheme } from "@/ui/theme";

type Summary = DashboardsResponse["dashboards"][number];
type Preview = { platform: "meta" | "google"; currency: string; kpi: ApiKpi | null; status: string };

const PLATFORM = { meta: "Meta Ads", google: "Google Ads" } as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function headline(kpis: ApiKpi[]): ApiKpi | null {
  return kpis.find((k) => k.format === "money" && k.id !== "spend") ?? kpis[0] ?? null;
}

function DashboardCard({ item, preview }: { item: Summary; preview: Preview | null | undefined }) {
  const t = useTheme();
  const k = preview?.kpi;
  return (
    <PressCard label={`Abrir ${item.name}`} onPress={() => router.push({ pathname: "/dashboards/[id]", params: { id: item.id } })} style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: t.fg, fontSize: 17, fontWeight: "700", letterSpacing: -0.2 }} numberOfLines={1}>
            {item.name}
          </Text>
          {!!item.clientName && (
            <Text style={{ color: t.fg2, fontSize: 13 }} numberOfLines={1}>
              {item.clientName}
            </Text>
          )}
        </View>
        {preview && <Chip label={PLATFORM[preview.platform]} tone="accent" />}
      </View>
      {preview === undefined ? (
        <Skeleton height={56} />
      ) : k ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label} · 30 dias</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: t.fg, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, fontVariant: ["tabular-nums"] }}>{formatKpi(k, preview!.currency)}</Text>
              <DeltaPill delta={k.delta} tone={deltaTone(k)} />
            </View>
          </View>
          {k.spark && k.spark.length > 1 ? <Sparkline values={k.spark} width={110} height={44} /> : null}
        </View>
      ) : (
        <Text style={{ color: t.fg2, fontSize: 13.5 }}>{preview?.status === "no_accounts" ? "Ligue uma conta no painel para ver os números." : "Toque para abrir."}</Text>
      )}
    </PressCard>
  );
}

function WorkspacePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const { me, workspace, switchTo } = useWorkspace();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: t.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 40, gap: 8 }}>
          <Text style={{ color: t.fg, fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Trocar de workspace</Text>
          {me?.workspaces.map((w) => {
            const on = w.id === workspace?.id;
            return (
              <Pressable
                key={w.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  tap();
                  void switchTo(w.id);
                  onClose();
                }}
                style={{ padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : "transparent" }}
              >
                <Text style={{ color: t.fg, fontSize: 15.5, fontWeight: "700" }}>{w.name}</Text>
                <Text style={{ color: t.fg2, fontSize: 12.5 }}>{w.role === "owner" ? "Dono" : w.role === "admin" ? "Administrador" : w.role === "member" ? "Membro" : "Leitura"}</Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me, workspace, error: meError, refresh } = useWorkspace();
  const [items, setItems] = useState<Summary[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview | null>>({});
  const [highlights, setHighlights] = useState<ApiInsight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const ws = workspace?.id;

  const load = useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const list = (await api<DashboardsResponse>(`/workspaces/${ws}/dashboards`)).dashboards;
      setItems(list);
      setError(null);
      api<InsightsResponse>(`/workspaces/${ws}/insights?periodo=7d`)
        .then((r) => setHighlights(r.insights.slice(0, 3)))
        .catch(() => setHighlights([]));
      // prévia de cada dashboard em paralelo (as que falham ficam sem número)
      void Promise.all(
        list.slice(0, 8).map(async (d) => {
          try {
            const r = (await api<DashboardDataResponse>(`/dashboards/${d.id}?periodo=30d`)).dashboard;
            setPreviews((p) => ({ ...p, [d.id]: { platform: r.platform, currency: r.currency, kpi: r.status === "ok" ? headline(r.view.kpis) : null, status: r.status } }));
          } catch {
            setPreviews((p) => ({ ...p, [d.id]: null }));
          }
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ws]);

  useEffect(() => {
    setItems([]);
    setPreviews({});
    setHighlights(null);
    void load();
  }, [load]);

  const first = me?.user.fullName.split(" ")[0];
  const initials = (me?.user.fullName || me?.user.email || "V").slice(0, 1).toUpperCase();
  const many = (me?.workspaces.length ?? 0) > 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkspacePicker open={picker} onClose={() => setPicker(false)} />
      <FlatList
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        data={items}
        keyExtractor={(d) => d.id}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={() => {
              void refresh();
              void load();
            }}
            tintColor={t.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable disabled={!many} accessibilityRole="button" accessibilityLabel="Trocar de workspace" onPress={() => setPicker(true)} style={{ flex: 1 }}>
                <Text style={{ color: t.fg2, fontSize: 14 }}>
                  {greeting()}
                  {first ? `, ${first}` : ""}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 30, fontWeight: "800", letterSpacing: -0.9, flexShrink: 1 }} numberOfLines={1}>
                    {workspace?.name ?? "VYZ"}
                  </Text>
                  {many && <View style={{ transform: [{ rotate: "90deg" }], marginTop: 4 }}><IconChevron color={t.fg2} size={18} /></View>}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conta"
                onPress={() => router.navigate("/conta")}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: t.accent, fontSize: 17, fontWeight: "800" }}>{initials}</Text>
              </Pressable>
            </View>
            <Notice text={error ?? meError} />
            {highlights === null && items.length > 0 ? <Skeleton height={110} /> : null}
            {highlights && highlights.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionHeader
                  title="Destaques da semana"
                  caption="O que o VYZ encontrou nos últimos 7 dias"
                  right={
                    <Pressable onPress={() => router.navigate("/analises")} hitSlop={8}>
                      <Text style={{ color: t.accent, fontSize: 14, fontWeight: "700" }}>Ver tudo</Text>
                    </Pressable>
                  }
                />
                {highlights.map((i) => (
                  <InsightCard key={`${i.dashboardId}:${i.id}`} insight={i} />
                ))}
              </View>
            )}
            {items.length > 0 && <SectionHeader title="Seus dashboards" caption={`${items.length} ${items.length === 1 ? "dashboard" : "dashboards"} neste workspace`} />}
          </View>
        }
        ListEmptyComponent={
          loading || !ws ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={130} />
              <Skeleton height={130} />
            </View>
          ) : (
            <Text style={{ color: t.fg2, fontSize: 15, lineHeight: 22 }}>Nenhum dashboard ainda. Crie o primeiro no painel, em vyzualize.com.br, e ele aparece aqui.</Text>
          )
        }
        renderItem={({ item }) => <DashboardCard item={item} preview={previews[item.id]} />}
      />
    </View>
  );
}
