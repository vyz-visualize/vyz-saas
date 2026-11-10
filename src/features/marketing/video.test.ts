import { describe, expect, it } from "vitest";
import { demoVideo, shouldAutoplay } from "./video";

const ALL = [
  "vyz-por-dentro.mp4",
  "vyz-por-dentro.webm",
  "vyz-por-dentro.webp",
  "vyz-por-dentro.jpg",
  "vyz-por-dentro-celular.mp4",
  "vyz-por-dentro-celular.webm",
  "vyz-por-dentro-celular.webp",
  "vyz-por-dentro-celular.jpg",
];
const without = (...out: string[]) => ALL.filter((f) => !out.includes(f)).join(",");

describe("vídeo Veja por dentro", () => {
  it("sem arquivos em public/video, não há vídeo: a dobra e os links somem", () => {
    expect(demoVideo(undefined)).toBeNull();
    expect(demoVideo("")).toBeNull();
    expect(demoVideo("outro.mp4,outro.jpg")).toBeNull();
  });

  it("com os arquivos finais, as duas versões com WebM e capa em WebP e JPG", () => {
    expect(demoVideo(ALL.join(","))).toEqual({
      wide: {
        mp4: "/video/vyz-por-dentro.mp4",
        webm: "/video/vyz-por-dentro.webm",
        poster: { webp: "/video/vyz-por-dentro.webp", jpg: "/video/vyz-por-dentro.jpg" },
      },
      tall: {
        mp4: "/video/vyz-por-dentro-celular.mp4",
        webm: "/video/vyz-por-dentro-celular.webm",
        poster: { webp: "/video/vyz-por-dentro-celular.webp", jpg: "/video/vyz-por-dentro-celular.jpg" },
      },
    });
  });

  it("WebM e capa WebP são opcionais", () => {
    const v = demoVideo(without("vyz-por-dentro.webm", "vyz-por-dentro.webp"));
    expect(v?.wide.webm).toBeNull();
    expect(v?.wide.poster).toEqual({ webp: null, jpg: "/video/vyz-por-dentro.jpg" });
  });

  it("a 16:9 (MP4 e capa JPG) é obrigatória; a 4:5 é opcional e sozinha não liga a dobra", () => {
    expect(demoVideo(without("vyz-por-dentro.mp4"))).toBeNull();
    expect(demoVideo(without("vyz-por-dentro.jpg"))).toBeNull();
    expect(demoVideo(without("vyz-por-dentro-celular.mp4"))?.tall).toBeNull();
  });

  it("'reduzir movimento' ou economia de dados: não toca sozinho", () => {
    expect(shouldAutoplay({ reduced: false, saveData: false })).toBe(true);
    expect(shouldAutoplay({ reduced: true, saveData: false })).toBe(false);
    expect(shouldAutoplay({ reduced: false, saveData: true })).toBe(false);
  });
});
