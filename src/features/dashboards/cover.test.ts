import { describe, expect, it } from "vitest";
import { COVER_ADDRESS_MAX, COVER_MAX_BYTES, coverFileError, fitFromPixels, NO_COVER, parseCover } from "./cover";

describe("capa do dashboard", () => {
  it("capa salva válida passa; o que vier fora do formato cai no padrão", () => {
    expect(parseCover({ image: "https://x.supabase.co/storage/v1/object/public/capas/a.png", fit: "foto", address: "  Av. Beira-Mar, 2875  " })).toEqual({ image: "https://x.supabase.co/storage/v1/object/public/capas/a.png", fit: "foto", address: "Av. Beira-Mar, 2875" });
    for (const raw of [null, undefined, "x", 3, []]) expect(parseCover(raw)).toEqual(NO_COVER);
    expect(parseCover({ fit: "outro", address: 12 })).toEqual(NO_COVER);
    expect(parseCover({ address: "x".repeat(400) }).address).toHaveLength(COVER_ADDRESS_MAX);
  });

  it("endereço de imagem que não é https, local ou imagem embutida é descartado", () => {
    for (const image of ["javascript:alert(1)", "http://inseguro.example/a.png", "data:text/html;base64,AAAA", "ftp://x/a.png"]) expect(parseCover({ image }).image).toBeNull();
    for (const image of ["https://cdn.example/a.webp", "/capas/a.png", "blob:http://localhost:3000/1-2", "data:image/png;base64,AAAA"]) expect(parseCover({ image }).image).toBe(image);
  });

  it("só PNG, WebP ou JPG de até 4 MB", () => {
    expect(coverFileError({ type: "image/png", size: 1000 })).toBeNull();
    expect(coverFileError({ type: "image/webp", size: COVER_MAX_BYTES })).toBeNull();
    expect(coverFileError({ type: "image/svg+xml", size: 1000 })).toMatch(/PNG, WebP ou JPG/);
    expect(coverFileError({ type: "image/jpeg", size: COVER_MAX_BYTES + 1 })).toMatch(/4 MB/);
  });

  it("cantos transparentes: recorte; imagem cheia: foto", () => {
    const pixels = (w: number, h: number, alpha: (x: number, y: number) => number) => {
      const out: number[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(120, 120, 120, alpha(x, y));
      return out;
    };
    // prédio no meio, com o fundo vazio
    expect(fitFromPixels(pixels(8, 8, (x) => (x > 1 && x < 6 ? 255 : 0)), 8, 8)).toBe("recorte");
    expect(fitFromPixels(pixels(8, 8, () => 255), 8, 8)).toBe("foto");
    // só um canto vazio (marca d'água, sombra) ainda é foto
    expect(fitFromPixels(pixels(8, 8, (x, y) => (x === 0 && y === 0 ? 0 : 255)), 8, 8)).toBe("foto");
    expect(fitFromPixels([], 0, 0)).toBe("foto");
  });
});
