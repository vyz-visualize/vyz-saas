// Identidade de um workspace (cliente ou marca; na tabela, projeto): a cor e a logo.
// A paleta, a cor do texto legível sobre a cor escolhida e o caminho da logo no bucket.
// Puro: o servidor e a tela usam o mesmo.

/** Cores prontas (escuras o bastante para as iniciais em branco). Sem cor, a padrão (o oliva da marca). */
export const PROJECT_COLORS = [
  { hex: "#2f6b4f", name: "Verde" },
  { hex: "#1f6f78", name: "Petróleo" },
  { hex: "#2563eb", name: "Azul" },
  { hex: "#4f46e5", name: "Índigo" },
  { hex: "#7c3aed", name: "Roxo" },
  { hex: "#c026d3", name: "Magenta" },
  { hex: "#db2777", name: "Rosa" },
  { hex: "#dc2626", name: "Vermelho" },
  { hex: "#c2410c", name: "Laranja" },
  { hex: "#b45309", name: "Âmbar" },
  { hex: "#475569", name: "Ardósia" },
] as const;

const HEX = /^#[0-9a-f]{6}$/;

/** Cor válida (#rrggbb), em minúsculas como o banco guarda; null quando não é uma cor. */
export function normalizeProjectColor(value: string): string | null {
  const c = value.trim().toLowerCase();
  return HEX.test(c) ? c : null;
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const INK = "#161714";
const INK_L = 0.0083;

/** Cor do texto sobre a cor (branco nas escuras, quase preto nas claras): a de maior contraste. */
export function textOn(hex: string): "#ffffff" | typeof INK {
  const n = parseInt(hex.slice(1), 16);
  const l = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return 1.05 / (l + 0.05) >= (l + 0.05) / (INK_L + 0.05) ? "#ffffff" : INK;
}

/** Iniciais de um nome (até duas letras). */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

/** Caminho da logo de um workspace no bucket brand-assets (pasta da organização; o nome é do servidor). */
export const projectLogoPath = (workspaceId: string, projectId: string, random: string, ext: "png" | "jpg" | "webp") => `${workspaceId}/projects/${projectId}/logo-${random}.${ext}`;

/** O caminho é uma logo gravada pelo servidor para este workspace (só essas são apagadas daqui). */
export function isOwnProjectLogo(workspaceId: string, projectId: string, path: string | null | undefined): path is string {
  return !!path && new RegExp(`^${workspaceId}/projects/${projectId}/logo-[0-9a-f]{16}\\.(png|jpg|webp)$`).test(path);
}
