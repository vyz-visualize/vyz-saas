import "server-only";

// Envio de push direto, sem serviço de terceiros: APNs (HTTP/2, JWT ES256 com
// a chave .p8) no iPhone e FCM v1 (OAuth da conta de serviço) no Android.
// Token que a loja diz que não vale mais é apagado da tabela.

import { connect, type ClientHttp2Session } from "node:http2";
import { createSign, sign as edSign } from "node:crypto";
import { serverEnv } from "@/server/env";
import { createAdminSupabase } from "@/server/supabase/admin";

export type PushMessage = {
  title: string;
  body: string;
  /** Vai para o app ao tocar (ex.: { dashboardId }). */
  data?: Record<string, string>;
};

export type PushTarget = { token: string; platform: "ios" | "android" };

export type PushResult = { sent: number; failed: number; removed: number; skipped: number };

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

// ---- APNs ----------------------------------------------------------------------------

let apnsJwt: { token: string; at: number } | null = null;

function apnsConfig() {
  const env = serverEnv();
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_PRIVATE_KEY) return null;
  return { keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID, key: env.APNS_PRIVATE_KEY.replace(/\\n/g, "\n"), bundleId: env.APNS_BUNDLE_ID };
}

function apnsToken(cfg: NonNullable<ReturnType<typeof apnsConfig>>): string {
  // a Apple aceita o mesmo JWT por até 1 h (e recusa renovar mais de 1 vez a cada 20 min)
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * 60_000) return apnsJwt.token;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }));
  const signature = edSign("sha256", Buffer.from(`${header}.${claims}`), { key: cfg.key, dsaEncoding: "ieee-p1363" });
  apnsJwt = { token: `${header}.${claims}.${b64url(signature)}`, at: Date.now() };
  return apnsJwt.token;
}

function apnsRequest(client: ClientHttp2Session, cfg: NonNullable<ReturnType<typeof apnsConfig>>, token: string, payload: string): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsToken(cfg)}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    req.on("response", (h) => (status = Number(h[":status"])));
    req.setEncoding("utf8");
    req.on("data", (c: string) => (body += c));
    req.on("end", () => {
      let reason: string | undefined;
      try {
        reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined;
      } catch {}
      resolve({ status, reason });
    });
    req.on("error", () => resolve({ status: 0, reason: "network" }));
    req.setTimeout(10_000, () => {
      req.close();
      resolve({ status: 0, reason: "timeout" });
    });
    req.end(payload);
  });
}

/** Envia para iPhones. Builds do Xcode usam o ambiente sandbox; TestFlight e loja, o de produção: tenta os dois. */
async function sendApns(tokens: string[], msg: PushMessage): Promise<{ ok: string[]; dead: string[]; failed: number }> {
  const cfg = apnsConfig();
  if (!cfg || tokens.length === 0) return { ok: [], dead: [], failed: tokens.length };
  const payload = JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" }, ...msg.data });
  const prod = connect("https://api.push.apple.com");
  let sandbox: ClientHttp2Session | null = null;
  const ok: string[] = [];
  const dead: string[] = [];
  let failed = 0;
  try {
    for (const token of tokens) {
      let r = await apnsRequest(prod, cfg, token, payload);
      if (r.status === 400 && r.reason === "BadDeviceToken") {
        sandbox ??= connect("https://api.sandbox.push.apple.com");
        r = await apnsRequest(sandbox, cfg, token, payload);
      }
      if (r.status === 200) ok.push(token);
      else if (r.status === 410 || r.reason === "Unregistered" || r.reason === "BadDeviceToken") dead.push(token);
      else {
        failed++;
        console.error("[vyz] apns", r.status, r.reason);
      }
    }
  } finally {
    prod.close();
    sandbox?.close();
  }
  return { ok, dead, failed };
}

// ---- FCM -----------------------------------------------------------------------------

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let fcmAuth: { token: string; until: number } | null = null;

function fcmAccount(): ServiceAccount | null {
  const raw = serverEnv().FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (fcmAuth && Date.now() < fcmAuth.until) return fcmAuth.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(sa.private_key.replace(/\\n/g, "\n")))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) {
    console.error("[vyz] fcm oauth", res.status);
    return null;
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  fcmAuth = { token: body.access_token, until: Date.now() + (body.expires_in - 120) * 1000 };
  return fcmAuth.token;
}

async function sendFcm(tokens: string[], msg: PushMessage): Promise<{ ok: string[]; dead: string[]; failed: number }> {
  const sa = fcmAccount();
  const access = sa && tokens.length ? await fcmAccessToken(sa) : null;
  if (!sa || !access) return { ok: [], dead: [], failed: tokens.length };
  const ok: string[] = [];
  const dead: string[] = [];
  let failed = 0;
  await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: { token, notification: { title: msg.title, body: msg.body }, data: msg.data ?? {}, android: { priority: "high", notification: { channel_id: "default" } } },
        }),
      }).catch(() => null);
      if (res?.ok) ok.push(token);
      else if (res && (res.status === 404 || res.status === 400) && /UNREGISTERED|INVALID_ARGUMENT/.test(await res.text())) dead.push(token);
      else failed++;
    }),
  );
  return { ok, dead, failed };
}

// ---- público -------------------------------------------------------------------------

export const pushConfigured = () => ({ ios: !!apnsConfig(), android: !!fcmAccount() });

/** Envia a mesma mensagem para os aparelhos e limpa os tokens mortos. */
export async function sendPush(targets: PushTarget[], msg: PushMessage): Promise<PushResult> {
  const ios = targets.filter((t) => t.platform === "ios").map((t) => t.token);
  const android = targets.filter((t) => t.platform === "android").map((t) => t.token);
  const cfg = pushConfigured();
  const [a, f] = await Promise.all([cfg.ios ? sendApns(ios, msg) : null, cfg.android ? sendFcm(android, msg) : null]);
  const dead = [...(a?.dead ?? []), ...(f?.dead ?? [])];
  if (dead.length) await createAdminSupabase().from("push_tokens").delete().in("token", dead);
  return {
    sent: (a?.ok.length ?? 0) + (f?.ok.length ?? 0),
    failed: (a?.failed ?? 0) + (f?.failed ?? 0),
    removed: dead.length,
    skipped: (cfg.ios ? 0 : ios.length) + (cfg.android ? 0 : android.length),
  };
}

/** Todos os aparelhos de um usuário. */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<PushResult> {
  const { data } = await createAdminSupabase().from("push_tokens").select("token, platform").eq("user_id", userId);
  return sendPush((data ?? []).map((t) => ({ token: t.token, platform: t.platform as PushTarget["platform"] })), msg);
}
