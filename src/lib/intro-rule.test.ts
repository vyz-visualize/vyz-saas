import { describe, expect, it } from "vitest";
import { shouldPlayIntro, type IntroVisit } from "./intro-rule";

const first: IntroVisit = { pathname: "/", search: "", hash: "", seen: false, reducedMotion: false };

describe("intro de abertura", () => {
  it("toca só na primeira visita à home", () => {
    expect(shouldPlayIntro(first)).toBe(true);
    expect(shouldPlayIntro({ ...first, seen: true })).toBe(false);
    expect(shouldPlayIntro({ ...first, pathname: "/planos" })).toBe(false);
  });

  it("quem chega de campanha não vê a intro", () => {
    expect(shouldPlayIntro({ ...first, search: "?utm_source=meta&utm_medium=cpc" })).toBe(false);
    expect(shouldPlayIntro({ ...first, search: "?periodo=anual&utm_campaign=lancamento" })).toBe(false);
    expect(shouldPlayIntro({ ...first, search: "?plano=pro" })).toBe(true);
  });

  it("âncora e reduzir movimento também pulam", () => {
    expect(shouldPlayIntro({ ...first, hash: "#planos" })).toBe(false);
    expect(shouldPlayIntro({ ...first, reducedMotion: true })).toBe(false);
  });

  it("o texto da função roda sozinho, como no script do <head>", () => {
    const fn = new Function(`return (${shouldPlayIntro.toString()})`)() as typeof shouldPlayIntro;
    expect(fn(first)).toBe(true);
    expect(fn({ ...first, search: "?utm_source=google" })).toBe(false);
  });
});
