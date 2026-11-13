// Entrar: e-mail e senha, Google e Apple (botão nativo no iPhone).

import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleIcon } from "@/ui/GoogleIcon";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { Button, Field, Notice } from "@/ui/kit";
import { useLayout } from "@/ui/layout";
import { elevation, radius, type, useTheme } from "@/ui/theme";
import { Wordmark } from "@/ui/Wordmark";

export default function Entrar() {
  const t = useTheme();
  const auth = useAuth();
  const { gutter, insets } = useLayout();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "password" | "google" | "apple", fn: () => Promise<string | null>) => {
    setBusy(kind);
    setError(null);
    setError(await fn());
    setBusy(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: gutter, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 420, alignSelf: "center", gap: 14 }}>
          <View style={{ gap: 12, marginBottom: 14 }}>
            <Wordmark width={78} />
            <Text accessibilityRole="header" style={{ color: t.fg, ...type.display, fontSize: 32, lineHeight: 37, marginTop: 10 }}>
              Seus números,{"\n"}
              <Text style={{ color: t.accent }}>na palma da mão.</Text>
            </Text>
            <Text style={{ color: t.fg2, ...type.body }}>Entre com a mesma conta do painel e acompanhe receita, ROAS e campanhas de qualquer lugar.</Text>
          </View>
          <View style={[{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: radius.lg, padding: 18, gap: 14 }, elevation(t, 2)]}>
            <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
            <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={() => run("password", () => auth.signInWithPassword(email, password))} />
            <Notice text={error} />
            <Button label="Entrar" busy={busy === "password"} disabled={!!busy && busy !== "password"} onPress={() => run("password", () => auth.signInWithPassword(email, password))} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
            <Text style={{ color: t.fg3, ...type.caption }}>ou continue com</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
          </View>
          <Button tone="secondary" label="Continuar com Google" icon={<GoogleIcon />} busy={busy === "google"} disabled={!!busy && busy !== "google"} onPress={() => run("google", auth.signInWithGoogle)} />
          {Platform.OS === "android" && <Button tone="secondary" label="Continuar com Apple" busy={busy === "apple"} disabled={!!busy && busy !== "apple"} onPress={() => run("apple", auth.signInWithApple)} />}
          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={t.scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.md}
              style={{ height: 52 }}
              onPress={() => run("apple", auth.signInWithApple)}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
