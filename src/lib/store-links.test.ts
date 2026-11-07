import { describe, expect, it } from "vitest";
import { storeLinks } from "./store-links";

describe("links das lojas", () => {
  it("sem URL, nada aparece", () => {
    expect(storeLinks({})).toEqual({ appStore: null, playStore: null });
  });
  it("só https das próprias lojas", () => {
    expect(storeLinks({ appStore: "https://apps.apple.com/br/app/vyzualize/id123", playStore: "https://play.google.com/store/apps/details?id=br.com.vyzualize" })).toEqual({
      appStore: "https://apps.apple.com/br/app/vyzualize/id123",
      playStore: "https://play.google.com/store/apps/details?id=br.com.vyzualize",
    });
    expect(storeLinks({ appStore: "http://apps.apple.com/x", playStore: "https://exemplo.com/play.google.com" })).toEqual({ appStore: null, playStore: null });
  });
});
