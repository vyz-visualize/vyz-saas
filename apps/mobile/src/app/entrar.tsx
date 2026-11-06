// Entrar: e-mail e senha, Google e Apple (botão nativo no iPhone).

import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { Button, Field, Notice } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

export default function Entrar() {
  const t = useTheme();
  const auth = useAuth();
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 10, marginBottom: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.accent, fontSize: 20, fontWeight: "900", letterSpacing: -1 }}>VYZ</Text>
          </View>
          <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 34, fontWeight: "800", letterSpacing: -1.1, lineHeight: 38 }}>
            Seus números,{"\n"}
            <Text style={{ color: t.accent }}>na palma da mão.</Text>
          </Text>
          <Text style={{ color: t.fg2, fontSize: 15, lineHeight: 21 }}>Entre com a mesma conta do painel e acompanhe receita, ROAS e campanhas de qualquer lugar.</Text>
        </View>
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" />
        <Notice text={error} />
        <Button label="Entrar" busy={busy === "password"} onPress={() => run("password", () => auth.signInWithPassword(email, password))} />
        <View style={{ height: 8 }} />
        <Button tone="secondary" label="Continuar com Google" busy={busy === "google"} onPress={() => run("google", auth.signInWithGoogle)} />
        {Platform.OS === "android" && <Button tone="secondary" label="Continuar com Apple" busy={busy === "apple"} onPress={() => run("apple", auth.signInWithApple)} />}
        {Platform.OS === "ios" && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ height: 50 }}
            onPress={() => run("apple", auth.signInWithApple)}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
