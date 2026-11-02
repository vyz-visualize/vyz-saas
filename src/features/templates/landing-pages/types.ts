// Tipos dos templates de landing page e as seções que o editor conhece.

export type LandingSection = "beneficios" | "prova" | "oferta" | "agenda" | "local" | "galeria" | "contagem" | "faq" | "whatsapp";

export const SECTION_LABEL: Record<LandingSection, string> = {
  beneficios: "Benefícios",
  prova: "Prova social",
  oferta: "Oferta",
  agenda: "Programação",
  local: "Endereço e horário",
  galeria: "Galeria",
  contagem: "Contagem regressiva",
  faq: "Perguntas frequentes",
  whatsapp: "Botão de WhatsApp",
};

export type LandingContent = {
  brand: string;
  /** dataURL (upload em memória). */
  logo?: string;
  color: string;
  headline: string;
  sub: string;
  cta: string;
  sections: Partial<Record<LandingSection, boolean>>;
  fields: string[];
  whatsapp: string;
};

export type LandingTemplate = {
  id: string;
  name: string;
  tier: "base" | "pro" | "avancado";
  category: string;
  description: string;
  /** "form": formulário no topo; "cta": botão para o WhatsApp no topo. */
  hero: "form" | "cta";
  defaults: Omit<LandingContent, "brand" | "logo" | "whatsapp">;
  /** Textos fixos das seções (amostra). */
  copy: {
    benefits: [string, string][];
    stats?: [string, string][];
    quote?: [string, string];
    offer?: { title: string; price: string; note: string };
    agenda?: [string, string][];
    address?: [string, string];
    faq: [string, string][];
    countdown?: string;
  };
};

