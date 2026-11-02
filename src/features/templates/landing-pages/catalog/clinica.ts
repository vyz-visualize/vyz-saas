import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "clinica",
  name: "Clínica",
  tier: "avancado",
  category: "Saúde",
  description: "Especialidades, equipe, convênios e agendamento.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "Agende sua consulta com quem entende do assunto.",
    sub: "Atendimento humanizado, convênios e particular. Horários de segunda a sábado.",
    cta: "Agendar consulta",
    sections: { beneficios: true, prova: true, local: true, faq: true, whatsapp: true },
    fields: ["Nome", "WhatsApp", "Especialidade"],
  },
  copy: {
    benefits: [
      ["Especialistas", "Equipe com registro e experiência."],
      ["Convênios", "Aceitamos os principais planos."],
      ["Horários flexíveis", "Inclusive aos sábados."],
    ],
    stats: [
      ["+15 mil", "pacientes"],
      ["4,9", "no Google"],
      ["12", "especialidades"],
    ],
    quote: ["Fui muito bem atendida do começo ao fim.", "Patrícia, paciente"],
    address: ["Rua da Saúde, 45 · Sala 302", "Seg a sex, 7h às 20h · sáb, 8h às 13h"],
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
