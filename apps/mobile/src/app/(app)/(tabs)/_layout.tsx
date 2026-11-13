// Abas do app: Início, Análises, VYZ e Conta, com a barra flutuante (ui/TabBar).
// A barra fica por cima do conteúdo: cada tela deixa o espaço dela embaixo.

import { Tabs } from "expo-router/js-tabs";
import { IconHome, IconPulse, IconSpark, IconUser } from "@/ui/icons";
import { TabBar } from "@/ui/TabBar";
import { useTheme } from "@/ui/theme";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } }}>
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: ({ color }) => <IconHome color={color as string} /> }} />
      <Tabs.Screen name="analises" options={{ title: "Análises", tabBarIcon: ({ color }) => <IconPulse color={color as string} /> }} />
      <Tabs.Screen name="vyz" options={{ title: "VYZ", tabBarIcon: ({ color }) => <IconSpark color={color as string} /> }} />
      <Tabs.Screen name="conta" options={{ title: "Conta", tabBarIcon: ({ color }) => <IconUser color={color as string} /> }} />
    </Tabs>
  );
}
