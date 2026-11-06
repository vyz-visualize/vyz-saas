// VYZ: pergunte em português sobre as suas contas. Mesmo motor do site; as
// respostas trazem o número em destaque, o comparativo entre clientes e o
// atalho para o dashboard. Dentro de um dashboard, o botão "Perguntar ao VYZ"
// abre aqui com o recorte dele.

import type { AgentReply } from "@vyz/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { ShareBar } from "@/ui/charts";
import { IconSend, IconSpark } from "@/ui/icons";
import { tap } from "@/ui/kit";
import { radius, useTheme } from "@/ui/theme";

type Msg = { id: number; role: "user" | "vyz"; text: string; reply?: AgentReply };

const FALLBACK = ["Quanto investi esse mês?", "Quantas vendas esse mês?", "Qual cliente teve o melhor ROAS?", "Qual cliente teve o melhor CPA?", "Quantos dashboards ainda posso criar?"];

/** **negrito** → peso 800. */
function Rich({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={{ color, fontSize: 15.5, lineHeight: 22 }}>
      {parts.map((p, i) => (p.startsWith("**") ? <Text key={i} style={{ fontWeight: "800" }}>{p.slice(2, -2)}</Text> : p))}
    </Text>
  );
}

function Reply({ m, onAsk }: { m: Msg; onAsk: (q: string) => void }) {
  const t = useTheme();
  const r = m.reply!;
  const max = Math.max(...(r.chart?.items.map((i) => i.value) ?? [1]), 1);
  return (
    <View style={{ gap: 10, alignSelf: "stretch" }}>
      <Rich text={r.text} color={t.fg} />
      {r.card && (
        <View style={{ borderRadius: radius.lg, padding: 14, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, gap: 4 }}>
          <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 }}>{r.card.label}</Text>
          <Text style={{ color: t.fg, fontSize: 30, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{r.card.value}</Text>
          {r.card.delta && <Text style={{ color: r.card.delta.good === null ? t.fg2 : r.card.delta.good ? t.good : t.danger, fontSize: 13, fontWeight: "700" }}>{r.card.delta.text}</Text>}
          {(r.card.note || r.card.hint) && <Text style={{ color: t.fg3, fontSize: 12.5 }}>{r.card.note ?? r.card.hint}</Text>}
        </View>
      )}
      {r.chart && (
        <View style={{ borderRadius: radius.lg, padding: 14, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, gap: 10 }}>
          <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "600", textTransform: "uppercase" }}>{r.chart.title}</Text>
          {r.chart.items.slice(0, 8).map((i) => (
            <View key={i.label} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: t.fg, fontSize: 13.5 }} numberOfLines={1}>{i.label}</Text>
                <Text style={{ color: t.fg, fontSize: 13.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{i.display}</Text>
              </View>
              <ShareBar share={i.value / max} />
            </View>
          ))}
        </View>
      )}
      {r.dashboardId && (
        <Pressable onPress={() => router.push({ pathname: "/dashboards/[id]", params: { id: r.dashboardId! } })} style={{ alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: t.accent }}>
          <Text style={{ color: t.accentFg, fontWeight: "700", fontSize: 13.5 }}>Abrir dashboard</Text>
        </Pressable>
      )}
      {r.suggestions && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {r.suggestions.map((s) => (
            <Chip key={s} label={s} onPress={() => onAsk(s)} />
          ))}
        </View>
      )}
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: t.line, backgroundColor: pressed ? t.surface2 : t.surface })}
    >
      <Text style={{ color: t.fg, fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

export default function Vyz() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { workspace } = useWorkspace();
  const params = useLocalSearchParams<{ dashboardId?: string; search?: string; nome?: string; q?: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const seq = useRef(0);

  useEffect(() => {
    api<{ suggestions: string[] }>("/agent")
      .then((r) => setSuggestions(r.suggestions))
      .catch(() => {});
  }, []);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    tap();
    setInput("");
    setMsgs((m) => [...m, { id: ++seq.current, role: "user", text: question }]);
    setBusy(true);
    try {
      const { answer } = await api<{ answer: AgentReply }>("/agent", {
        method: "POST",
        body: JSON.stringify({ question, workspaceId: workspace?.id, dashboardId: params.dashboardId || null, search: params.search || null }),
      });
      setMsgs((m) => [...m, { id: ++seq.current, role: "vyz", text: answer.text, reply: answer }]);
    } catch (err) {
      setMsgs((m) => [...m, { id: ++seq.current, role: "vyz", text: (err as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  // veio de um dashboard com uma pergunta pronta
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (params.q && asked.current !== params.q && workspace) {
      asked.current = params.q;
      void ask(params.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, workspace]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <IconSpark color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 26, fontWeight: "800", letterSpacing: -0.8 }}>
              VYZ
            </Text>
            <Text style={{ color: t.fg2, fontSize: 13 }} numberOfLines={1}>
              {params.nome ? `Perguntando sobre ${params.nome}` : "Pergunte sobre as suas contas"}
            </Text>
          </View>
          {msgs.length > 0 && (
            <Pressable onPress={() => setMsgs([])} hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>Nova conversa</Text>
            </Pressable>
          )}
        </View>

        {msgs.length === 0 && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: t.fg, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, lineHeight: 28 }}>Seus números, respondidos em segundos.</Text>
            <Text style={{ color: t.fg2, fontSize: 14.5, lineHeight: 21 }}>Investimento, vendas, leads, CPA, CPL e ROAS de todos os seus dashboards, comparando clientes. Toque numa pergunta ou escreva a sua.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {suggestions.map((s) => (
                <Chip key={s} label={s} onPress={() => ask(s)} />
              ))}
            </View>
          </View>
        )}

        {msgs.map((m) =>
          m.role === "user" ? (
            <View key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: t.accent, borderRadius: radius.lg, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: t.accentFg, fontSize: 15, fontWeight: "600" }}>{m.text}</Text>
            </View>
          ) : m.reply ? (
            <Reply key={m.id} m={m} onAsk={ask} />
          ) : (
            <Text key={m.id} style={{ color: t.danger }}>{m.text}</Text>
          ),
        )}
        {busy && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color={t.accent} />
            <Text style={{ color: t.fg2 }}>Lendo seus números…</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.bg }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Pergunte ao VYZ…"
          placeholderTextColor={t.fg3}
          returnKeyType="send"
          onSubmitEditing={() => ask(input)}
          accessibilityLabel="Pergunta"
          style={{ flex: 1, height: 48, borderRadius: radius.pill, paddingHorizontal: 18, fontSize: 15.5, color: t.fg, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={!input.trim() || busy}
          onPress={() => ask(input)}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: input.trim() ? t.accent : t.surface2, alignItems: "center", justifyContent: "center" }}
        >
          <IconSend color={input.trim() ? t.accentFg : t.fg3} size={20} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
