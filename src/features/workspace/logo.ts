// Logo da organização e dos workspaces (todos os planos): o tipo vem dos primeiros bytes do
// arquivo, nunca do nome nem do Content-Type que o navegador manda. Só PNG,
// JPEG e WebP (o bucket brand-assets recusa SVG: SVG executa script).

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

export const LOGO_HINT = "PNG, JPEG ou WebP, até 2 MB. Fundo transparente fica melhor.";

export type LogoType = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) => bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

/** Tipo da imagem pelos números mágicos. null = não é PNG, JPEG nem WebP. */
export function sniffLogo(bytes: Uint8Array): LogoType | null {
  if (startsWith(bytes, PNG)) return { mime: "image/png", ext: "png" };
  if (startsWith(bytes, JPEG)) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return { mime: "image/webp", ext: "webp" };
  return null;
}

export const LOGO_MESSAGES = {
  missing: "Escolha uma imagem para o logo.",
  empty: "O arquivo está vazio.",
  tooBig: "O logo pode ter até 2 MB.",
  type: "Use uma imagem PNG, JPEG ou WebP.",
} as const;

/** Conferência rápida no navegador (o servidor confere de novo, pelos bytes). */
export function logoProblem(file: { size: number; type: string }): string | null {
  if (file.size === 0) return LOGO_MESSAGES.empty;
  if (file.size > LOGO_MAX_BYTES) return LOGO_MESSAGES.tooBig;
  if (file.type && !LOGO_ACCEPT.split(",").includes(file.type)) return LOGO_MESSAGES.type;
  return null;
}
