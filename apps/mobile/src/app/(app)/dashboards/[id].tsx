// Dashboard: o indicador escolhido em destaque com o gráfico que se lê com o
// dedo, os cartões (tocar troca o gráfico), campanhas, funil, criativos e
// canais. Os números vêm prontos do servidor (os mesmos do site).

import type { ApiKpi, DashboardDataResponse } from "@vyz/shared";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { AreaChart, ShareBar, Sparkline } from "@/ui/charts";
import { formatKpi, deltaTone, int, money, pct, shortDate } from "@/ui/format";
import { Card, Chip, DeltaPill, Notice, SectionHeader, Segmented, Skeleton, tap } from "@/ui/kit";
import { radius, useTheme } from "@/ui/theme";

type Data = DashboardDataResponse["dashboard"];
type Period = "7d" | "30d" | "mes";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "mes", label: "Este mês" },
];

const PLATFORM: Record<Data["platform"], string> = { meta: "Meta Ads", google: "Google Ads" };

function Hero({ data, kpi }: { data: Data; kpi: ApiKpi }) {
  const t = useTheme();
  const [at, setAt] = useState<number | null>(null);
  const series = kpi.spark ?? [];
  const dates = (data.view.daily ?? []).map((d) => d.date);
  const labels = series.map((_, i) => (dates.length === series.length ? shortDate(dates[i]) : String(i + 1)));
  const maturing = data.maturingFrom && dates.length === series.length ? dates.indexOf(data.maturingFrom) : -1;
  const shown = at !== null && series[at] !== undefined ? { ...kpi, value: series[at] } : kpi;

  return (
    <Card style={{ paddingBottom: 8, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: t.fg2, fontSize: 13.5, fontWeight: "600" }}>{kpi.label}</Text>
        <Text style={{ color: t.fg3, fontSize: 12.5, fontVariant: ["tabular-nums"] }}>{at !== null ? labels[at] : `${shortDate(data.current.from)} – ${shortDate(data.current.to)}`}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ color: t.fg, fontSize: 38, fontWeight: "800", letterSpacing: -1.2, fontVariant: ["tabular-nums"] }} adjustsFontSizeToFit numberOfLines={1}>
          {formatKpi(shown, data.currency, false)}
        </Text>
        {at === null && <DeltaPill delta={kpi.delta} tone={deltaTone(kpi)} size="md" />}
      </View>
      <Text style={{ color: t.fg3, fontSize: 12.5 }}>{at === null ? (kpi.note ?? "vs. período anterior · arraste no gráfico") : "valor do dia"}</Text>
      {series.length > 1 ? (
        <View style={{ marginHorizontal: -16, marginTop: 6 }}>
          <AreaChart values={series} labels={labels} maturingFrom={maturing >= 0 ? maturing : null} onScrub={setAt} />
        </View>
      ) : null}
    </Card>
  );
}

function KpiTile({ kpi, currency, active, onPress }: { kpi: ApiKpi; currency: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: "48.5%",
        borderRadius: radius.lg,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? t.accent : t.line,
        backgroundColor: active ? t.accentSoft : t.surface,
        padding: 14,
        gap: 6,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 }} numberOfLines={1}>
        {kpi.label}
      </Text>
      <Text style={{ color: t.fg, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
        {formatKpi(kpi, currency)}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <DeltaPill delta={kpi.delta} tone={deltaTone(kpi)} />
        {kpi.spark && kpi.spark.length > 1 ? <Sparkline values={kpi.spark} width={60} height={22} color={active ? t.accent : t.fg3} /> : null}
      </View>
    </Pressable>
  );
}

function Campaigns({ data }: { data: Data }) {
  const t = useTheme();
  const list = [...(data.view.campaigns ?? [])].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 6);
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Campanhas" caption="As que mais investem no período" />
      <Card style={{ gap: 14 }}>
        {list.map((c) => (
          <View key={c.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(c.spend, data.currency)}</Text>
            </View>
            <ShareBar share={c.spendShare} />
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Text style={{ color: t.fg2, fontSize: 12.5 }}>{pct(c.spendShare, 0)} da verba</Text>
              {c.roas !== null && <Text style={{ color: t.fg2, fontSize: 12.5 }}>ROAS {c.roas.toFixed(2).replace(".", ",")}</Text>}
              <Text style={{ color: t.fg2, fontSize: 12.5 }}>{int(c.conversions)} conv.</Text>
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function Funnel({ data }: { data: Data }) {
  const t = useTheme();
  const all = data.view.funnel ?? [];
  // impressões são outra escala (milhões): o funil começa no clique quando elas achatam as barras
  const steps = all.length > 2 && all[0].count > all[1].count * 10 ? all.slice(1) : all;
  if (steps.length < 2) return null;
  const top = steps[0].count || 1;
  return (
    <>
      <SectionHeader title="Funil" caption="Do clique à compra" />
      <Card style={{ gap: 12 }}>
        {steps.map((s, i) => (
          <View key={s.id} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: t.fg, fontSize: 14 }}>{s.label}</Text>
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{int(s.count)}</Text>
            </View>
            <ShareBar share={s.count / top} color={i === steps.length - 1 ? t.good : t.accent} />
            {s.rate !== null && i > 0 && <Text style={{ color: t.fg3, fontSize: 12 }}>{pct(s.rate)} da etapa anterior</Text>}
          </View>
        ))}
      </Card>
    </>
  );
}

function Creatives({ data }: { data: Data }) {
  const t = useTheme();
  const list = [...(data.view.creatives ?? [])].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 10);
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Criativos" caption="Arraste para o lado" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }} style={{ marginRight: -16 }}>
        {list.map((c) => (
          <View key={c.id} style={{ width: 168, borderRadius: radius.lg, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
            <View style={{ height: 168, backgroundColor: t.surface2 }}>
              {c.thumbnailUrl ? <Image source={{ uri: c.thumbnailUrl }} style={{ flex: 1 }} contentFit="cover" transition={200} /> : null}
              <View style={{ position: "absolute", left: 8, top: 8 }}>
                <Chip label={c.format} />
              </View>
            </View>
            <View style={{ padding: 10, gap: 4 }}>
              <Text style={{ color: t.fg, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={{ color: t.fg, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{c.roas !== null ? `ROAS ${c.roas.toFixed(2).replace(".", ",")}` : money(c.spend, data.currency)}</Text>
              <Text style={{ color: t.fg2, fontSize: 12 }}>
                {money(c.spend, data.currency)} · {int(c.conversions)} conv.
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

function Channels({ data }: { data: Data }) {
  const t = useTheme();
  const list = data.view.channels ?? [];
  if (!list.length) return null;
  const total = list.reduce((n, c) => n + (c.spend ?? 0), 0) || 1;
  return (
    <>
      <SectionHeader title="Tipos de campanha" caption="Pesquisa, Performance Max, Shopping…" />
      <Card style={{ gap: 14 }}>
        {list.map((c) => (
          <View key={c.channel} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "600" }}>{c.label}</Text>
              <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(c.spend, data.currency)}</Text>
            </View>
            <ShareBar share={(c.spend ?? 0) / total} />
            {c.roas !== null && <Text style={{ color: t.fg2, fontSize: 12.5 }}>ROAS {c.roas.toFixed(2).replace(".", ",")}</Text>}
          </View>
        ))}
      </Card>
    </>
  );
}

function Loading() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton height={280} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Skeleton height={110} width="48.5%" />
        <Skeleton height={110} width="48.5%" />
      </View>
      <Skeleton height={220} />
    </View>
  );
}

export default function DashboardScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await api<DashboardDataResponse>(`/dashboards/${id}?periodo=${period}`)).dashboard);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => data?.view.kpis ?? [], [data]);
  const hero = kpis.find((k) => k.id === metric) ?? kpis.find((k) => k.format === "money" && k.id !== "spend") ?? kpis[0];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={load} tintColor={t.accent} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.fg, fontSize: 20, marginTop: -2 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }} numberOfLines={1}>
              {data?.dashboard.name ?? " "}
            </Text>
            <Text style={{ color: t.fg2, fontSize: 13 }} numberOfLines={1}>
              {data ? [data.dashboard.clientName, PLATFORM[data.platform]].filter(Boolean).join(" · ") : " "}
            </Text>
          </View>
        </View>

        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <Notice text={error} />

        {!data && loading ? <Loading /> : null}
        {data?.status === "no_accounts" && <Notice tone="info" text="Nenhuma conta ativa neste dashboard. Ligue uma conta no painel para ver os números." />}
        {data?.status === "no_data" && <Notice tone="info" text="Os dados deste período ainda estão chegando." />}

        {data && hero && (
          <View style={{ opacity: loading ? 0.6 : 1, gap: 12 }}>
            <Hero key={`${hero.id}:${period}`} data={data} kpi={hero} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
              {kpis.map((k) => (
                <KpiTile key={k.id} kpi={k} currency={data.currency} active={k.id === hero.id} onPress={() => setMetric(k.id)} />
              ))}
            </View>
            <Campaigns data={data} />
            <Funnel data={data} />
            <Creatives data={data} />
            <Channels data={data} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
