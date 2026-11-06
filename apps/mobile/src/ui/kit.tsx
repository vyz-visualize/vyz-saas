// Peças das telas: botão, campo, superfície, chip, seletor, variação,
// cabeçalho de seção e esqueleto de carregamento.

import * as Haptics from "expo-haptics";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { radius, useTheme } from "./theme";

export const tap = () => {
  if (Platform.OS !== "web") void Haptics.selectionAsync();
};

export function Button({ label, onPress, busy, tone = "primary" }: { label: string; onPress: () => void; busy?: boolean; tone?: "primary" | "secondary" | "danger" }) {
  const t = useTheme();
  const bg = tone === "primary" ? t.accent : "transparent";
  const fg = tone === "primary" ? t.accentFg : tone === "danger" ? t.danger : t.fg;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: bg, borderColor: tone === "primary" ? bg : t.line, opacity: busy ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.fg2, fontSize: 13, fontWeight: "500" }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={t.fg3} style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.surface }]} {...props} />
    </View>
  );
}

/** Superfície padrão (cartão). */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.line, padding: padded ? 16 : 0 }, style]}>{children}</View>;
}

/** Cartão tocável com leve afundar no toque. */
export function PressCard({ children, onPress, style, label }: { children: ReactNode; onPress: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Notice({ text, tone = "error" }: { text: string | null; tone?: "error" | "info" }) {
  const t = useTheme();
  if (!text) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={{ color: tone === "error" ? t.danger : t.fg2, fontSize: 14 }}>
      {text}
    </Text>
  );
}

/** Seletor de opções em pílula (período, aba). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[s.segment, { backgroundColor: t.surface2 }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              tap();
              onChange(o.value);
            }}
            style={[s.segmentItem, on && { backgroundColor: t.surface, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }]}
          >
            <Text style={{ color: on ? t.fg : t.fg2, fontSize: 13.5, fontWeight: on ? "700" : "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Variação contra o período anterior, colorida pelo sentido do indicador. */
export function DeltaPill({ delta, tone, size = "sm" }: { delta: number | null; tone: "good" | "bad" | "neutral"; size?: "sm" | "md" }) {
  const t = useTheme();
  if (delta === null) return null;
  const fg = tone === "good" ? t.good : tone === "bad" ? t.danger : t.fg2;
  const bg = tone === "good" ? t.goodSoft : tone === "bad" ? t.dangerSoft : t.surface2;
  const txt = `${delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} ${new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(delta))}`;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: size === "md" ? 10 : 7, paddingVertical: size === "md" ? 4 : 2 }}>
      <Text style={{ color: fg, fontSize: size === "md" ? 13 : 11.5, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{txt}</Text>
    </View>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" }) {
  const t = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: tone === "accent" ? t.accentSoft : t.surface2 }}>
      <Text style={{ color: tone === "accent" ? t.accent : t.fg2, fontSize: 11.5, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8, marginBottom: 2, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 }}>
          {title}
        </Text>
        {caption ? <Text style={{ color: t.fg2, fontSize: 13, marginTop: 2 }}>{caption}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Bloco pulsando enquanto carrega. */
export function Skeleton({ height, width = "100%", style }: { height: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: radius.md, backgroundColor: t.surface2, opacity: v }, style]} />;
}

const s = StyleSheet.create({
  button: { height: 52, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
  segment: { flexDirection: "row", borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: radius.pill },
});
