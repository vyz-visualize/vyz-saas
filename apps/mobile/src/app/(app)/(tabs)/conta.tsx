// Conta: perfil, plano do workspace, notificações (ligar e testar), créditos,
// documentos, sair e excluir a conta.

import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ENV } from "@/lib/env";
import { buy, creditPackages } from "@/lib/purchases";
import { pushStatus, registerPush, type PushStatus } from "@/lib/push";
import { useWorkspace } from "@/lib/workspace";
import { IconBell, IconChevron } from "@/ui/icons";
import { Button, Card, Notice, SectionHeader } from "@/ui/kit";
import { PlanCard } from "@/ui/PlanCard";
import { radius, useTheme } from "@/ui/theme";

function Row({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: danger ? t.danger : t.fg, fontSize: 15.5, fontWeight: "500" }}>{label}</Text>
      {!danger && <IconChevron color={t.fg3} size={18} />}
    </Pressable>
  );
}

export default function Conta() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { me, workspace, refresh } = useWorkspace();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus>("undetermined");

  useEffect(() => {
    creditPackages().then(setPackages).catch(() => setPackages([]));
    void pushStatus().then(setPush);
  }, []);

  const purchase = async (pkg: PurchasesPackage) => {
    setBusy(pkg.identifier);
    setMessage(null);
    try {
      if (await buy(pkg)) {
        setMessage("Compra concluída. Os créditos aparecem em instantes.");
        setTimeout(refresh, 3000);
      }
    } catch {
      setMessage("A compra não foi concluída. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const enablePush = async () => {
    setBusy("push");
    const s = await registerPush();
    setPush(s);
    setBusy(null);
    if (s === "denied") Alert.alert("Notificações desligadas", "Para receber os alertas, permita as notificações do VYZ nos ajustes do celular.", [{ text: "Agora não", style: "cancel" }, { text: "Abrir ajustes", onPress: () => void Linking.openSettings() }]);
  };

  const testPush = async () => {
    setBusy("test");
    setMessage(null);
    try {
      await registerPush();
      await api("/push-tokens/test", { method: "POST", body: JSON.stringify({ workspaceId: workspace?.id ?? null }) });
      setMessage("Enviada. Ela chega em alguns segundos.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () =>
    Alert.alert("Excluir conta", "Sua conta e seus dados de acesso serão apagados. Isso não pode ser desfeito.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          const err = await auth.deleteAccount();
          setBusy(null);
          if (err) setMessage(err);
        },
      },
    ]);

  const name = me?.user.fullName || "Sua conta";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 14 }}>
      <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 30, fontWeight: "800", letterSpacing: -0.9 }}>
        Conta
      </Text>

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.accent, fontSize: 21, fontWeight: "800" }}>{(name || "V").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.fg, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: t.fg2, fontSize: 13.5 }} numberOfLines={1}>
            {me?.user.email}
          </Text>
          {workspace && (
            <Text style={{ color: t.fg3, fontSize: 12.5 }} numberOfLines={1}>
              Workspace: {workspace.name}
            </Text>
          )}
        </View>
      </Card>

      <SectionHeader title="Notificações" caption="Resumo diário e alertas das suas contas" />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: push === "granted" ? t.goodSoft : t.surface2, alignItems: "center", justifyContent: "center" }}>
            <IconBell color={push === "granted" ? t.good : t.fg2} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontSize: 15, fontWeight: "700" }}>{push === "granted" ? "Ligadas" : push === "unavailable" ? "Indisponível aqui" : "Desligadas"}</Text>
            <Text style={{ color: t.fg2, fontSize: 13 }}>Toda manhã, o destaque mais importante; tocar abre o dashboard certo.</Text>
          </View>
        </View>
        {push !== "granted" && push !== "unavailable" && <Button label="Ligar notificações" busy={busy === "push"} onPress={enablePush} />}
        {push === "granted" && <Button tone="secondary" label="Enviar notificação de teste" busy={busy === "test"} onPress={testPush} />}
      </Card>
      <Notice text={message} tone="info" />

      <SectionHeader title="Plano" />
      {workspace ? <PlanCard key={workspace.id} workspace={workspace} onChanged={() => setTimeout(refresh, 1500)} /> : null}

      {packages.length > 0 && (
        <Card>
          <Text style={{ color: t.fg2, fontSize: 13 }}>Créditos</Text>
          <Text style={{ color: t.fg, fontSize: 28, fontWeight: "700" }}>{me?.credits ?? 0}</Text>
          {packages.map((p) => (
            <Button key={p.identifier} tone="secondary" label={`${p.product.title} · ${p.product.priceString}`} busy={busy === p.identifier} onPress={() => purchase(p)} />
          ))}
        </Card>
      )}

      <Card style={{ paddingVertical: 2 }}>
        <Row label="Termos de Uso" onPress={() => void Linking.openURL(`${ENV.apiUrl}/termos`)} />
        <View style={{ height: 1, backgroundColor: t.line }} />
        <Row label="Política de Privacidade" onPress={() => void Linking.openURL(`${ENV.apiUrl}/privacidade`)} />
        <View style={{ height: 1, backgroundColor: t.line }} />
        <Row label="Falar com o suporte" onPress={() => void Linking.openURL("mailto:suporte@vyzualize.com.br")} />
      </Card>

      <Button tone="secondary" label="Sair" onPress={() => void auth.signOut()} />
      <Button tone="danger" label="Excluir conta" busy={busy === "delete"} onPress={confirmDelete} />
      <Text style={{ color: t.fg3, fontSize: 12, textAlign: "center" }}>VYZ {Constants.expoConfig?.version} · VYZ Intelligence</Text>
    </ScrollView>
  );
}
