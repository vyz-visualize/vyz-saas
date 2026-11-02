import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "sazonal",
  name: "Promoção sazonal",
  tier: "avancado",
  category: "E-commerce",
  description: "Contagem regressiva, oferta e chamada urgente.",
  hero: "cta",
  defaults: {
    color: "#4B5320",
    headline: "Semana do consumidor: até 40% off em toda a loja.",
    sub: "Só até domingo ou enquanto durar o estoque.",
    cta: "Ver as ofertas",
    sections: { contagem: true, oferta: true, beneficios: true, whatsapp: true },
    fields: ["Nome", "E-mail"],
  },
  copy: {
    benefits: [
      ["Até 40% off", "Em toda a loja."],
      ["Entrega rápida", "Em até 48 h."],
      ["Troca fácil", "Até 30 dias."],
    ],
    offer: { title: "Combo da semana", price: "R$ 129,90", note: "de R$ 199,90" },
    countdown: "01 dia · 22 h · 05 min",
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
