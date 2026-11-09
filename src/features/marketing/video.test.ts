import { describe, expect, it } from "vitest";
import { shouldAutoplay, videoSet, videoSources } from "./video";

describe("vídeo Veja por dentro", () => {
  it("sem a variável (ou vazia), não há vídeo: a dobra e os links somem", () => {
    expect(videoSet(undefined, false)).toBeNull();
    expect(videoSet("", false)).toBeNull();
    expect(videoSet("   ", false)).toBeNull();
    expect(videoSources(null, null)).toBeNull();
  });

  it("deriva a capa do caminho do MP4; o WebM só entra se existir", () => {
    expect(videoSet("/video/vyz-por-dentro.mp4", false)).toEqual({ mp4: "/video/vyz-por-dentro.mp4", webm: null, poster: "/video/vyz-por-dentro.jpg" });
    expect(videoSet("/video/vyz-por-dentro.mp4", true)?.webm).toBe("/video/vyz-por-dentro.webm");
  });

  it("só aceita MP4 do próprio site (o CSP não libera outro endereço)", () => {
    expect(videoSet("https://cdn.exemplo.com/a.mp4", false)).toBeNull();
    expect(videoSet("//cdn.exemplo.com/a.mp4", false)).toBeNull();
    expect(videoSet("/video/a.mov", false)).toBeNull();
  });

  it("a versão 16:9 é obrigatória; a 4:5 é opcional e sozinha não liga a dobra", () => {
    const wide = videoSet("/video/a.mp4", true);
    const tall = videoSet("/video/a-celular.mp4", true);
    expect(videoSources(wide, null)).toEqual({ wide, tall: null });
    expect(videoSources(wide, tall)).toEqual({ wide, tall });
    expect(videoSources(null, tall)).toBeNull();
  });

  it("'reduzir movimento' ou economia de dados: não toca sozinho", () => {
    expect(shouldAutoplay({ reduced: false, saveData: false })).toBe(true);
    expect(shouldAutoplay({ reduced: true, saveData: false })).toBe(false);
    expect(shouldAutoplay({ reduced: false, saveData: true })).toBe(false);
  });
});
