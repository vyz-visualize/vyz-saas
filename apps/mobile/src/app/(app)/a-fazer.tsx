// A Fazer: as tarefas abertas do workspace, por prioridade e prazo. Tocar no
// círculo conclui; tocar na tarefa abre as opções de status. As tarefas que o
// VYZ cria a partir dos dados chegam com o selo "Novo". Tarefa com mudança
// proposta mostra o "de → para" e o botão Aplicar (vai direto para a
// plataforma); as mudanças aplicadas ficam no fim, com Desfazer.

import { TASK_PRIORITY_LABEL, TASK_SITUATION_LABEL, TASK_STAGE_LABEL, TASK_STATUS_LABEL, type ApiOptimizationRun, type ApiTask, type ApiTaskStatus, type OptimizationRunResponse, type TaskPatchResponse, type TasksResponse } from "@vyz/shared";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { IconBolt, IconCheck, IconClock, IconListChecks, IconUndo } from "@/ui/icons";
import { Button, Card, Chip, Divider, EmptyState, ListRow, NavHeader, Notice, SectionHeader, Sheet, SkeletonCard, tap, tapDone, type ChipTone } from "@/ui/kit";
import { useLayout } from "@/ui/layout";
import { elevation, HIT, radius, useTheme } from "@/ui/theme";

const STATUSES: ApiTaskStatus[] = ["planejado", "em_andamento", "concluido", "cancelado"];
const RUN_STATUS: Record<ApiOptimizationRun["status"], string> = { applied: "Aplicada", failed: "Falhou", undone: "Desfeita", undo_failed: "Falha ao desfazer" };
const PRIORITY_TONE: Record<ApiTask["priority"], ChipTone> = { alta: "bad", media: "accent", baixa: "neutral" };
const shortDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null);

function TaskItem({ task, canEdit, onDone, onOpen }: { task: ApiTask; canEdit: boolean; onDone: () => void; onOpen: () => void }) {
  const t = useTheme();
  const late = task.situation === "atrasado";
  const prio = task.priority === "alta" ? t.danger : task.priority === "media" ? t.accent : t.fg3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. Prioridade ${TASK_PRIORITY_LABEL[task.priority]}. ${TASK_SITUATION_LABEL[task.situation]}`}
      onPress={() => {
        tap();
        onOpen();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 4,
        paddingVertical: 12,
        paddingRight: 14,
        paddingLeft: 4,
        borderRadius: radius.lg,
        backgroundColor: pressed ? t.surface2 : t.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.line,
        ...elevation(t, 1),
      })}
    >
      {/* o círculo de concluir tem a área de toque inteira (44 pt), maior que o desenho */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Concluir ${task.title}`}
        disabled={!canEdit}
        onPress={() => {
          tapDone();
          onDone();
        }}
        style={({ pressed }) => ({ width: HIT, height: HIT, alignItems: "center", justifyContent: "center", opacity: canEdit ? 1 : 0.5, marginTop: -8 })}
      >
        {({ pressed }) => (
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: prio, backgroundColor: pressed ? prio : "transparent", alignItems: "center", justifyContent: "center" }}>{pressed ? <IconCheck color={t.card} size={14} strokeWidth={3} /> : null}</View>
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ color: t.fg, fontSize: 15.5, fontWeight: "700", lineHeight: 21 }}>{task.title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {task.isNew && <Chip label="Novo" tone="accent" />}
          {task.actionText && canEdit ? <Chip label="Aplicar" tone="good" /> : null}
          <Chip label={TASK_PRIORITY_LABEL[task.priority]} tone={PRIORITY_TONE[task.priority]} />
          <Chip label={TASK_STATUS_LABEL[task.status]} />
          {task.projectName ? <Chip label={task.projectName} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <IconClock color={late ? t.danger : t.fg3} size={13} />
          <Text style={{ color: late ? t.danger : t.fg2, fontSize: 12.5, lineHeight: 17, fontWeight: late ? "700" : "500" }}>
            {task.dueDate ? `${TASK_SITUATION_LABEL[task.situation]} · ${shortDate(task.dueDate)}` : TASK_SITUATION_LABEL[task.situation]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function AFazer() {
  const t = useTheme();
  const L = useLayout();
  const { workspace } = useWorkspace();
  const ws = workspace?.id;
  const [data, setData] = useState<TasksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ApiTask | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      setData(await api<TasksResponse>(`/workspaces/${ws}/tasks?abertas=1`));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ws]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(task: ApiTask, status: ApiTaskStatus) {
    if (!ws || status === task.status) return;
    const before = data;
    const closes = status === "concluido" || status === "cancelado";
    setData((d) => (d ? { ...d, tasks: closes ? d.tasks.filter((x) => x.id !== task.id) : d.tasks.map((x) => (x.id === task.id ? { ...x, status, isNew: false } : x)) } : d));
    try {
      await api<TaskPatchResponse>(`/workspaces/${ws}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch (err) {
      setData(before);
      setError((err as Error).message);
    }
  }

  async function apply(task: ApiTask) {
    if (!ws || busy) return;
    setBusy(true);
    try {
      await api<OptimizationRunResponse>(`/workspaces/${ws}/tasks/${task.id}/apply`, { method: "POST" });
      setOpen(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
      setOpen(null);
    } finally {
      setBusy(false);
    }
  }

  async function undo(run: ApiOptimizationRun) {
    if (!ws || busy) return;
    setBusy(true);
    try {
      await api<OptimizationRunResponse>(`/workspaces/${ws}/optimizations/${run.id}/undo`, { method: "POST" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tasks = data?.tasks ?? [];
  const late = tasks.filter((x) => x.situation === "atrasado").length;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        contentContainerStyle={[L.content, { paddingTop: L.top, paddingBottom: L.bottom, gap: 10 }]}
        data={tasks}
        keyExtractor={(x) => x.id}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={() => void load()} tintColor={t.accent} colors={[t.accent]} progressBackgroundColor={t.surface} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <NavHeader
              large
              title="A Fazer"
              caption={data ? `${tasks.length} ${tasks.length === 1 ? "aberta" : "abertas"}${late ? ` · ${late} ${late === 1 ? "atrasada" : "atrasadas"}` : ""}` : " "}
              onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            />
            <Notice text={error} onRetry={() => void load()} />
          </View>
        }
        ListEmptyComponent={
          loading && !data ? (
            error ? undefined : (
              <View style={{ gap: 10 }}>
                <SkeletonCard lines={2} height={92} />
                <SkeletonCard lines={2} height={92} />
                <SkeletonCard lines={2} height={92} />
              </View>
            )
          ) : data ? (
            <EmptyState icon={<IconListChecks color={t.accent} size={26} />} title="Nada a fazer por enquanto" text="Quando os números de um dashboard mudarem, o VYZ cria a tarefa aqui." />
          ) : undefined
        }
        ListFooterComponent={
          data?.runs?.length ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              <SectionHeader title="Mudanças aplicadas" caption="O que já foi para a plataforma" />
              {data.runs.map((r) => {
                const failed = r.status === "failed" || r.status === "undo_failed";
                return (
                  <Card key={r.id} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <Text style={{ flex: 1, color: r.status === "undone" ? t.fg2 : t.fg, fontSize: 14.5, lineHeight: 20, fontWeight: "600", textDecorationLine: r.status === "undone" ? "line-through" : "none" }}>{r.description}</Text>
                      <Chip label={RUN_STATUS[r.status]} tone={failed ? "bad" : r.status === "applied" ? "good" : "neutral"} />
                    </View>
                    <Text style={{ color: failed ? t.danger : t.fg2, fontSize: 12.5, lineHeight: 17 }}>{[new Date(r.appliedAt).toLocaleDateString("pt-BR"), r.mode === "auto" ? "Automático" : "Com aprovação", r.error].filter(Boolean).join(" · ")}</Text>
                    {r.canUndo && data.canEdit ? <Button size="sm" tone="secondary" inline label="Desfazer" icon={<IconUndo color={t.fg} size={15} />} disabled={busy} onPress={() => void undo(r)} /> : null}
                  </Card>
                );
              })}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => <TaskItem task={item} canEdit={!!data?.canEdit} onDone={() => void setStatus(item, "concluido")} onOpen={() => setOpen(item)} />}
      />

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        caption={open ? [TASK_STAGE_LABEL[open.stage], open.projectName, open.source === "insight" ? "Criada pelo VYZ a partir dos dados" : null].filter(Boolean).join(" · ") : undefined}
      >
        {open && (
          <>
            {open.detail ? <Text style={{ color: t.fg, fontSize: 14.5, lineHeight: 21 }}>{open.detail}</Text> : null}
            {open.actionText && data?.canEdit ? (
              <View style={{ gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: t.accent, backgroundColor: t.accentSoft, marginTop: 4 }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <View style={{ marginTop: 1 }}>
                    <IconBolt color={t.accent} size={17} />
                  </View>
                  <Text style={{ flex: 1, color: t.fg, fontSize: 14.5, lineHeight: 20, fontWeight: "700" }}>{open.actionText}</Text>
                </View>
                <Text style={{ color: t.fg2, fontSize: 12.5, lineHeight: 17 }}>Vai direto para a conta de anúncios. Dá para desfazer em até 30 dias.</Text>
                <Button size="md" label={busy ? "Aplicando…" : "Aplicar na plataforma"} disabled={busy} onPress={() => void apply(open)} />
              </View>
            ) : null}
            {data?.canEdit ? (
              <Card padded={false} style={{ gap: 0, overflow: "hidden", marginTop: 6 }}>
                {STATUSES.map((s, i) => (
                  <View key={s}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      label={TASK_STATUS_LABEL[s]}
                      selected={s === open.status}
                      right={s === open.status ? undefined : <View />}
                      onPress={() => {
                        const task = open;
                        setOpen(null);
                        if (s === "concluido") tapDone();
                        void setStatus(task, s);
                      }}
                    />
                  </View>
                ))}
              </Card>
            ) : (
              <Notice tone="info" text="Seu acesso é só de leitura." />
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}
