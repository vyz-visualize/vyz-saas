// Barra de abas flutuante (a mesma ideia da barra do painel no celular): um
// cartão arredondado acima do indicador de início, com a aba ativa numa pílula.
// No iOS com Liquid Glass (iOS 26+) o fundo é o vidro do sistema; nos demais,
// a superfície do tema. Some com o teclado aberto. As telas das abas deixam o
// espaço dela embaixo (useLayout().tabBarSpace).

import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { tap, useKeyboardVisible } from "./kit";
import { TAB_BAR_HEIGHT, TAB_BAR_MAX, tabBarBottom } from "./layout";
import { elevation, radius, useTheme } from "./theme";

// conferido uma vez: o vidro só existe no iOS 26+ (e algumas betas não têm a API)
const GLASS = Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

type ItemProps = { label: string; focused: boolean; onPress: () => void; onLongPress: () => void; icon: (color: string) => React.ReactNode; index: number; count: number };

function TabItem({ label, focused, onPress, onLongPress, icon, index, count }: ItemProps) {
  const t = useTheme();
  // a pílula da aba ativa cresce de dentro para fora
  const [on] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    const anim = Animated.spring(on, { toValue: focused ? 1 : 0, useNativeDriver: true, damping: 18, stiffness: 260, mass: 0.8 });
    anim.start();
    return () => anim.stop();
  }, [focused, on]);
  const color = focused ? t.accent : t.fg3;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={Platform.OS === "ios" ? `${label}, aba ${index + 1} de ${count}` : label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 56, height: 30, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 15, backgroundColor: t.accentSoft, opacity: on, transform: [{ scaleX: on.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]} />
        {icon(color)}
      </View>
      <Text style={{ color: focused ? t.fg : t.fg3, fontSize: 11, lineHeight: 14, fontWeight: focused ? "700" : "500" }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  const keyboard = useKeyboardVisible();
  if (keyboard) return null;
  const bottom = tabBarBottom(insets.bottom);
  const fade = t.scheme === "dark" ? "rgba(14,15,13,0)" : "rgba(242,243,238,0)";
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, pointerEvents: "box-none" }}>
      {/* o conteúdo se desfaz no fundo antes de passar por baixo da barra */}
      <LinearGradient colors={[fade, t.bg]} locations={[0, 0.7]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bottom + TAB_BAR_HEIGHT + 32, pointerEvents: "none" }} />
      <View
        style={{
          alignSelf: "center",
          width: "100%",
          maxWidth: TAB_BAR_MAX,
          paddingLeft: Math.max(12, insets.left),
          paddingRight: Math.max(12, insets.right),
          marginBottom: bottom,
        }}
      >
        <View style={{ height: TAB_BAR_HEIGHT, borderRadius: radius.xl - 4, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, backgroundColor: GLASS ? "transparent" : t.tabBar, overflow: "hidden", ...elevation(t, 3) }}>
          {GLASS ? <GlassView glassEffectStyle="regular" colorScheme={t.scheme} style={StyleSheet.absoluteFill} /> : null}
          <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row", paddingHorizontal: 6 }}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const focused = index === state.index;
              const label = options.title ?? route.name;
              return (
                <TabItem
                  key={route.key}
                  label={label}
                  focused={focused}
                  index={index}
                  count={state.routes.length}
                  icon={(color) => options.tabBarIcon?.({ focused, color, size: 24 }) ?? null}
                  onPress={() => {
                    tap();
                    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                  }}
                  onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
