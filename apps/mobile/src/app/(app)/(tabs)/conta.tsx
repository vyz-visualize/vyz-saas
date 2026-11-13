// Conta: perfil, workspace (trocar), notificações (ligar e testar), plano do
// workspace, créditos, documentos, sair e excluir a conta.

import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ENV } from "@/lib/env";
import { buy, creditPackages } from "@/lib/purchases";
import { pushStatus, registerPush, type PushStatus } from "@/lib/push";
import { useWorkspace } from "@/lib/workspace";
import { IconBell, IconCoins, IconDoc, IconLogout, IconMail, IconShield, IconTrash } from "@/ui/icons";
import { Avatar, Button, Card, Chip, Divider, ListRow, Notice, ScreenHeader, SectionHeader } from "@/ui/kit";
import { useLayout } from "@/ui/layout";
import { PlanCard } from "@/ui/PlanCard";
import { radius, type as typo, useTheme } from "@/ui/theme";
import { ROLE_LABEL, WorkspaceSheet } from "@/ui/WorkspaceSheet";

export default function Conta() {
  const t = useTheme();
  const L = useLayout();
  const auth = useAuth();
  const { me, workspace, refresh } = useWorkspace();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus>("undetermined");
  const [picker, setPicker] = useState(false);

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
  const many = (me?.workspaces.length ?? 0) > 1;
  const pushOn = push === "granted";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={[L.content, { paddingTop: L.top, paddingBottom: L.tabBarSpace, gap: 14 }]}>
      <WorkspaceSheet open={picker} onClose={() => setPicker(false)} />
      <ScreenHeader title="Conta" />

      <Card padded={false} style={{ gap: 0, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
          <Avatar name={name} size={56} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ color: t.fg, fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.3 }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ color: t.fg2, fontSize: 13.5, lineHeight: 19 }} numberOfLines={1}>
              {me?.user.email}
            </Text>
          </View>
        </View>
        {workspace && (
          <>
            <Divider />
            <ListRow
              label={workspace.name}
              caption={many ? `${ROLE_LABEL[workspace.role]} · toque para trocar de organização` : `Organização · ${ROLE_LABEL[workspace.role]}`}
              icon={<Avatar name={workspace.name} size={36} tone="solid" square />}
              onPress={many ? () => setPicker(true) : undefined}
            />
          </>
        )}
      </Card>

      <SectionHeader title="Notificações" caption="Resumo diário e alertas das suas contas" />
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: pushOn ? t.goodSoft : t.surface2, alignItems: "center", justifyContent: "center" }}>
            <IconBell color={pushOn ? t.good : t.fg2} size={20} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: t.fg, ...typo.heading, fontSize: 15.5 }}>{pushOn ? "Ligadas" : push === "unavailable" ? "Indisponível aqui" : "Desligadas"}</Text>
              {pushOn ? <Chip label="Ativo" tone="good" /> : null}
            </View>
            <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }}>Toda manhã, o destaque mais importante; tocar abre o dashboard certo.</Text>
          </View>
        </View>
        {!pushOn && push !== "unavailable" && <Button size="md" label="Ligar notificações" busy={busy === "push"} onPress={enablePush} />}
        {pushOn && <Button size="md" tone="secondary" label="Enviar notificação de teste" busy={busy === "test"} onPress={testPush} />}
      </Card>
      <Notice text={message} tone="info" />

      <SectionHeader title="Plano" />
      {workspace ? <PlanCard key={workspace.id} workspace={workspace} onChanged={() => setTimeout(refresh, 1500)} /> : null}

      {packages.length > 0 && (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <IconCoins color={t.accent} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }}>Créditos</Text>
              <Text style={{ color: t.fg, fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6, fontVariant: ["tabular-nums"] }}>{me?.credits ?? 0}</Text>
            </View>
          </View>
          {packages.map((p) => (
            <Button key={p.identifier} size="md" tone="secondary" label={`${p.product.title} · ${p.product.priceString}`} busy={busy === p.identifier} onPress={() => purchase(p)} />
          ))}
        </Card>
      )}

      <SectionHeader title="Ajuda e documentos" />
      <Card padded={false} style={{ gap: 0, overflow: "hidden" }}>
        <ListRow label="Termos de Uso" icon={<IconDoc color={t.fg2} size={18} />} onPress={() => void Linking.openURL(`${ENV.apiUrl}/termos`)} />
        <Divider inset={62} />
        <ListRow label="Política de Privacidade" icon={<IconShield color={t.fg2} size={18} />} onPress={() => void Linking.openURL(`${ENV.apiUrl}/privacidade`)} />
        <Divider inset={62} />
        <ListRow label="Falar com o suporte" icon={<IconMail color={t.fg2} size={18} />} onPress={() => void Linking.openURL("mailto:suporte@vyzualize.com.br")} />
      </Card>

      <View style={{ gap: 10, marginTop: 6 }}>
        <Button size="md" tone="secondary" label="Sair" icon={<IconLogout color={t.fg} size={18} />} onPress={() => void auth.signOut()} />
        <Button size="md" tone="danger" label="Excluir conta" icon={<IconTrash color={t.danger} size={18} />} busy={busy === "delete"} onPress={confirmDelete} />
      </View>
      <Text style={{ color: t.fg3, fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: 4 }}>VYZ {Constants.expoConfig?.version} · VYZ Intelligence</Text>
    </ScrollView>
  );
}
