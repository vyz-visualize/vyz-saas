import { describe, expect, it } from "vitest";
import { isVideoFormat } from "./CreativeImage";

describe("isVideoFormat", () => {
  it("aceita as grafias que chegam", () => {
    for (const f of ["video", "Vídeo", "VIDEO", "Video", "Reels", " vídeo "]) expect(isVideoFormat(f)).toBe(true);
    for (const f of ["image", "Imagem", "Carrossel", "", null, undefined]) expect(isVideoFormat(f)).toBe(false);
  });
});
