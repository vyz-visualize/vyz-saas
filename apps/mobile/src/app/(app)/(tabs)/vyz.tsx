// VYZ: pergunte em português sobre as suas contas. Mesmo motor do site; as
// respostas trazem o número em destaque, o comparativo entre clientes e o
// atalho para o dashboard. Dentro de um dashboard, o botão "Perguntar ao VYZ"
// abre aqui com o recorte dele. O campo fica logo acima da barra de abas e
// desce para o teclado quando ele abre.

import type { AgentReply } from "@vyz/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { ShareBar } from "@/ui/charts";
import { IconSend } from "@/ui/icons";
import { Button, Card, Notice, PillButton, tap, TextAction, useKeyboardVisible } from "@/ui/kit";
import { useLayout } from "@/ui/layout";
import { radius, type as typo, useTheme } from "@/ui/theme";
import { VyzMark } from "@/ui/Wordmark";

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
    <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
      <VyzMark size={28} />
      <View style={{ flex: 1, gap: 10, paddingTop: 3 }}>
        <Rich text={r.text} color={t.fg} />
        {r.card && (
          <Card style={{ gap: 4 }}>
            <Text style={{ color: t.fg2, ...typo.overline }}>{r.card.label}</Text>
            <Text style={{ color: t.fg, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
              {r.card.value}
            </Text>
            {r.card.delta && <Text style={{ color: r.card.delta.good === null ? t.fg2 : r.card.delta.good ? t.good : t.danger, fontSize: 13, fontWeight: "700" }}>{r.card.delta.text}</Text>}
            {(r.card.note || r.card.hint) && <Text style={{ color: t.fg3, fontSize: 12.5, lineHeight: 17 }}>{r.card.note ?? r.card.hint}</Text>}
          </Card>
        )}
        {r.chart && (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: t.fg2, ...typo.overline }}>{r.chart.title}</Text>
            {r.chart.items.slice(0, 8).map((i, n) => (
              <View key={`${n}:${i.label}`} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ color: t.fg, fontSize: 13.5, flex: 1 }} numberOfLines={1}>
                    {i.label}
                  </Text>
                  <Text style={{ color: t.fg, fontSize: 13.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{i.display}</Text>
                </View>
                <ShareBar share={i.value / max} />
              </View>
            ))}
          </Card>
        )}
        {r.dashboardId && <Button size="sm" inline label="Abrir dashboard" onPress={() => router.push({ pathname: "/dashboards/[id]", params: { id: r.dashboardId! } })} />}
        {r.suggestions && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {r.suggestions.map((s) => (
              <PillButton key={s} label={s} onPress={() => onAsk(s)} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/** Três pontos pulsando enquanto o VYZ lê os números. */
function Typing() {
  const t = useTheme();
  const [dots] = useState(() => [new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        160,
        dots.map((d) => Animated.sequence([Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }), Animated.timing(d, { toValue: 0.3, duration: 320, useNativeDriver: true })])),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots]);
  return (
    <View accessibilityLabel="Lendo seus números" accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <VyzMark size={28} />
      <View style={{ flexDirection: "row", gap: 5, paddingHorizontal: 14, height: 36, alignItems: "center", borderRadius: radius.pill, backgroundColor: t.surface2 }}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.fg2, opacity: d }} />
        ))}
      </View>
      <Text style={{ color: t.fg2, fontSize: 13.5 }}>Lendo seus números…</Text>
    </View>
  );
}

export default function Vyz() {
  const t = useTheme();
  const L = useLayout();
  const keyboard = useKeyboardVisible();
  const { workspace } = useWorkspace();
  const params = useLocalSearchParams<{ dashboardId?: string; search?: string; nome?: string; q?: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
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
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
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

  const canSend = !!input.trim() && !busy;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={[L.content, { paddingTop: L.top, paddingBottom: 20, gap: 16, flexGrow: 1 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <VyzMark size={44} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.8 }}>
              VYZ
            </Text>
            <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
              {params.nome ? `Perguntando sobre ${params.nome}` : "Pergunte sobre as suas contas"}
            </Text>
          </View>
          {msgs.length > 0 && <TextAction label="Nova conversa" onPress={() => setMsgs([])} />}
        </View>

        {msgs.length === 0 && (
          <View style={{ gap: 12, flex: 1, justifyContent: "center", paddingVertical: 12 }}>
            <Text style={{ color: t.fg, ...typo.title }}>Seus números, respondidos em segundos.</Text>
            <Text style={{ color: t.fg2, fontSize: 14.5, lineHeight: 21 }}>Investimento, vendas, leads, CPA, CPL e ROAS de todos os seus dashboards, comparando clientes. Toque numa pergunta ou escreva a sua.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {suggestions.map((s) => (
                <PillButton key={s} label={s} onPress={() => ask(s)} />
              ))}
            </View>
          </View>
        )}

        {msgs.map((m) =>
          m.role === "user" ? (
            <View key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: t.accent, borderRadius: radius.lg, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: t.accentFg, fontSize: 15, lineHeight: 21, fontWeight: "600" }}>{m.text}</Text>
            </View>
          ) : m.reply ? (
            <Reply key={m.id} m={m} onAsk={ask} />
          ) : (
            <Notice key={m.id} text={m.text} />
          ),
        )}
        {busy && <Typing />}
      </ScrollView>

      {/* com o teclado fechado, o campo fica acima da barra de abas flutuante */}
      <View style={{ backgroundColor: t.bg, paddingTop: 8, paddingBottom: keyboard ? 10 : L.tabBarSpace - 8 }}>
        <View style={[L.content, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte ao VYZ…"
            placeholderTextColor={t.fg3}
            selectionColor={t.accent}
            returnKeyType="send"
            onSubmitEditing={() => ask(input)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel="Pergunta"
            style={{ flex: 1, height: 50, borderRadius: radius.pill, paddingHorizontal: 18, fontSize: 16, color: t.fg, backgroundColor: t.surface, borderWidth: focused ? 1.5 : 1, borderColor: focused ? t.accent : t.line }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => ask(input)}
            style={({ pressed }) => ({ width: 50, height: 50, borderRadius: 25, backgroundColor: canSend ? t.accent : t.surface2, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] })}
          >
            <IconSend color={canSend ? t.accentFg : t.fg3} size={20} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
