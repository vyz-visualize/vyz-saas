import { WHATSAPP_NUMBER } from "@/features/pricing/pricing";

/** Link do WhatsApp com a mensagem pronta (abre em nova aba). */
export function waLink(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const MSG_SPECIALIST = "Olá, VYZ! Quero montar um plano com um especialista.";
export const MSG_LP_TEAM = "Olá, VYZ! Quero uma landing page feita pelo time.";

/** Upgrade de plano, com o plano atual e o desejado. */
export function msgUpgrade(current: string, target: string, context?: string): string {
  return `Olá, VYZ! Quero fazer upgrade do plano ${current} para o ${target}.${context ? ` ${context}` : ""}`;
}
