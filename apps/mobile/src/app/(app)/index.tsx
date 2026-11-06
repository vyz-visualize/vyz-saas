// Início: saudação, o workspace e os dashboards, cada um já com o número
// principal dos últimos 30 dias e a curva (carregados em paralelo).

import type { ApiKpi, DashboardDataResponse, DashboardsResponse, MeResponse } from "@vyz/shared";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { Sparkline } from "@/ui/charts";
import { deltaTone, formatKpi } from "@/ui/format";
import { Chip, DeltaPill, Notice, PressCard, Skeleton } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

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

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [items, setItems] = useState<Summary[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await api<MeResponse>("/me");
      setMe(m);
      const ws = m.defaultWorkspaceId;
      const list = ws ? (await api<DashboardsResponse>(`/workspaces/${ws}/dashboards`)).dashboards : [];
      setItems(list);
      setError(null);
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const workspace = me?.workspaces.find((w) => w.id === me.defaultWorkspaceId);
  const first = me?.user.fullName.split(" ")[0];
  const initials = (me?.user.fullName || me?.user.email || "V").slice(0, 1).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        data={items}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={loading && !!me} onRefresh={load} tintColor={t.accent} />}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg2, fontSize: 14 }}>{greeting()}{first ? `, ${first}` : ""}</Text>
                <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 30, fontWeight: "800", letterSpacing: -0.9 }} numberOfLines={1}>
                  {workspace?.name ?? "VYZ"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conta"
                onPress={() => router.push("/conta")}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: t.accent, fontSize: 17, fontWeight: "800" }}>{initials}</Text>
              </Pressable>
            </View>
            <Notice text={error} />
            {items.length > 0 && (
              <Text style={{ color: t.fg2, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Seus dashboards · {items.length}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
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
