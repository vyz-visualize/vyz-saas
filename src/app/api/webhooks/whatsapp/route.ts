// /api/webhooks/whatsapp
// GET: verificação do Meta (hub.mode=subscribe, hub.verify_token, hub.challenge).
// POST: eventos da Cloud API, só com X-Hub-Signature-256 válido. Atualiza o
// status das mensagens e trata as respostas: PARAR/SAIR descadastra, VOLTAR
// cadastra de novo. Responde 200 rápido (o Meta reenvia em caso de erro).

import { parseReplyCommand } from "@/features/whatsapp/rules";
import { serverEnv } from "@/server/env";
import { createAdminSupabase } from "@/server/supabase/admin";
import { sendText } from "@/server/whatsapp/client";
import { recordOut } from "@/server/whatsapp/service";
import { isValidSignature } from "@/server/whatsapp/signature";
import { advances, parseWebhook } from "@/server/whatsapp/webhook";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const token = serverEnv().WHATSAPP_VERIFY_TOKEN;
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain", ...NO_STORE } });
  }
  return new Response("forbidden", { status: 403, headers: NO_STORE });
}

const STOP_REPLY = "Pronto, você não vai mais receber relatórios da VYZ por aqui. Para voltar, responda VOLTAR.";
const RESUME_REPLY = "Relatórios da VYZ reativados. Para parar a qualquer momento, responda PARAR.";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!isValidSignature(raw, request.headers.get("x-hub-signature-256"), serverEnv().WHATSAPP_APP_SECRET)) {
    return Response.json({ ok: false, error: "invalid_signature" }, { status: 401, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }
  const { statuses, messages } = parseWebhook(body);
  const db = createAdminSupabase();

  for (const s of statuses) {
    const { data: row } = await db.from("whatsapp_messages").select("id, status").eq("provider_message_id", s.id).maybeSingle();
    if (!row || !advances(row.status, s.status)) continue;
    await db.from("whatsapp_messages").update({ status: s.status, ...(s.error ? { error: s.error } : {}) }).eq("id", row.id);
  }

  for (const m of messages) {
    const { data: subs } = await db.from("whatsapp_subscriptions").select("id, opted_out_at").eq("phone", m.from).not("verified_at", "is", null);
    const ids = (subs ?? []).map((s) => s.id);
    // registro da resposta (uma linha por inscrição; sem inscrição, sem dono)
    const { error: logError } = await db.from("whatsapp_messages").insert(
      (ids.length ? ids : [null]).map((id, n) => ({ subscription_id: id, direction: "in", kind: "resposta", status: "received", provider_message_id: n === 0 ? m.id : null, body: m.text.slice(0, 1000) })),
    );
    // id repetido: o Meta reenviou o mesmo evento, já tratado
    if (logError?.code === "23505") continue;
    if (!ids.length) continue;
    const cmd = parseReplyCommand(m.text);
    const now = new Date().toISOString();
    if (cmd === "stop") {
      await db.from("whatsapp_subscriptions").update({ opted_out_at: now }).in("id", ids);
      await recordOut(db, ids[0], "texto", await sendText(m.from, STOP_REPLY));
    } else if (cmd === "resume") {
      await db.from("whatsapp_subscriptions").update({ opted_out_at: null, opted_in_at: now, opt_in_source: "whatsapp" }).in("id", ids);
      await recordOut(db, ids[0], "texto", await sendText(m.from, RESUME_REPLY));
    }
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
