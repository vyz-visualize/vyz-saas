import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "produto-oferta",
  name: "Produto ou oferta",
  tier: "base",
  category: "E-commerce",
  description: "Oferta em destaque, benefícios e chamada para comprar.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "A coleção nova chegou. Entrega em 48 h.",
    sub: "Escolha, pague no Pix e receba em casa. Troca fácil em até 30 dias.",
    cta: "Quero 10% na primeira compra",
    sections: { oferta: true, beneficios: true, prova: true, faq: false, whatsapp: true },
    fields: ["Nome", "E-mail", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Entrega em 48 h", "Para capitais e regiões metropolitanas."],
      ["Troca fácil", "Até 30 dias para trocar."],
      ["Pix com desconto", "5% a menos no Pix."],
    ],
    stats: [
      ["+8 mil", "pedidos entregues"],
      ["4,9", "avaliação média"],
      ["48 h", "prazo de entrega"],
    ],
    quote: ["Chegou antes do prazo e o tecido é ótimo.", "Rafael, cliente"],
    offer: { title: "Kit coleção nova", price: "R$ 189,90", note: "ou R$ 180,40 no Pix" },
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
