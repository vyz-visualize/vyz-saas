// A Fazer: as tarefas abertas do workspace, por prioridade e prazo. Tocar no
// círculo conclui; tocar na tarefa abre as opções de status. As tarefas que o
// VYZ cria a partir dos dados chegam com o selo "Novo". Tarefa com mudança
// proposta mostra o "de → para" e o botão Aplicar (vai direto para a
// plataforma); as mudanças aplicadas ficam no fim, com Desfazer.

import { TASK_PRIORITY_LABEL, TASK_SITUATION_LABEL, TASK_STAGE_LABEL, TASK_STATUS_LABEL, type ApiOptimizationRun, type ApiTask, type ApiTaskStatus, type OptimizationRunResponse, type TaskPatchResponse, type TasksResponse } from "@vyz/shared";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { IconBack } from "@/ui/icons";
import { Chip, Notice, Skeleton, tap } from "@/ui/kit";
import { radius, useTheme } from "@/ui/theme";

const STATUSES: ApiTaskStatus[] = ["planejado", "em_andamento", "concluido", "cancelado"];
const RUN_STATUS: Record<ApiOptimizationRun["status"], string> = { applied: "Aplicada", failed: "Falhou", undone: "Desfeita", undo_failed: "Falha ao desfazer" };
const shortDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null);

function TaskItem({ task, canEdit, onDone, onOpen }: { task: ApiTask; canEdit: boolean; onDone: () => void; onOpen: () => void }) {
  const t = useTheme();
  const late = task.situation === "atrasado";
  const prio = task.priority === "alta" ? t.danger : task.priority === "media" ? t.accent : t.fg3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. Prioridade ${TASK_PRIORITY_LABEL[task.priority]}. ${TASK_SITUATION_LABEL[task.situation]}`}
      onPress={onOpen}
      style={({ pressed }) => ({ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.85 : 1 })}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Concluir ${task.title}`}
        disabled={!canEdit}
        hitSlop={10}
        onPress={() => {
          tap();
          onDone();
        }}
        style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: prio, marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: t.fg, fontSize: 15.5, fontWeight: "700", lineHeight: 21 }}>{task.title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {task.isNew && <Chip label="Novo" tone="accent" />}
          {task.actionText && canEdit ? <Chip label="Aplicar" tone="accent" /> : null}
          <Chip label={TASK_PRIORITY_LABEL[task.priority]} />
          <Chip label={TASK_STATUS_LABEL[task.status]} />
          {task.projectName ? <Chip label={task.projectName} /> : null}
          <Text style={{ color: late ? t.danger : t.fg2, fontSize: 12.5, fontWeight: late ? "700" : "500" }}>
            {task.dueDate ? `${TASK_SITUATION_LABEL[task.situation]} · ${shortDate(task.dueDate)}` : TASK_SITUATION_LABEL[task.situation]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function AFazer() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
        data={tasks}
        keyExtractor={(x) => x.id}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={() => void load()} tintColor={t.accent} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                hitSlop={10}
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: t.surface2 }}
              >
                <IconBack color={t.fg} size={20} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 28, fontWeight: "800", letterSpacing: -0.8 }}>
                  A Fazer
                </Text>
                <Text style={{ color: t.fg2, fontSize: 13 }}>
                  {data ? `${tasks.length} ${tasks.length === 1 ? "aberta" : "abertas"}${late ? ` · ${late} ${late === 1 ? "atrasada" : "atrasadas"}` : ""}` : " "}
                </Text>
              </View>
            </View>
            <Notice text={error} />
          </View>
        }
        ListEmptyComponent={
          loading && !data ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={84} />
              <Skeleton height={84} />
              <Skeleton height={84} />
            </View>
          ) : (
            <Text style={{ color: t.fg2, fontSize: 15, lineHeight: 22 }}>Nada a fazer por enquanto. Quando os números de um dashboard mudarem, o VYZ cria a tarefa aqui.</Text>
          )
        }
        ListFooterComponent={
          data?.runs?.length ? (
            <View style={{ gap: 8, marginTop: 18 }}>
              <Text style={{ color: t.fg, fontSize: 16, fontWeight: "800" }}>Mudanças aplicadas</Text>
              {data.runs.map((r) => (
                <View key={r.id} style={{ padding: 14, borderRadius: radius.md, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, gap: 6 }}>
                  <Text style={{ color: r.status === "undone" ? t.fg2 : t.fg, fontSize: 14, fontWeight: "600", textDecorationLine: r.status === "undone" ? "line-through" : "none" }}>{r.description}</Text>
                  <Text style={{ color: r.status === "failed" || r.status === "undo_failed" ? t.danger : t.fg2, fontSize: 12.5 }}>
                    {[new Date(r.appliedAt).toLocaleDateString("pt-BR"), r.mode === "auto" ? "Automático" : "Com aprovação", RUN_STATUS[r.status], r.error].filter(Boolean).join(" · ")}
                  </Text>
                  {r.canUndo && data.canEdit ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        tap();
                        void undo(r);
                      }}
                      hitSlop={8}
                      style={{ alignSelf: "flex-start", paddingVertical: 4 }}
                    >
                      <Text style={{ color: t.accent, fontSize: 14, fontWeight: "700" }}>Desfazer</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => <TaskItem task={item} canEdit={!!data?.canEdit} onDone={() => void setStatus(item, "concluido")} onOpen={() => setOpen(item)} />}
      />

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: insets.bottom + 28, gap: 10 }}>
            {open && (
              <>
                <Text style={{ color: t.fg, fontSize: 18, fontWeight: "800" }}>{open.title}</Text>
                <Text style={{ color: t.fg2, fontSize: 13 }}>
                  {[TASK_STAGE_LABEL[open.stage], open.projectName, open.source === "insight" ? "Criada pelo VYZ a partir dos dados" : null].filter(Boolean).join(" · ")}
                </Text>
                {open.detail ? <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>{open.detail}</Text> : null}
                {open.actionText && data?.canEdit ? (
                  <View style={{ gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: t.accent, backgroundColor: t.accentSoft, marginTop: 4 }}>
                    <Text style={{ color: t.fg, fontSize: 14.5, fontWeight: "700" }}>{open.actionText}</Text>
                    <Text style={{ color: t.fg2, fontSize: 12.5 }}>Vai direto para a conta de anúncios. Dá para desfazer em até 30 dias.</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        tap();
                        void apply(open);
                      }}
                      style={{ padding: 12, borderRadius: radius.md, backgroundColor: t.accent, alignItems: "center", opacity: busy ? 0.6 : 1 }}
                    >
                      <Text style={{ color: t.accentFg, fontSize: 15, fontWeight: "800" }}>{busy ? "Aplicando…" : "Aplicar na plataforma"}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {data?.canEdit ? (
                  <View style={{ gap: 8, marginTop: 6 }}>
                    {STATUSES.map((s) => {
                      const on = s === open.status;
                      return (
                        <Pressable
                          key={s}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => {
                            tap();
                            const task = open;
                            setOpen(null);
                            void setStatus(task, s);
                          }}
                          style={{ padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : "transparent" }}
                        >
                          <Text style={{ color: t.fg, fontSize: 15.5, fontWeight: "700" }}>{TASK_STATUS_LABEL[s]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ color: t.fg2, fontSize: 13 }}>Seu acesso é só de leitura.</Text>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
