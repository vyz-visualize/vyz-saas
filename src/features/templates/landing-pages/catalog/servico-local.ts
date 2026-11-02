import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "servico-local",
  name: "Serviço local",
  tier: "pro",
  category: "Negócio local",
  description: "Serviço, área de atendimento e orçamento rápido.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "Instalação de ar-condicionado no mesmo dia.",
    sub: "Técnicos certificados, garantia de 1 ano e orçamento pelo WhatsApp em minutos.",
    cta: "Pedir orçamento",
    sections: { beneficios: true, prova: true, local: true, whatsapp: true },
    fields: ["Nome", "WhatsApp", "Bairro"],
  },
  copy: {
    benefits: [
      ["No mesmo dia", "Para pedidos até as 12h."],
      ["Garantia de 1 ano", "Em peças e serviço."],
      ["Preço fechado", "Sem surpresa na hora."],
    ],
    stats: [
      ["+2 mil", "instalações"],
      ["4,8", "no Google"],
      ["1 ano", "de garantia"],
    ],
    quote: ["Chegaram no horário e deixaram tudo limpo.", "Carlos, cliente"],
    address: ["Atendemos a cidade toda", "Seg a sáb, 7h às 19h"],
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
