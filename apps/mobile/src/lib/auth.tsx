// Sessão do app: e-mail e senha, Google (nativo, idToken) e Apple (nativo
// no iPhone, com nonce; no Android, pelo navegador com PKCE). Os tokens do Google e da Apple são trocados pela sessão no
// Supabase (signInWithIdToken): mesmo usuário do site.

import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import type { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { api } from "./api";
import { ENV } from "./env";
import { identifyPurchases, resetPurchases } from "./purchases";
import { registerPush, unregisterPush } from "./push";
import { supabase } from "./supabase";

GoogleSignin.configure({ iosClientId: ENV.googleIosClientId || undefined, webClientId: ENV.googleWebClientId || undefined });

type Auth = {
  session: Session | null;
  ready: boolean;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  signInWithGoogle(): Promise<string | null>;
  signInWithApple(): Promise<string | null>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<string | null>;
};

const AuthContext = createContext<Auth | null>(null);

const GENERIC = "Não foi possível entrar agora. Tente de novo.";

/** Apple fora do iPhone: consentimento no navegador e volta em vyz://auth com o code (PKCE). */
async function appleInBrowser(): Promise<string | null> {
  try {
    const redirectTo = Linking.createURL("auth");
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "apple", options: { redirectTo, skipBrowserRedirect: true, scopes: "name email" } });
    if (error || !data.url) return GENERIC;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return null;
    const code = new URL(result.url).searchParams.get("code");
    if (!code) return GENERIC;
    const { error: exchange } = await supabase.auth.exchangeCodeForSession(code);
    return exchange ? GENERIC : null;
  } catch {
    return GENERIC;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void identifyPurchases(session.user.id);
    void registerPush();
  }, [session]);

  const value: Auth = {
    session,
    ready,
    async signInWithPassword(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      return error ? "E-mail ou senha incorretos." : null;
    },
    async signInWithGoogle() {
      try {
        await GoogleSignin.hasPlayServices();
        const res = await GoogleSignin.signIn();
        if (!isSuccessResponse(res)) return null;
        const idToken = res.data.idToken;
        if (!idToken) return GENERIC;
        const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
        // o motivo curto vai junto (sem token): sem ele, um erro de configuração vira adivinhação
        return error ? `${GENERIC} (Google: ${error.message.slice(0, 80)})` : null;
      } catch (err) {
        const e = err as { code?: string | number; message?: string };
        return `${GENERIC} (Google: ${String(e.code ?? e.message ?? "erro").slice(0, 60)})`;
      }
    },
    async signInWithApple() {
      if (Platform.OS !== "ios") return appleInBrowser();
      try {
        const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
        if (!credential.identityToken) return GENERIC;
        const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
        if (error) return GENERIC;
        // a Apple só manda o nome na primeira vez
        const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
        if (name) await supabase.auth.updateUser({ data: { full_name: name } });
        return null;
      } catch (err) {
        if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
        return GENERIC;
      }
    },
    async signOut() {
      await unregisterPush();
      await resetPurchases();
      await GoogleSignin.signOut().catch(() => {});
      await supabase.auth.signOut();
    },
    async deleteAccount() {
      try {
        await api("/account", { method: "DELETE" });
        await resetPurchases();
        await supabase.auth.signOut({ scope: "local" });
        return null;
      } catch (err) {
        return (err as Error).message || "Não foi possível excluir a conta agora.";
      }
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) throw new Error("useAuth precisa do AuthProvider");
  return auth;
}
