// Peças das telas: botão, campo, superfície, selo, seletor, variação, cabeçalhos
// (de tela, de navegação e de seção), linha de lista, avatar, barra de
// progresso, aviso com "tentar de novo", estado vazio, folha que sobe e
// esqueleto de carregamento. Alvos de toque de pelo menos 44 pt.

import * as Haptics from "expo-haptics";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconAlert, IconBack, IconCheck, IconChevron, IconEye, IconEyeOff, IconInfo, IconRefresh } from "./icons";
import { CONTENT_MAX } from "./layout";
import { elevation, HIT, radius, type as typo, useTheme, type Theme } from "./theme";

export const tap = () => {
  if (Platform.OS !== "web") void Haptics.selectionAsync();
};

/** Vibração de confirmação (concluir tarefa, aplicar mudança). */
export const tapDone = () => {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/** O teclado está aberto? (a barra de abas some e o campo do VYZ desce.) */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

// ---- botões -------------------------------------------------------------------

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "lg" | "md" | "sm";
const BUTTON_H: Record<ButtonSize, number> = { lg: 52, md: 46, sm: 38 };

export function Button({
  label,
  onPress,
  busy,
  disabled,
  tone = "primary",
  size = "lg",
  icon,
  inline,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Ícone à esquerda do texto (ex.: o G do Google). */
  icon?: ReactNode;
  /** Só a largura do conteúdo, em vez da linha toda. */
  inline?: boolean;
}) {
  const t = useTheme();
  const fg = tone === "primary" ? t.accentFg : tone === "danger" ? t.danger : tone === "ghost" ? t.accent : t.fg;
  const off = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      hitSlop={size === "sm" ? 6 : 0}
      style={({ pressed }) => [
        s.button,
        {
          height: BUTTON_H[size],
          borderRadius: size === "sm" ? radius.sm : radius.md,
          paddingHorizontal: size === "sm" ? 14 : 18,
          alignSelf: inline ? "flex-start" : "stretch",
          backgroundColor: tone === "primary" ? t.accent : tone === "secondary" ? t.surface : pressed ? (tone === "danger" ? t.dangerSoft : t.accentSoft) : "transparent",
          borderColor: tone === "primary" ? t.accent : tone === "secondary" ? t.line : tone === "danger" ? t.dangerSoft : "transparent",
          opacity: disabled ? 0.45 : busy ? 0.75 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: size === "sm" ? 6 : 10 }}>
          {icon}
          <Text style={{ color: fg, fontSize: size === "sm" ? 14 : 16, fontWeight: "700" }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Botão redondo só com ícone (voltar, compartilhar). */
export function IconButton({ label, onPress, children, tone = "soft", disabled }: { label: string; onPress: () => void; children: ReactNode; tone?: "soft" | "accent" | "hero"; disabled?: boolean }) {
  const t = useTheme();
  const bg = tone === "accent" ? t.accent : tone === "hero" ? t.heroLine : t.surface2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}
    >
      {children}
    </Pressable>
  );
}

/** Ação de texto dentro de um cabeçalho ("Ver tudo", "Nova conversa"). */
export function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 32, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ color: t.accent, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

// ---- campo --------------------------------------------------------------------

/** Campo de texto com rótulo, foco visível e, na senha, o "mostrar". */
export function Field({ label, secureTextEntry, onFocus, onBlur, style, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.fg2, ...typo.label }}>{label}</Text>
      <View style={[s.input, { borderColor: focused ? t.accent : t.line, backgroundColor: t.surface, borderWidth: focused ? 1.5 : 1 }, focused ? { boxShadow: `0 0 0 3px ${t.accentSoft}` } : null]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={t.fg3}
          selectionColor={t.accent}
          secureTextEntry={secureTextEntry ? hidden : false}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[{ flex: 1, height: "100%", color: t.fg, fontSize: 16, paddingHorizontal: 14 }, style]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar a senha" : "Ocultar a senha"} hitSlop={8} onPress={() => setHidden((v) => !v)} style={{ width: HIT, height: "100%", alignItems: "center", justifyContent: "center" }}>
            {hidden ? <IconEye color={t.fg2} size={20} /> : <IconEyeOff color={t.fg2} size={20} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---- superfícies --------------------------------------------------------------

const cardBase = (t: Theme): ViewStyle => ({ backgroundColor: t.surface, borderColor: t.line, ...elevation(t, 1) });

/** Superfície padrão (cartão). */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return <View style={[s.card, cardBase(t), { padding: padded ? 16 : 0 }, style]}>{children}</View>;
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
      style={({ pressed }) => [s.card, cardBase(t), { padding: 16, backgroundColor: pressed ? t.surface2 : t.surface, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line, marginLeft: inset }} />;
}

// ---- avisos e estados -----------------------------------------------------------

/** Aviso em faixa: erro (com "Tentar de novo" quando há o que repetir) ou informação. */
export function Notice({ text, tone = "error", onRetry, retryLabel = "Tentar de novo" }: { text: string | null; tone?: "error" | "info"; onRetry?: () => void; retryLabel?: string }) {
  const t = useTheme();
  if (!text) return null;
  const error = tone === "error";
  const fg = error ? t.danger : t.fg2;
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: error ? t.dangerSoft : t.surface2 }}
    >
      <View style={{ marginTop: 1 }}>{error ? <IconAlert color={fg} size={18} /> : <IconInfo color={fg} size={18} />}</View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ color: error ? t.danger : t.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              tap();
              onRetry();
            }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: pressed ? 0.6 : 1 })}
          >
            <IconRefresh color={fg} size={15} />
            <Text style={{ color: fg, fontSize: 14, fontWeight: "700" }}>{retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Estado vazio: ícone, uma frase de título, o porquê e, se houver, a ação. */
export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 20, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: t.line, gap: 6 }}>
      {icon ? <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>{icon}</View> : null}
      <Text accessibilityRole="header" style={{ color: t.fg, textAlign: "center", ...typo.heading, fontSize: 17 }}>
        {title}
      </Text>
      <Text style={{ color: t.fg2, textAlign: "center", maxWidth: 320, ...typo.body, fontSize: 14.5 }}>{text}</Text>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

// ---- seletores e selos ----------------------------------------------------------

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
            style={[s.segmentItem, on && { backgroundColor: t.surface, ...elevation(t, 2), borderWidth: t.scheme === "dark" ? 1 : 0, borderColor: t.line }]}
          >
            <Text style={{ color: on ? t.fg : t.fg2, fontSize: 13.5, fontWeight: on ? "700" : "500" }} numberOfLines={1}>
              {o.label}
            </Text>
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

export type ChipTone = "neutral" | "accent" | "good" | "bad" | "warn";

export function Chip({ label, tone = "neutral" }: { label: string; tone?: ChipTone }) {
  const t = useTheme();
  const fg = tone === "accent" ? t.accent : tone === "good" ? t.good : tone === "bad" ? t.danger : tone === "warn" ? t.warn : t.fg2;
  const bg = tone === "accent" ? t.accentSoft : tone === "good" ? t.goodSoft : tone === "bad" ? t.dangerSoft : tone === "warn" ? t.warnSoft : t.surface2;
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: bg }}>
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: "600" }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Pílula tocável (sugestão de pergunta, filtro). */
export function PillButton({ label, onPress, selected }: { label: string; onPress: () => void; selected?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={4}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 40,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? t.accent : t.line,
        backgroundColor: selected ? t.accentSoft : pressed ? t.surface2 : t.surface,
      })}
    >
      <Text style={{ color: selected ? t.accent : t.fg, fontSize: 13.5, fontWeight: selected ? "700" : "500" }}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, tone = "accent", height = 6 }: { value: number; tone?: "accent" | "good" | "bad" | "warn"; height?: number }) {
  const t = useTheme();
  const color = tone === "good" ? t.good : tone === "bad" ? t.danger : tone === "warn" ? t.warn : t.accent;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, value)) * 100) }} style={{ height, borderRadius: height / 2, backgroundColor: t.surface2, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

/** Avatar com as iniciais. solid = workspace (oliva cheio); soft = pessoa; hero = sobre a faixa da marca. */
export function Avatar({ name, size = 44, tone = "soft", square }: { name: string; size?: number; tone?: "soft" | "solid" | "hero"; square?: boolean }) {
  const t = useTheme();
  const bg = tone === "solid" ? t.accent : tone === "hero" ? t.heroLine : t.accentSoft;
  const fg = tone === "solid" ? t.accentFg : tone === "hero" ? t.heroFg : t.accent;
  return (
    <View style={{ width: size, height: size, borderRadius: square ? size * 0.3 : size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: fg, fontSize: size * 0.38, fontWeight: "800" }}>{initialsOf(name)}</Text>
    </View>
  );
}

// ---- cabeçalhos -----------------------------------------------------------------

/** Título grande das abas (Análises, Conta), com uma linha de apoio. */
export function ScreenHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text accessibilityRole="header" style={{ color: t.fg, ...typo.display }}>
          {title}
        </Text>
        {caption ? <Text style={{ color: t.fg2, ...typo.body, fontSize: 14.5 }}>{caption}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Topo das telas abertas por cima das abas: voltar, título e ações. */
export function NavHeader({ title, caption, onBack, right, large }: { title: string; caption?: string; onBack: () => void; right?: ReactNode; large?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <IconButton label="Voltar" onPress={onBack}>
        <IconBack color={t.fg} size={20} />
      </IconButton>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: t.fg, ...(large ? { ...typo.title, fontSize: 26 } : { fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.3 }) }} numberOfLines={1}>
          {title}
        </Text>
        {caption !== undefined ? (
          <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10, marginBottom: 2, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: t.fg, ...typo.section }}>
          {title}
        </Text>
        {caption ? <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{caption}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ---- lista ----------------------------------------------------------------------

/** Linha de lista: ícone, rótulo, apoio e seta. Dentro de um Card sem respiro, com Divider entre elas. */
export function ListRow({
  label,
  caption,
  icon,
  right,
  onPress,
  danger,
  selected,
}: {
  label: string;
  caption?: string;
  icon?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  selected?: boolean;
}) {
  const t = useTheme();
  const body = (
    <>
      {icon ? <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: danger ? t.dangerSoft : t.surface2, alignItems: "center", justifyContent: "center" }}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: danger ? t.danger : t.fg, fontSize: 15.5, lineHeight: 21, fontWeight: "600" }} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
      {right ?? (selected ? <IconCheck color={t.accent} size={20} /> : onPress && !danger ? <IconChevron color={t.fg3} size={18} /> : null)}
    </>
  );
  if (!onPress) return <View style={s.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.row, { backgroundColor: pressed ? t.surface2 : "transparent" }]}
    >
      {body}
    </Pressable>
  );
}

// ---- folha que sobe ---------------------------------------------------------------

/** Folha de baixo para cima (trocar de workspace, opções da tarefa). Tocar fora fecha. */
export function Sheet({ open, onClose, title, caption, children }: { open: boolean; onClose: () => void; title?: string; caption?: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [y] = useState(() => new Animated.Value(48));
  useEffect(() => {
    if (!open) return y.setValue(48);
    const anim = Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9 });
    anim.start();
    return () => anim.stop();
  }, [open, y]);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar" onPress={onClose} style={{ flex: 1, backgroundColor: t.scrim, justifyContent: "flex-end" }}>
        <Animated.View style={{ transform: [{ translateY: y }], width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" }}>
          {/* o toque dentro da folha não fecha */}
          <Pressable onPress={() => {}} accessible={false} style={{ backgroundColor: t.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderBottomWidth: 0, borderColor: t.line, maxHeight: height * 0.88, ...elevation(t, 3) }}>
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.line, marginTop: 10 }} />
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 12) + 16, gap: 10 }}>
              {title ? (
                <View style={{ gap: 3, marginBottom: 4 }}>
                  <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 19, lineHeight: 25, fontWeight: "800", letterSpacing: -0.3 }}>
                    {title}
                  </Text>
                  {caption ? <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }}>{caption}</Text> : null}
                </View>
              ) : null}
              {children}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---- carregamento -------------------------------------------------------------------

/** Bloco pulsando enquanto carrega. */
export function Skeleton({ height, width = "100%", style, round = radius.md }: { height: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle>; round?: number }) {
  const t = useTheme();
  const [v] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ height, width, borderRadius: round, backgroundColor: t.surface2, opacity: v }, style]} />;
}

/** Esqueleto no formato de um cartão: linhas de texto e, se pedido, um bloco à direita. */
export function SkeletonCard({ lines = 2, height, aside }: { lines?: number; height?: number; aside?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.card, { backgroundColor: t.surface, borderColor: t.line, padding: 16, minHeight: height, flexDirection: "row", alignItems: "center", gap: 14 }]}>
      <View style={{ flex: 1, gap: 9 }}>
        <Skeleton height={14} width="62%" round={7} />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} height={11} width={i === lines - 1 ? "44%" : "88%"} round={6} />
        ))}
      </View>
      {aside ? <Skeleton height={44} width={96} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  button: { borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { height: 52, borderRadius: radius.md, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, gap: 8 },
  segment: { flexDirection: "row", borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 38, paddingHorizontal: 6, borderRadius: radius.pill },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14 },
});
