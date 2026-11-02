import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "evento",
  name: "Evento ou webinar",
  tier: "pro",
  category: "Leads",
  description: "Data em destaque, programação e inscrição.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "Webinar: tráfego que vende, ao vivo, quinta às 20h.",
    sub: "Uma hora de aula prática com casos reais e perguntas ao vivo. Vagas limitadas.",
    cta: "Garantir minha vaga",
    sections: { contagem: true, agenda: true, prova: true, faq: true },
    fields: ["Nome", "E-mail", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Aula prática", "Casos reais, sem enrolação."],
      ["Perguntas ao vivo", "Tire suas dúvidas na hora."],
      ["Material de apoio", "Slides depois da aula."],
    ],
    agenda: [
      ["20h00", "Abertura e casos"],
      ["20h20", "Estrutura de campanha"],
      ["20h40", "Perguntas ao vivo"],
    ],
    stats: [
      ["+3 mil", "inscritos nas edições"],
      ["4,9", "nota dos participantes"],
      ["60 min", "de conteúdo"],
    ],
    quote: ["Saí com um plano pronto para a semana.", "Júlia, gestora de tráfego"],
    countdown: "02 dias · 14 h · 36 min",
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
