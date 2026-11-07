// Dados da empresa usados nos Termos e na Política de Privacidade.
// Preencha antes de publicar o app nas lojas.
export const COMPANY = {
  name: "VYZ",
  legalName: "[RAZÃO SOCIAL]",
  cnpj: "[CNPJ]",
  address: "[ENDEREÇO COMPLETO]",
  privacyEmail: "suporte@vyzualize.com.br",
  supportEmail: "suporte@vyzualize.com.br",
  site: "https://www.vyzualize.com.br",
  updatedAt: "30 de outubro de 2026",
} as const;

/** Ainda é um marcador ("[CNPJ]")? */
const isPlaceholder = (v: string) => !v.trim() || /^\[.*\]$/.test(v.trim());

/**
 * "Razão social · CNPJ ..." para o rodapé do site, só quando os dois estão
 * preenchidos; com marcador, null (a linha não aparece).
 */
export function companyIdentity(c: { legalName: string; cnpj: string } = COMPANY): string | null {
  if (isPlaceholder(c.legalName) || isPlaceholder(c.cnpj)) return null;
  return `${c.legalName} · CNPJ ${c.cnpj}`;
}
