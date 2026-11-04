// Tipos de negócio do onboarding (passo 1). Fonte do catálogo no banco
// (npm run db:catalog). available = false aparece como "em breve". Os layouts de
// cada nicho saem de templateBusinessTypes (perfil do template → nichos).

import type { Profile } from "@/features/metrics/definitions";

export type BusinessTypeId = "ecommerce" | "leads" | "imobiliario" | "local" | "infoproduto" | "saude" | "educacao" | "agencia";

export type BusinessType = {
  id: BusinessTypeId;
  name: string;
  description: string;
  /** Perfil de métricas (vocabulário de conversão, metas). */
  profile: Profile;
  /** Ícone do lucide-react. */
  icon: "ShoppingBag" | "Target" | "Building2" | "Store" | "Rocket" | "Stethoscope" | "GraduationCap" | "Briefcase";
  available: boolean;
};

export const BUSINESS_TYPES: BusinessType[] = [
  { id: "ecommerce", name: "E-commerce", description: "Loja virtual: vendas, receita e ROAS.", profile: "ecommerce", icon: "ShoppingBag", available: true },
  { id: "leads", name: "Geração de leads", description: "Formulários e cadastros: custo por lead e qualificação.", profile: "leads", icon: "Target", available: true },
  { id: "imobiliario", name: "Imobiliário", description: "Empreendimentos: lead qualificado, visita e proposta.", profile: "imob", icon: "Building2", available: true },
  { id: "local", name: "Negócio local", description: "Conversas no WhatsApp e ligações.", profile: "local", icon: "Store", available: true },
  { id: "infoproduto", name: "Infoproduto", description: "Lançamentos e perpétuo: do lead à venda.", profile: "infoproduto", icon: "Rocket", available: true },
  { id: "saude", name: "Clínicas e saúde", description: "Agendamentos e consultas.", profile: "saude", icon: "Stethoscope", available: true },
  { id: "educacao", name: "Educação", description: "Matrículas e custo por aluno.", profile: "educacao", icon: "GraduationCap", available: true },
  { id: "agencia", name: "Agência", description: "Vários clientes no mesmo painel.", profile: "agencia", icon: "Briefcase", available: true },
];

export function businessType(id: string | null | undefined): BusinessType | undefined {
  return BUSINESS_TYPES.find((b) => b.id === id);
}

const ALL_BUSINESS: BusinessTypeId[] = BUSINESS_TYPES.map((b) => b.id);

/** Nichos indicados para cada perfil de template (os genéricos servem a todos). */
const BUSINESS_BY_PROFILE: Record<Profile, BusinessTypeId[]> = {
  ecommerce: ["ecommerce"],
  marketplace: ["ecommerce"],
  site: ["ecommerce", "leads"],
  leads: ["leads"],
  imob: ["imobiliario"],
  local: ["local"],
  infoproduto: ["infoproduto"],
  saude: ["saude"],
  educacao: ["educacao"],
  agencia: ["agencia"],
  midia: ALL_BUSINESS,
  pesquisa: ALL_BUSINESS,
  video: ALL_BUSINESS,
  executivo: ALL_BUSINESS,
};

export const templateBusinessTypes = (profile: Profile): BusinessTypeId[] => BUSINESS_BY_PROFILE[profile];
