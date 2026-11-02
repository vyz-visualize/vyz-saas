import type { LandingTemplate } from "../types";

export default {
  id: "restaurante-delivery",
  name: "Restaurante e delivery",
  tier: "avancado",
  category: "Negócio local",
  description: "Cardápio em destaque, combo do dia, fotos dos pratos, endereço e pedido direto no WhatsApp.",
  hero: "cta",
  defaults: {
    color: "#7A2E1F",
    headline: "O almoço que chega quentinho, do jeito que você gosta.",
    sub: "Peça pelo WhatsApp e receba em até 40 minutos.",
    cta: "Fazer meu pedido",
    sections: { oferta: true, galeria: true, beneficios: true, local: true, whatsapp: true },
    fields: ["Nome", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Feito na hora", "Nada de comida requentada."],
      ["Entrega em 40 min", "No raio de 5 km."],
      ["Combo do dia", "Prato, bebida e sobremesa."],
    ],
    offer: { title: "Combo executivo", price: "R$ 34,90", note: "prato + bebida + sobremesa" },
    address: ["Av. Central, 455 · Jardim", "Todos os dias, das 11h às 15h e das 18h às 23h"],
    faq: [
      ["Qual o pedido mínimo?", "R$ 30 para entrega. Sem mínimo para retirada."],
      ["Tem opção vegetariana?", "Tem, todos os dias. Pergunte o prato do dia no WhatsApp."],
    ],
  },
} satisfies LandingTemplate;
