// Notificações: token nativo do aparelho (APNs no iOS, FCM no Android),
// registrado no nosso backend, que envia direto (sem serviço de terceiros).
// Com o app aberto, a notificação aparece no topo; tocar abre o dashboard.

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

let lastToken: string | null = null;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushStatus = "granted" | "denied" | "undetermined" | "unavailable";

export async function pushStatus(): Promise<PushStatus> {
  if (Platform.OS === "web") return "unavailable";
  return (await Notifications.getPermissionsAsync()).status as PushStatus;
}

export async function registerPush(): Promise<PushStatus> {
  if (Platform.OS === "web") return "unavailable";
  try {
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "Alertas e resumos", importance: Notifications.AndroidImportance.HIGH });
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return status as PushStatus;
    const device = await Notifications.getDevicePushTokenAsync();
    lastToken = String(device.data);
    await api("/push-tokens", {
      method: "POST",
      body: JSON.stringify({ platform: Platform.OS === "ios" ? "ios" : "android", token: lastToken, appVersion: Constants.expoConfig?.version }),
    });
    return "granted";
  } catch {
    // sem rede: tenta de novo na próxima abertura
    return "undetermined";
  }
}

export async function unregisterPush() {
  if (!lastToken) return;
  await api(`/push-tokens?token=${encodeURIComponent(lastToken)}`, { method: "DELETE" }).catch(() => {});
  lastToken = null;
}

/** Chama `open` com os dados da notificação tocada (inclusive a que abriu o app). */
export function onPushOpen(open: (data: Record<string, unknown>) => void): () => void {
  if (Platform.OS === "web") return () => {};
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    open(last.notification.request.content.data ?? {});
    void Notifications.clearLastNotificationResponseAsync?.();
  }
  const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data ?? {}));
  return () => sub.remove();
}
