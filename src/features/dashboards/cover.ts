// Capa do dashboard (visuais com capa, como o Fachada): a imagem do empreendimento, o
// endereço embaixo do título e a planilha do lançamento. Puro: os tipos que a moldura
// do visual, o dashboard e o servidor repetem.

import type { LaunchSummary } from "@/features/import/launch-sheet";

/** recorte: imagem sem fundo (PNG ou WebP transparente), solta sobre a capa. foto: preenche um quadro arredondado. */
export type CoverFit = "recorte" | "foto";

export type DashboardCover = {
  /** Endereço da imagem. null = a ilustração padrão do visual. */
  image: string | null;
  fit: CoverFit;
  /** Linha embaixo do título (endereço do empreendimento). Vazio = o nome do cliente. */
  address: string;
};

export const NO_COVER: DashboardCover = { image: null, fit: "recorte", address: "" };

export const COVER_MAX_BYTES = 4 * 1024 * 1024;
export const COVER_TYPES = ["image/png", "image/webp", "image/jpeg"] as const;
export const COVER_ADDRESS_MAX = 120;
/** O que pedir à pessoa, em uma frase. */
export const COVER_HINT = "PNG ou WebP sem fundo (o prédio recortado) fica solto na capa; foto em JPG entra num quadro. Em pé (3:4), até 4 MB.";

/** Capa salva (jsonb) → capa válida. Qualquer coisa fora do formato cai no padrão. */
export function parseCover(raw: unknown): DashboardCover {
  if (typeof raw !== "object" || raw === null) return NO_COVER;
  const r = raw as Record<string, unknown>;
  const image = typeof r.image === "string" && /^(https:\/\/|\/|blob:|data:image\/)/.test(r.image) ? r.image : null;
  return {
    image,
    fit: r.fit === "foto" ? "foto" : "recorte",
    address: typeof r.address === "string" ? r.address.trim().slice(0, COVER_ADDRESS_MAX) : "",
  };
}

/** Por que o arquivo não serve (null = serve). */
export function coverFileError(file: { type: string; size: number }): string | null {
  if (!(COVER_TYPES as readonly string[]).includes(file.type)) return "Use uma imagem PNG, WebP ou JPG.";
  if (file.size > COVER_MAX_BYTES) return "A imagem passa de 4 MB. Reduza e tente de novo.";
  return null;
}

/**
 * A imagem tem fundo transparente? Olha os quatro cantos (num prédio recortado, eles
 * ficam vazios). Recebe os pixels RGBA já lidos: serve no navegador e no teste.
 */
export function fitFromPixels(rgba: Uint8ClampedArray | readonly number[], width: number, height: number): CoverFit {
  if (width < 2 || height < 2) return "foto";
  const alpha = (x: number, y: number) => rgba[(y * width + x) * 4 + 3] ?? 255;
  const corners = [alpha(0, 0), alpha(width - 1, 0), alpha(0, height - 1), alpha(width - 1, height - 1)];
  return corners.filter((a) => a < 32).length >= 2 ? "recorte" : "foto";
}

// ---- o que o visual recebe ------------------------------------------------------------

export type CoverControl = {
  value: DashboardCover;
  /** Sem isso, só leitura (link público, miniatura, PDF). */
  onChange?: (next: DashboardCover) => void;
  /** Recebe o arquivo escolhido e devolve o endereço da imagem (e se ela é recorte ou foto). */
  pickImage?: (file: File) => Promise<{ ok: true; url: string; fit: CoverFit } | { ok: false; error: string }>;
};

export type LaunchSheetState = {
  /** Link salvo (o servidor relê todo dia). null = sem link. */
  link: string | null;
  /** O que a planilha trouxe na última leitura. null = sem planilha: os números do funil são os do modelo. */
  summary: LaunchSummary | null;
  /** Última releitura que falhou (os números mostrados são os da leitura anterior). */
  error?: string | null;
};

export type LaunchSheetInput = { link: string } | { pasted: string };
export type LaunchSheetOutcome = { ok: true; summary: LaunchSummary } | { ok: false; error: string };

export type LaunchSheetControl = {
  state: LaunchSheetState;
  /** Código deste workspace: vai no cabeçalho do modelo e liga a planilha a ele. */
  code: string;
  /** E-mail da conta de serviço que lê planilhas fechadas. null = só planilhas abertas por link. */
  serviceEmail: string | null;
  /** Sem isso, só leitura. */
  connect?: (input: LaunchSheetInput) => Promise<LaunchSheetOutcome>;
  disconnect?: () => void;
};
