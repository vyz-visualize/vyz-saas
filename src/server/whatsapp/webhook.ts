// Leitura do corpo do webhook do WhatsApp (Cloud API): status das mensagens
// enviadas e mensagens recebidas. Puro, sem banco.

export type StatusUpdate = { id: string; status: "sent" | "delivered" | "read" | "failed"; error: string | null };
export type Inbound = { id: string; from: string; text: string };

type Payload = {
  entry?: {
    changes?: {
      value?: {
        statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string; message?: string }[] }[];
        messages?: { id?: string; from?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }[];
      };
    }[];
  }[];
};

const STATUSES = new Set(["sent", "delivered", "read", "failed"]);

export function parseWebhook(body: unknown): { statuses: StatusUpdate[]; messages: Inbound[] } {
  const statuses: StatusUpdate[] = [];
  const messages: Inbound[] = [];
  for (const entry of (body as Payload)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        if (!s.id || !s.status || !STATUSES.has(s.status)) continue;
        const e = s.errors?.[0];
        statuses.push({ id: s.id, status: s.status as StatusUpdate["status"], error: e ? `${e.code ?? ""} ${e.title ?? e.message ?? ""}`.trim() : null });
      }
      for (const m of change.value?.messages ?? []) {
        if (!m.id || !m.from) continue;
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "";
        messages.push({ id: m.id, from: `+${m.from.replace(/\D/g, "")}`, text });
      }
    }
  }
  return { statuses, messages };
}

const RANK: Record<string, number> = { simulado: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/** O status novo avança o atual? (o Meta pode entregar fora de ordem: "read" não volta para "delivered"). */
export const advances = (current: string, next: string) => (RANK[next] ?? 0) > (RANK[current] ?? 0);
