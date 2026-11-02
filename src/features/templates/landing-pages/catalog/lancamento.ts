import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "lancamento",
  name: "Lançamento",
  tier: "avancado",
  category: "Infoproduto",
  description: "Contagem regressiva, oferta de lançamento e prova social.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "As inscrições abrem segunda. Entre na lista de espera.",
    sub: "Quem está na lista recebe o acesso antes e a condição de lançamento.",
    cta: "Entrar na lista",
    sections: { contagem: true, oferta: true, prova: true, faq: true },
    fields: ["Nome", "E-mail", "WhatsApp"],
  },
  copy: {
    benefits: [
      ["Acesso antecipado", "Antes da abertura geral."],
      ["Condição de lançamento", "Só para a lista."],
      ["Comunidade", "Grupo exclusivo de alunos."],
    ],
    stats: [
      ["+5 mil", "alunos"],
      ["4,9", "satisfação"],
      ["12", "módulos"],
    ],
    quote: ["O curso mudou o jeito que eu trabalho.", "Ana, aluna"],
    offer: { title: "Condição de lançamento", price: "R$ 997", note: "ou em parcelas no cartão" },
    countdown: "04 dias · 09 h · 12 min",
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
