import "server-only";

// Envio pela Cloud API do WhatsApp (Graph API, POST /{phone-number-id}/messages),
// HTTP direto, sem SDK. Sem número ou token configurado: modo simulado (só
// registra no log, status "simulado"), no espírito do pagamento simulado.

import { cleanParam, renderTemplate, TEMPLATES, type TemplateId } from "@/features/whatsapp/templates";
import { isMockWhatsapp, serverEnv } from "@/server/env";

export const GRAPH_VERSION = "v23.0";

export type SendResult = {
  status: "sent" | "simulado" | "failed";
  providerMessageId: string | null;
  /** Texto como o cliente lê (template renderizado ou o texto livre). */
  body: string;
  template: string | null;
  error: string | null;
  /** Código do erro do Meta, se houver. */
  errorCode?: number;
};

type Fetch = typeof fetch;

/** Erros comuns do Meta em português (o resto vira a mensagem original). */
export function mapMetaError(code: number | undefined, fallback = "Falha no envio pelo WhatsApp."): string {
  switch (code) {
    case 131047:
      return "Fora da janela de 24 h: só é possível enviar template aprovado.";
    case 131026:
      return "O número não recebe mensagens do WhatsApp.";
    case 131051:
      return "Tipo de mensagem não suportado.";
    case 132000:
      return "Quantidade de variáveis diferente do template aprovado.";
    case 132001:
      return "Template não existe ou não está aprovado neste idioma.";
    case 132005:
      return "Texto da variável longo demais para o template.";
    case 132012:
      return "Formato de variável recusado pelo template.";
    case 131056:
    case 130429:
    case 131048:
      return "Limite de envio do WhatsApp atingido. Tente mais tarde.";
    case 131021:
      return "Destinatário igual ao remetente.";
    case 190:
      return "Token do WhatsApp inválido ou expirado.";
    case 100:
      return "Parâmetro inválido na chamada ao WhatsApp.";
    default:
      return fallback;
  }
}

async function post(payload: Record<string, unknown>, fetcher: Fetch): Promise<{ id: string | null; error: string | null; code?: number }> {
  const env = serverEnv();
  try {
    const res = await fetcher(`https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string } };
    if (!res.ok || json.error) {
      const code = json.error?.code;
      return { id: null, error: mapMetaError(code, json.error?.message ?? `HTTP ${res.status}`), code };
    }
    return { id: json.messages?.[0]?.id ?? null, error: null };
  } catch (err) {
    console.error("[vyz] whatsapp envio", err);
    return { id: null, error: "Sem resposta do WhatsApp." };
  }
}

/** "+5571999999999" → "5571999999999" (o Graph quer só dígitos). */
const toWa = (phone: string) => phone.replace(/\D/g, "");

/** Template aprovado (mensagem iniciada pela VYZ). */
export async function sendTemplate(to: string, id: TemplateId, params: (string | number | null | undefined)[], fetcher: Fetch = fetch): Promise<SendResult> {
  const def = TEMPLATES[id];
  const body = renderTemplate(id, params);
  if (isMockWhatsapp()) {
    console.info(`[vyz] whatsapp simulado → ${to} (${def.name}): ${body}`);
    return { status: "simulado", providerMessageId: null, body, template: def.name, error: null };
  }
  const values = params.map((p) => ({ type: "text", text: cleanParam(p) }));
  const components: Record<string, unknown>[] = [{ type: "body", parameters: values }];
  // autenticação: o botão "Copiar código" também recebe o código
  if (def.category === "AUTHENTICATION") components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: values[0].text }] });
  const r = await post({ to: toWa(to), type: "template", template: { name: def.name, language: { code: serverEnv().WHATSAPP_TEMPLATE_LANG }, components } }, fetcher);
  return { status: r.error ? "failed" : "sent", providerMessageId: r.id, body, template: def.name, error: r.error, errorCode: r.code };
}

/**
 * Texto livre. Só vale dentro da janela de 24 h depois da última mensagem do
 * cliente (ex.: confirmar o PARAR); fora dela o Meta recusa (131047).
 */
export async function sendText(to: string, text: string, fetcher: Fetch = fetch): Promise<SendResult> {
  if (isMockWhatsapp()) {
    console.info(`[vyz] whatsapp simulado → ${to}: ${text}`);
    return { status: "simulado", providerMessageId: null, body: text, template: null, error: null };
  }
  const r = await post({ to: toWa(to), type: "text", text: { preview_url: false, body: text.slice(0, 4096) } }, fetcher);
  return { status: r.error ? "failed" : "sent", providerMessageId: r.id, body: text, template: null, error: r.error, errorCode: r.code };
}
