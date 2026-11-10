// O vídeo "Veja por dentro": os arquivos finais vêm prontos do projeto do vídeo e ficam em
// public/video, com nomes fixos. Duas versões: 16:9 (vyz-por-dentro) e 4:5 para o celular
// (vyz-por-dentro-celular), cada uma com MP4, WebM e capa em WebP e JPG.
// O next.config.ts lista no build quais desses arquivos existem (NEXT_PUBLIC_DEMO_VIDEO_FILES).
// Sem o MP4 e a capa JPG da 16:9, a dobra, o link do hero e o item do menu não aparecem.

export const VIDEO_DIR = "/video";
export const VIDEO_NAMES = { wide: "vyz-por-dentro", tall: "vyz-por-dentro-celular" } as const;

export type VideoSet = { mp4: string; webm: string | null; poster: { webp: string | null; jpg: string } };
export type VideoSources = { wide: VideoSet; tall: VideoSet | null };

/** Uma versão, se o MP4 e a capa JPG existirem. O WebM e a capa WebP entram se existirem. */
export function videoSet(name: string, has: (file: string) => boolean): VideoSet | null {
  if (!has(`${name}.mp4`) || !has(`${name}.jpg`)) return null;
  const url = (ext: string) => `${VIDEO_DIR}/${name}.${ext}`;
  return {
    mp4: url("mp4"),
    webm: has(`${name}.webm`) ? url("webm") : null,
    poster: { webp: has(`${name}.webp`) ? url("webp") : null, jpg: url("jpg") },
  };
}

/** A versão 16:9 é a obrigatória; sem a 4:5, o celular usa a mesma. */
export function videoSources(wide: VideoSet | null, tall: VideoSet | null): VideoSources | null {
  return wide ? { wide, tall } : null;
}

/** As versões a partir da lista de arquivos presentes em public/video. */
export function demoVideo(files: string | undefined): VideoSources | null {
  const present = new Set((files ?? "").split(",").map((f) => f.trim()).filter(Boolean));
  const has = (f: string) => present.has(f);
  return videoSources(videoSet(VIDEO_NAMES.wide, has), videoSet(VIDEO_NAMES.tall, has));
}

export const DEMO_VIDEO = demoVideo(process.env.NEXT_PUBLIC_DEMO_VIDEO_FILES);
export const hasDemoVideo = DEMO_VIDEO !== null;

/** Âncora da dobra, usada pelo menu e pelos links. */
export const VIDEO_SECTION_ID = "por-dentro";

/** "Reduzir movimento" ou economia de dados: não toca sozinho; capa com botão de play. */
export const shouldAutoplay = (s: { reduced: boolean; saveData: boolean }) => !s.reduced && !s.saveData;
