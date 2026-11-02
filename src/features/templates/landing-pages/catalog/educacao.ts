import { COMMON_FAQ } from "../shared";
import type { LandingTemplate } from "../types";

export default {
  id: "educacao",
  name: "Educação · Matrícula",
  tier: "avancado",
  category: "Educação",
  description: "Cursos, diferenciais, visita e matrícula.",
  hero: "form",
  defaults: {
    color: "#4B5320",
    headline: "Matrículas abertas para 2027.",
    sub: "Agende uma visita, conheça a estrutura e garanta a vaga com condição especial.",
    cta: "Agendar visita",
    sections: { beneficios: true, galeria: true, prova: true, faq: true, whatsapp: true },
    fields: ["Nome do responsável", "WhatsApp", "Série do aluno"],
  },
  copy: {
    benefits: [
      ["Turmas reduzidas", "Atenção individual."],
      ["Período integral", "Com atividades extras."],
      ["Bilíngue", "Inglês todos os dias."],
    ],
    stats: [
      ["30 anos", "de história"],
      ["98%", "de aprovação"],
      ["20", "alunos por turma"],
    ],
    quote: ["Meu filho adora ir para a escola.", "Renata, mãe de aluno"],
    faq: COMMON_FAQ,
  },
} satisfies LandingTemplate;
