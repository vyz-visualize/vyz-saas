import { Tabs } from "expo-router";
import { tap } from "@/ui/kit";
import { IconHome, IconPulse, IconSpark, IconUser } from "@/ui/icons";
import { useTheme } from "@/ui/theme";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenListeners={{ tabPress: () => tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.fg3,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ color }) => <IconHome color={color as string} /> }} />
      <Tabs.Screen name="analises" options={{ title: "Análises", tabBarIcon: ({ color }) => <IconPulse color={color as string} /> }} />
      <Tabs.Screen name="vyz" options={{ title: "VYZ", tabBarIcon: ({ color }) => <IconSpark color={color as string} /> }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: ({ color }) => <IconUser color={color as string} /> }} />
    </Tabs>
  );
}
