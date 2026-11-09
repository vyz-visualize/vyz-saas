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
  updatedAt: "9 de novembro de 2026",
} as const;

/** Nome usado nos textos legais enquanto a razão social não está preenchida. */
const BRAND_NAME = "Vyzualize";

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

/**
 * Como os textos legais citam a empresa: com razão social, CNPJ e sede quando preenchidos;
 * com marcador, só o nome. Um marcador nunca aparece na página pública.
 */
export function controllerText(c: { legalName: string; cnpj: string; address: string } = COMPANY): string {
  if (isPlaceholder(c.legalName) || isPlaceholder(c.cnpj)) return `a ${BRAND_NAME}`;
  return `a ${c.legalName}, inscrita no CNPJ ${c.cnpj}${isPlaceholder(c.address) ? "" : `, com sede em ${c.address}`}`;
}
