import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "whatsapp",
  name: "Atendimento no WhatsApp",
  tier: "base",
  category: "Negócio local",
  description: "Um botão grande para a conversa, benefícios e endereço.",
  hero: "cta",
  defaults: {
    color: "#4B5320",
    headline: "Tire suas dúvidas agora pelo WhatsApp.",
    sub: "Atendimento de segunda a sábado, das 8h às 20h. Resposta em minutos.",
    cta: "Chamar no WhatsApp",
    sections: { beneficios: true, local: true, faq: true, whatsapp: true },
    fields: ["Nome", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Resposta em minutos", "Atendimento de gente, não de robô."],
      ["Orçamento na hora", "Mande foto e receba o valor."],
      ["Perto de você", "Atendemos a região toda."],
    ],
    address: ["Rua das Palmeiras, 120 · Centro", "Seg a sáb, 8h às 20h"],
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
