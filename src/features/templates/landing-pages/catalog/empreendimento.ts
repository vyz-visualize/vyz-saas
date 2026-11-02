import type { LandingTemplate } from "../types";

export default {
  id: "empreendimento",
  name: "Empreendimento imobiliário",
  tier: "pro",
  category: "Imobiliário",
  description: "Galeria, diferenciais do empreendimento e agendamento de visita.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "2 e 3 quartos a 5 minutos do metrô.",
    sub: "Agende uma visita ao decorado com um corretor e conheça as condições de lançamento.",
    cta: "Agendar visita",
    sections: { galeria: true, beneficios: true, local: true, faq: true, whatsapp: true },
    fields: ["Nome", "WhatsApp", "Quantos quartos?"],
  },
  copy: {
    benefits: [
      ["Varanda gourmet", "Em todas as unidades."],
      ["Lazer completo", "Piscina, academia e coworking."],
      ["Entrega em 2027", "Obras no prazo."],
    ],
    address: ["Av. Central, 900 · Bairro Novo", "Decorado aberto todos os dias, 9h às 18h"],
    faq: [
      ["Tem financiamento?", "Sim, com os principais bancos. O corretor simula com você."],
      ["Aceita permuta?", "Avaliamos caso a caso."],
      ["Quando é a entrega?", "Previsão para dezembro de 2027."],
    ],
  },
} satisfies LandingTemplate;
