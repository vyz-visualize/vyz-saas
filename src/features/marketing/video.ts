// O vídeo "Veja por dentro": arquivos no próprio site (public/video), em duas versões: 16:9
// (NEXT_PUBLIC_DEMO_VIDEO_URL) e, opcional, 4:5 para o celular (NEXT_PUBLIC_DEMO_VIDEO_MOBILE_URL).
// Sem a primeira, a dobra, o link do hero, o item do menu e o "Ver funcionando" não aparecem.
// O WebM de cada versão só entra se existir no build (next.config.ts).

export type VideoSet = { mp4: string; webm: string | null; poster: string };
export type VideoSources = { wide: VideoSet; tall: VideoSet | null };

/** As fontes a partir do MP4. Só caminho do próprio site: o CSP só libera vídeo daqui. */
export function videoSet(url: string | undefined, hasWebm: boolean): VideoSet | null {
  const path = url?.trim();
  if (!path || !/^\/[^/].*\.mp4$/i.test(path)) return null;
  const base = path.replace(/\.mp4$/i, "");
  return { mp4: path, webm: hasWebm ? `${base}.webm` : null, poster: `${base}.jpg` };
}

/** A versão 16:9 é a obrigatória; sem a 4:5, o celular usa a mesma. */
export function videoSources(wide: VideoSet | null, tall: VideoSet | null): VideoSources | null {
  return wide ? { wide, tall } : null;
}

export const DEMO_VIDEO = videoSources(
  videoSet(process.env.NEXT_PUBLIC_DEMO_VIDEO_URL, process.env.NEXT_PUBLIC_DEMO_VIDEO_WEBM === "1"),
  videoSet(process.env.NEXT_PUBLIC_DEMO_VIDEO_MOBILE_URL, process.env.NEXT_PUBLIC_DEMO_VIDEO_MOBILE_WEBM === "1"),
);
export const hasDemoVideo = DEMO_VIDEO !== null;

/** Âncora da dobra, usada pelo menu e pelos links. */
export const VIDEO_SECTION_ID = "por-dentro";

/** "Reduzir movimento" ou economia de dados: não toca sozinho; capa com botão de play. */
export const shouldAutoplay = (s: { reduced: boolean; saveData: boolean }) => !s.reduced && !s.saveData;
