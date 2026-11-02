import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "captura-leads",
  name: "Captura de leads",
  tier: "base",
  category: "Leads",
  description: "Formulário no topo, benefícios e prova social. Para campanhas de cadastro.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "Fale com um especialista ainda hoje.",
    sub: "Deixe seu contato e receba uma proposta sob medida em até 24 horas.",
    cta: "Quero ser contatado",
    sections: { beneficios: true, prova: true, faq: true, whatsapp: true },
    fields: ["Nome", "E-mail", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Resposta rápida", "Retorno no mesmo dia útil."],
      ["Proposta sob medida", "Pensada para o seu caso."],
      ["Sem compromisso", "Você decide depois de conversar."],
    ],
    stats: [
      ["+1.200", "clientes atendidos"],
      ["4,8", "nota média"],
      ["24 h", "para a proposta"],
    ],
    quote: ["A proposta chegou no mesmo dia e era exatamente o que eu precisava.", "Marina, cliente"],
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
