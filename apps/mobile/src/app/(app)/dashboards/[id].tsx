// Dashboard: o indicador escolhido em destaque com o gráfico que se lê com o
// dedo, os cartões (tocar troca o gráfico), as análises do VYZ, campanhas
// (tocar filtra o dashboard inteiro), funil, criativos, público, regiões,
// dispositivos, termos de pesquisa, produtos e horários. Os números vêm
// prontos do servidor (os mesmos do site, com os mesmos filtros).

import type { ApiInsight, ApiKpi, ApiSearchTerm, ApiSlice, DashboardDataResponse } from "@vyz/shared";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, RefreshControl, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { ENV } from "@/lib/env";
import { IconBack, IconClose, IconShare, IconSpark } from "@/ui/icons";
import { InsightCard } from "@/ui/insight";
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

function Campaigns({ data, selected, onSelect }: { data: Data; selected: string | null; onSelect: (id: string) => void }) {
  const t = useTheme();
  const [all, setAll] = useState(false);
  const sorted = [...(data.view.campaigns ?? [])].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const list = all ? sorted : sorted.slice(0, 6);
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Campanhas" caption={selected ? "Toque de novo para tirar o filtro" : "Toque numa campanha para filtrar o dashboard"} />
      <Card style={{ gap: 4 }}>
        {list.map((c) => {
          const on = c.id === selected;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onSelect(c.id);
              }}
              style={({ pressed }) => ({ gap: 6, padding: 10, marginHorizontal: -10, borderRadius: radius.md, backgroundColor: on ? t.accentSoft : pressed ? t.surface2 : "transparent" })}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(c.spend, data.currency)}</Text>
              </View>
              <ShareBar share={c.spendShare} color={c.belowBreakEven ? t.danger : undefined} />
              <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
                <Text style={{ color: t.fg2, fontSize: 12.5 }}>{pct(c.spendShare, 0)} da verba</Text>
                {c.roas !== null && <Text style={{ color: c.belowBreakEven ? t.danger : t.fg2, fontSize: 12.5 }}>ROAS {c.roas.toFixed(2).replace(".", ",")}</Text>}
                <Text style={{ color: t.fg2, fontSize: 12.5 }}>{int(c.conversions)} conv.</Text>
                {c.cpa !== null && <Text style={{ color: t.fg2, fontSize: 12.5 }}>CPA {money(c.cpa, data.currency)}</Text>}
              </View>
            </Pressable>
          );
        })}
        {sorted.length > 6 && (
          <Pressable onPress={() => setAll(!all)} style={{ paddingTop: 8, alignItems: "center" }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>{all ? "Mostrar menos" : `Ver todas (${sorted.length})`}</Text>
          </Pressable>
        )}
      </Card>
    </>
  );
}

/** Lista de fatias (público, regiões, dispositivos, posicionamentos). */
function Slices({ title, caption, items, currency }: { title: string; caption: string; items: (ApiSlice & { share?: number })[] | undefined; currency: string }) {
  const t = useTheme();
  const list = (items ?? []).filter((i) => (i.spend ?? 0) > 0 || i.value > 0).slice(0, 6);
  if (!list.length) return null;
  const top = Math.max(...list.map((i) => i.valueShare ?? i.spendShare ?? 0), 0.0001);
  return (
    <>
      <SectionHeader title={title} caption={caption} />
      <Card style={{ gap: 12 }}>
        {list.map((i) => (
          <View key={i.key} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: t.fg, fontSize: 14, flex: 1 }} numberOfLines={1}>
                {i.label}
              </Text>
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(i.value, currency)}</Text>
            </View>
            <ShareBar share={(i.valueShare ?? i.spendShare ?? 0) / top} />
            <Text style={{ color: t.fg3, fontSize: 12 }}>
              {money(i.spend, currency)} investidos · {int(i.conversions)} conv.{i.roas !== null ? ` · ROAS ${i.roas.toFixed(2).replace(".", ",")}` : ""}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

const GENDER: Record<string, string> = { female: "Mulheres", male: "Homens", unknown: "Outros" };

function Audience({ data }: { data: Data }) {
  const cells = [...(data.view.ageGender ?? [])].sort((a, b) => b.valueShare - a.valueShare);
  const items: ApiSlice[] = cells.map((c) => ({ key: `${c.age}:${c.gender}`, label: `${GENDER[c.gender] ?? c.gender} · ${c.age}`, spend: c.spend, value: c.value, valueShare: c.valueShare, conversions: c.conversions, roas: c.roas }));
  return <Slices title="Público" caption="Quem mais compra (idade e gênero)" items={items} currency={data.currency} />;
}

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Hours({ data }: { data: Data }) {
  const t = useTheme();
  const cells = data.view.heatmap ?? [];
  if (!cells.length) return null;
  const byDay = WEEK.map((_, d) => cells.filter((c) => c.weekday === d).reduce((n, c) => n + c.conversions, 0));
  const byHour = Array.from({ length: 24 }, (_, h) => cells.filter((c) => c.hour === h).reduce((n, c) => n + c.conversions, 0));
  const maxD = Math.max(...byDay, 1);
  const maxH = Math.max(...byHour, 1);
  const best = byHour.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v).slice(0, 3);
  return (
    <>
      <SectionHeader title="Quando vende" caption="Conversões por dia da semana e hora" />
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 90 }}>
          {byDay.map((v, d) => (
            <View key={d} style={{ alignItems: "center", gap: 6, flex: 1 }}>
              <View style={{ width: 22, height: Math.max(4, (v / maxD) * 64), borderRadius: 6, backgroundColor: v === maxD ? t.accent : t.surface2 }} />
              <Text style={{ color: t.fg2, fontSize: 11.5 }}>{WEEK[d]}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 44 }}>
          {byHour.map((v, h) => (
            <View key={h} style={{ flex: 1, height: Math.max(3, (v / maxH) * 44), borderRadius: 2, backgroundColor: best.some((b) => b.h === h) ? t.accent : t.surface2 }} />
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: t.fg3, fontSize: 11 }}>0h</Text>
          <Text style={{ color: t.fg3, fontSize: 11 }}>12h</Text>
          <Text style={{ color: t.fg3, fontSize: 11 }}>23h</Text>
        </View>
        <Text style={{ color: t.fg2, fontSize: 13 }}>Picos: {best.map((b) => `${b.h}h`).join(", ")}</Text>
      </Card>
    </>
  );
}

function Terms({ title, caption, terms, currency, bad }: { title: string; caption: string; terms: ApiSearchTerm[] | undefined; currency: string; bad?: boolean }) {
  const t = useTheme();
  const list = (terms ?? []).slice(0, 8);
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title={title} caption={caption} />
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {list.map((x, i) => (
          <View key={`${x.term}:${i}`} style={{ flexDirection: "row", gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {x.term}
              </Text>
              <Text style={{ color: t.fg3, fontSize: 12 }} numberOfLines={1}>
                {int(x.clicks)} cliques · {x.campaignName}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: bad ? t.danger : t.fg, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(x.spend, currency)}</Text>
              <Text style={{ color: t.fg3, fontSize: 12 }}>{bad ? "sem venda" : `${int(x.conversions)} conv.`}</Text>
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function Products({ data }: { data: Data }) {
  const t = useTheme();
  const list = [...(data.view.products ?? [])].sort((a, b) => b.value - a.value).slice(0, 8);
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Produtos" caption="Os que mais vendem pelos anúncios" />
      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {list.map((p, i) => (
          <View key={p.id} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: t.surface2, overflow: "hidden" }}>{p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ flex: 1 }} contentFit="cover" /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={{ color: t.fg3, fontSize: 12 }}>
                {int(p.conversions)} vendas · {pct(p.valueShare, 0)} da receita
              </Text>
            </View>
            <Text style={{ color: t.fg, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money(p.value, data.currency)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function ImpressionShare({ data }: { data: Data }) {
  const t = useTheme();
  const is = data.view.impressionShare;
  if (!is || is.share === null) return null;
  const parts = [
    { l: "Aparecendo", v: is.share, c: t.accent },
    { l: "Perde por orçamento", v: is.lostBudget ?? 0, c: t.danger },
    { l: "Perde por classificação", v: is.lostRank ?? 0, c: t.fg3 },
  ];
  return (
    <>
      <SectionHeader title="Parcela de impressões" caption="Pesquisa: quanto da demanda você alcança" />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: t.surface2 }}>
          {parts.map((p) => (
            <View key={p.l} style={{ width: `${Math.max(0, p.v) * 100}%`, backgroundColor: p.c }} />
          ))}
        </View>
        {parts.map((p) => (
          <View key={p.l} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.c }} />
              <Text style={{ color: t.fg, fontSize: 14 }}>{p.l}</Text>
            </View>
            <Text style={{ color: t.fg, fontSize: 14, fontWeight: "700" }}>{pct(p.v, 0)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function Insights({ list, onCampaign, onMetric }: { list: ApiInsight[]; onCampaign: (id: string) => void; onMetric: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Análise do VYZ" caption="O que mudou e o que fazer" />
      {list.map((i) => (
        <InsightCard key={i.id} insight={i} showDashboard={false} onPress={() => (i.campaignId ? onCampaign(i.campaignId) : i.metric ? onMetric(i.metric) : undefined)} />
      ))}
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
              {c.hookRate != null && <Text style={{ color: t.fg3, fontSize: 12 }}>Retenção 3 s: {pct(c.hookRate, 0)}</Text>}
              {c.fatigue && c.fatigue.ctrChange <= -0.2 && <Text style={{ color: t.danger, fontSize: 12, fontWeight: "700" }}>Sinais de cansaço</Text>}
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
  const params = useLocalSearchParams<{ id: string; campanha?: string; metrica?: string }>();
  const id = params.id;
  const [period, setPeriod] = useState<Period>("30d");
  const [campaign, setCampaign] = useState<string | null>(params.campanha ?? null);
  // dashboards com Meta e Google: "Tudo · Meta · Google" (as opções ficam as da primeira leitura completa)
  const [platform, setPlatform] = useState<"all" | "meta" | "google">("all");
  const [available, setAvailable] = useState<("meta" | "google")[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [insights, setInsights] = useState<ApiInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<string | null>(params.metrica ?? null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (params.campanha) setCampaign(params.campanha);
    if (params.metrica) setMetric(params.metrica);
  }, [params.campanha, params.metrica]);

  const search = [campaign ? `campanha=${encodeURIComponent(campaign)}` : "", platform !== "all" ? `plataforma=${platform}` : ""].filter(Boolean).join("&");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<DashboardDataResponse>(`/dashboards/${id}?periodo=${period}${search ? `&${search}` : ""}`);
      setData(r.dashboard);
      if (r.dashboard.platforms && r.dashboard.platforms.length > 1) setAvailable(r.dashboard.platforms);
      setInsights(r.insights ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, period, search]);

  useEffect(() => {
    void load();
  }, [load]);

  // o nome da campanha filtrada (a lista filtrada só tem ela)
  useEffect(() => {
    if (!campaign) return setCampaignName(null);
    const found = data?.view.campaigns?.find((c) => c.id === campaign)?.name ?? data?.view.filterInfo?.labels?.campaigns?.[campaign];
    if (found) setCampaignName(found);
  }, [campaign, data]);

  const kpis = useMemo(() => data?.view.kpis ?? [], [data]);
  const hero = kpis.find((k) => k.id === metric) ?? kpis.find((k) => k.format === "money" && k.id !== "spend") ?? kpis[0];

  const toggleCampaign = (cid: string) => {
    setCampaign((cur) => (cur === cid ? null : cid));
    scroll.current?.scrollTo({ y: 0, animated: true });
  };
  const share = () => {
    if (!data) return;
    void Share.share({ message: `${data.dashboard.name}: ${ENV.apiUrl}/painel/dashboards/${data.dashboard.id}`, url: `${ENV.apiUrl}/painel/dashboards/${data.dashboard.id}` });
  };
  const askVyz = () =>
    router.navigate({ pathname: "/vyz", params: { dashboardId: id, search, nome: campaignName ?? data?.dashboard.name ?? "", q: "Quanto investi esse mês?" } });

  const round = { width: 38, height: 38, borderRadius: 19, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" } as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={load} tintColor={t.accent} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10} style={round}>
            <IconBack color={t.fg} size={20} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }} numberOfLines={1}>
              {data?.dashboard.name ?? " "}
            </Text>
            <Text style={{ color: t.fg2, fontSize: 13 }} numberOfLines={1}>
              {data ? [data.dashboard.clientName, available.length > 1 && platform === "all" ? "Meta Ads + Google Ads" : PLATFORM[data.platform]].filter(Boolean).join(" · ") : " "}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar" onPress={share} hitSlop={10} style={round}>
            <IconShare color={t.fg} size={19} />
          </Pressable>
        </View>

        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        {available.length > 1 && (
          <Segmented
            options={[{ value: "all" as const, label: "Tudo" }, ...available.map((p) => ({ value: p, label: p === "meta" ? "Meta Ads" : "Google Ads" }))]}
            value={platform}
            onChange={(v) => {
              setCampaign(null);
              setPlatform(v);
            }}
          />
        )}
        {campaign && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tirar filtro"
            onPress={() => {
              tap();
              setCampaign(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: t.accentSoft, borderColor: t.accent, borderWidth: 1, borderRadius: radius.pill, paddingLeft: 12, paddingRight: 8, paddingVertical: 6, maxWidth: "100%" }}
          >
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
              Campanha: {campaignName ?? "filtrada"}
            </Text>
            <IconClose color={t.accent} size={16} />
          </Pressable>
        )}
        <Notice text={error} />

        {!data && loading ? <Loading /> : null}
        {data?.status === "no_accounts" && <Notice tone="info" text="Nenhuma conta ativa neste dashboard. Ligue uma conta no painel para ver os números." />}
        {data?.status === "no_data" && <Notice tone="info" text="Os dados deste período ainda estão chegando." />}

        {data && hero && (
          <View style={{ opacity: loading ? 0.6 : 1, gap: 12 }}>
            <Hero key={`${hero.id}:${period}:${campaign}`} data={data} kpi={hero} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
              {kpis.map((k) => (
                <KpiTile key={k.id} kpi={k} currency={data.currency} active={k.id === hero.id} onPress={() => setMetric(k.id)} />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tap();
                askVyz();
              }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <IconSpark color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.fg, fontSize: 15, fontWeight: "700" }}>Perguntar ao VYZ</Text>
                <Text style={{ color: t.fg2, fontSize: 12.5 }}>Sobre {campaignName ? "esta campanha" : "este dashboard"}, em português</Text>
              </View>
            </Pressable>
            <Insights
              list={campaign ? [] : insights}
              onCampaign={toggleCampaign}
              onMetric={(m) => {
                setMetric(m);
                scroll.current?.scrollTo({ y: 0, animated: true });
              }}
            />
            <Campaigns data={data} selected={campaign} onSelect={toggleCampaign} />
            <Funnel data={data} />
            <Site data={data} />
            <Creatives data={data} />
            <Audience data={data} />
            <Slices title="Posicionamentos" caption="Feed, Stories, Reels…" items={data.view.placements} currency={data.currency} />
            <Channels data={data} />
            <ImpressionShare data={data} />
            <Terms title="Termos que vendem" caption="O que as pessoas pesquisaram antes de comprar" terms={data.view.searchTerms?.filter((x) => x.conversions > 0)} currency={data.currency} />
            <Terms title="Termos sem venda" caption={data.view.wastedSpend ? `${money(data.view.wastedSpend, data.currency)} gastos sem conversão · candidatos a negativar` : "Gastaram sem converter"} terms={data.view.wastedTerms} currency={data.currency} bad />
            <Products data={data} />
            <Hours data={data} />
            <Slices title="Regiões" caption="Onde estão os compradores" items={data.view.regions} currency={data.currency} />
            <Slices title="Dispositivos" caption="Celular, computador, tablet" items={data.view.devices} currency={data.currency} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Site (GA4) das propriedades ligadas: sessões, conversões e receita, e os canais. */
function Site({ data }: { data: Data }) {
  const t = useTheme();
  const site = data.site;
  if (!site || (!site.sessions && !site.previousSessions)) return null;
  const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);
  const top = site.channels[0]?.sessions || 1;
  const stats = [
    { label: "Sessões", value: int(site.sessions), d: delta(site.sessions, site.previousSessions) },
    { label: "Conversões", value: int(site.conversions), d: delta(site.conversions, site.previousConversions) },
    { label: "Receita", value: money(site.revenue, data.currency), d: null },
  ];
  return (
    <>
      <SectionHeader title="Site (GA4)" caption="Sessões e conversões do site, por canal" />
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {stats.map((x) => (
            <View key={x.label} style={{ gap: 2 }}>
              <Text style={{ color: t.fg2, fontSize: 12.5 }}>{x.label}</Text>
              <Text style={{ color: t.fg, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{x.value}</Text>
              {x.d !== null && <Text style={{ color: x.d >= 0 ? t.good : t.danger, fontSize: 12 }}>{`${x.d >= 0 ? "+" : ""}${pct(x.d)}`}</Text>}
            </View>
          ))}
        </View>
        {site.channels.map((c) => (
          <View key={c.channel} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: t.fg, fontSize: 14 }}>{c.channel}</Text>
              <Text style={{ color: t.fg2, fontSize: 13, fontVariant: ["tabular-nums"] }}>{`${int(c.sessions)} sessões · ${int(c.conversions)} conv.`}</Text>
            </View>
            <ShareBar share={c.sessions / top} color={t.accent} />
          </View>
        ))}
      </Card>
    </>
  );
}
