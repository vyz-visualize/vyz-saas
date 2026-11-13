// Início: a faixa da marca com a saudação e o workspace (tocar troca), o
// atalho do A Fazer, os destaques das análises e os dashboards, cada um já com
// o número principal dos últimos 30 dias e a curva (carregados em paralelo).

import type { ApiInsight, ApiKpi, DashboardDataResponse, DashboardsResponse, InsightsResponse, TasksResponse } from "@vyz/shared";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { Sparkline } from "@/ui/charts";
import { deltaTone, formatKpi } from "@/ui/format";
import { IconChart, IconChevron, IconChevronDown } from "@/ui/icons";
import { InsightCard } from "@/ui/insight";
import { Avatar, Chip, DeltaPill, EmptyState, Notice, PressCard, SectionHeader, Skeleton, SkeletonCard, tap, TextAction } from "@/ui/kit";
import { useLayout } from "@/ui/layout";
import { radius, type as typo, useTheme } from "@/ui/theme";
import { WorkspaceSheet } from "@/ui/WorkspaceSheet";

type Summary = DashboardsResponse["dashboards"][number];
type Preview = { platform: "meta" | "google"; currency: string; kpi: ApiKpi | null; status: string };

const PLATFORM = { meta: "Meta Ads", google: "Google Ads" } as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** "sexta-feira, 13 de novembro" */
function today() {
  const d = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function headline(kpis: ApiKpi[]): ApiKpi | null {
  return kpis.find((k) => k.format === "money" && k.id !== "spend") ?? kpis[0] ?? null;
}

function DashboardCard({ item, preview }: { item: Summary; preview: Preview | null | undefined }) {
  const t = useTheme();
  const k = preview?.kpi;
  return (
    <PressCard label={`Abrir ${item.name}`} onPress={() => router.push({ pathname: "/dashboards/[id]", params: { id: item.id } })} style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.fg, ...typo.heading, fontSize: 16.5 }} numberOfLines={1}>
            {item.name}
          </Text>
          {!!item.clientName && (
            <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
              {item.clientName}
            </Text>
          )}
        </View>
        {preview ? <Chip label={PLATFORM[preview.platform]} tone="accent" /> : <IconChevron color={t.fg3} size={18} />}
      </View>
      {preview === undefined ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={11} width="46%" round={6} />
            <Skeleton height={26} width="64%" round={8} />
          </View>
          <Skeleton height={44} width={110} />
        </View>
      ) : k ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.fg2, ...typo.overline }} numberOfLines={1}>
              {k.label} · 30 dias
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ color: t.fg, fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.8, fontVariant: ["tabular-nums"] }}>{formatKpi(k, preview!.currency)}</Text>
              <DeltaPill delta={k.delta} tone={deltaTone(k)} />
            </View>
          </View>
          {k.spark && k.spark.length > 1 ? <Sparkline values={k.spark} width={110} height={44} /> : null}
        </View>
      ) : (
        <Text style={{ color: t.fg2, fontSize: 13.5, lineHeight: 19 }}>{preview?.status === "no_accounts" ? "Ligue uma conta no painel para ver os números." : "Toque para abrir."}</Text>
      )}
    </PressCard>
  );
}

function TodoCard({ open, late, fresh }: { open: number; late: number; fresh: number }) {
  const t = useTheme();
  const caption = open === 0 ? "Tudo em dia" : [late ? `${late} ${late === 1 ? "atrasada" : "atrasadas"}` : null, fresh ? `${fresh} ${fresh === 1 ? "nova do VYZ" : "novas do VYZ"}` : null].filter(Boolean).join(" · ") || "Por prioridade e prazo";
  return (
    <PressCard label={`A Fazer: ${open} ${open === 1 ? "tarefa aberta" : "tarefas abertas"}`} onPress={() => router.push("/a-fazer")} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: late ? t.dangerSoft : t.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: late ? t.danger : t.accent, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{open}</Text>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: t.fg, ...typo.heading, fontSize: 16.5 }}>A Fazer</Text>
        <Text style={{ color: late ? t.danger : t.fg2, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <IconChevron color={t.fg3} size={18} />
    </PressCard>
  );
}

export default function Home() {
  const t = useTheme();
  const L = useLayout();
  const { me, workspace, error: meError, refresh } = useWorkspace();
  const [items, setItems] = useState<Summary[]>([]);
  const [previews, setPreviews] = useState<Record<string, Preview | null>>({});
  const [highlights, setHighlights] = useState<ApiInsight[] | null>(null);
  const [todo, setTodo] = useState<{ open: number; late: number; fresh: number } | null>(null);
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
      api<TasksResponse>(`/workspaces/${ws}/tasks?abertas=1`)
        .then((r) => setTodo({ open: r.tasks.length, late: r.tasks.filter((x) => x.situation === "atrasado").length, fresh: r.tasks.filter((x) => x.isNew).length }))
        .catch(() => setTodo(null));
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
    setTodo(null);
    void load();
  }, [load]);

  const reload = () => {
    void refresh();
    void load();
  };

  const first = me?.user.fullName.split(" ")[0];
  const many = (me?.workspaces.length ?? 0) > 1;
  // telas largas (tablet, celular deitado): os dashboards em duas colunas
  const cols = L.wide ? 2 : 1;
  const failed = error ?? meError;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkspaceSheet open={picker} onClose={() => setPicker(false)} />
      <FlatList
        key={cols}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={[L.content, { paddingTop: L.top, paddingBottom: L.tabBarSpace, gap: 12 }]}
        data={items}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={reload} tintColor={t.accent} colors={[t.accent]} progressBackgroundColor={t.surface} />}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <LinearGradient colors={[t.heroFrom, t.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: 18, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable
                  disabled={!many}
                  accessibilityRole="button"
                  accessibilityLabel={many ? `Organização ${workspace?.name ?? ""}. Trocar de organização` : (workspace?.name ?? "VYZ")}
                  onPress={() => {
                    tap();
                    setPicker(true);
                  }}
                  style={({ pressed }) => ({ flex: 1, minHeight: 44, justifyContent: "center", opacity: pressed ? 0.75 : 1 })}
                >
                  <Text style={{ color: t.heroFg2, fontSize: 14, lineHeight: 19 }}>
                    {greeting()}
                    {first ? `, ${first}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text accessibilityRole="header" style={{ color: t.heroFg, fontSize: L.small ? 24 : 28, lineHeight: L.small ? 30 : 34, fontWeight: "800", letterSpacing: -0.8, flexShrink: 1 }} numberOfLines={1}>
                      {workspace?.name ?? "VYZ"}
                    </Text>
                    {many && <IconChevronDown color={t.heroFg2} size={20} />}
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Conta" hitSlop={6} onPress={() => router.navigate("/conta")} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                  <Avatar name={me?.user.fullName || me?.user.email || "V"} tone="hero" size={44} />
                </Pressable>
              </View>
              <View style={{ height: 1, backgroundColor: t.heroLine }} />
              <Text style={{ color: t.heroFg2, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
                {today()}
                {items.length > 0 ? ` · ${items.length} ${items.length === 1 ? "dashboard" : "dashboards"}` : ""}
              </Text>
            </LinearGradient>

            <Notice text={failed} onRetry={failed ? reload : undefined} />
            {todo && <TodoCard {...todo} />}
            {highlights === null && items.length > 0 ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Destaques da semana" caption="O que o VYZ encontrou nos últimos 7 dias" />
                <SkeletonCard lines={2} />
              </View>
            ) : null}
            {highlights && highlights.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Destaques da semana" caption="O que o VYZ encontrou nos últimos 7 dias" right={<TextAction label="Ver tudo" onPress={() => router.navigate("/analises")} />} />
                {highlights.map((i) => (
                  <InsightCard key={`${i.dashboardId}:${i.id}`} insight={i} />
                ))}
              </View>
            )}
            {items.length > 0 && <SectionHeader title="Seus dashboards" caption={`${items.length} ${items.length === 1 ? "dashboard" : "dashboards"} nesta organização`} />}
          </View>
        }
        ListEmptyComponent={
          // com erro, o aviso do topo (com "Tentar de novo") já diz o que houve
          failed ? undefined : loading || !ws ? (
            <View style={{ gap: 12 }}>
              <SkeletonCard lines={2} height={132} aside />
              <SkeletonCard lines={2} height={132} aside />
            </View>
          ) : (
            <EmptyState icon={<IconChart color={t.accent} size={26} />} title="Nenhum dashboard ainda" text="Crie o primeiro no painel, em vyzualize.com.br, e ele aparece aqui." />
          )
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: cols > 1 ? (L.contentWidth - 12) / 2 : undefined }}>
            <DashboardCard item={item} preview={previews[item.id]} />
          </View>
        )}
      />
    </View>
  );
}
