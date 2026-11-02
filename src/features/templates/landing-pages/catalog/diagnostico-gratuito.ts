import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "diagnostico-gratuito",
  name: "Diagnóstico gratuito",
  tier: "pro",
  category: "Leads",
  description: "Para consultorias e serviços B2B: oferta de um diagnóstico sem custo, com prova social e perguntas que qualificam o lead.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "Descubra em 30 minutos onde sua empresa está perdendo dinheiro.",
    sub: "Diagnóstico gratuito com um especialista. Você sai da conversa com três ações práticas.",
    cta: "Quero meu diagnóstico",
    sections: { beneficios: true, prova: true, faq: true, whatsapp: true },
    fields: ["Nome", "E-mail", "WhatsApp", "Empresa", "Faturamento mensal"],
  },
  copy: {
    benefits: [
      ["30 minutos", "Uma conversa objetiva, por vídeo."],
      ["Plano de ação", "Três ações para aplicar já na semana."],
      ["Sem custo", "Você decide depois se quer seguir."],
    ],
    stats: [
      ["+300", "empresas atendidas"],
      ["27%", "de economia média"],
      ["4,9", "nota das conversas"],
    ],
    quote: ["Em meia hora vimos o que a gente não enxergava havia um ano.", "Carlos, diretor comercial"],
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
