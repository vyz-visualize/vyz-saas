import type { LandingTemplate } from "../types";

export default {
  id: "link-na-bio",
  name: "Link na bio",
  tier: "base",
  category: "Negócio local",
  description: "Uma página curta para o Instagram: botão do WhatsApp no topo, o que você faz e onde fica.",
  hero: "cta",
  defaults: {
    color: "#4B5320",
    headline: "Tudo o que você procura, a um toque.",
    sub: "Chame no WhatsApp para pedir, agendar ou tirar dúvidas.",
    cta: "Chamar no WhatsApp",
    sections: { beneficios: true, local: true, whatsapp: true },
    fields: ["Nome", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Atendimento humano", "Quem responde é a equipe, não um robô."],
      ["Resposta rápida", "Em poucos minutos, no horário comercial."],
      ["Perto de você", "Retirada na loja ou entrega no bairro."],
    ],
    address: ["Rua das Flores, 120 · Centro", "Segunda a sábado, das 9h às 19h"],
    faq: [
      ["Vocês entregam?", "Entregamos no bairro e nas regiões próximas. Pergunte no WhatsApp."],
      ["Quais as formas de pagamento?", "Combinamos tudo pelo WhatsApp, antes de fechar o pedido."],
    ],
  },
} satisfies LandingTemplate;
