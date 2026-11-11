import { describe, expect, it } from "vitest";
import { clampOffset } from "./useDragOffset";

// botão de 64 px no canto de baixo à direita de uma tela 1440x900
const base = { left: 1348, top: 808, width: 64, height: 64 };
const view = { width: 1440, height: 900 };

describe("clampOffset (botão do assistente arrastável)", () => {
  it("deixa como está o que já cabe", () => {
    expect(clampOffset({ x: -300, y: -200 }, base, view)).toEqual({ x: -300, y: -200 });
  });

  it("não deixa o botão sair da tela", () => {
    expect(clampOffset({ x: 500, y: 500 }, base, view)).toEqual({ x: 20, y: 20 });
    expect(clampOffset({ x: -5000, y: -5000 }, base, view)).toEqual({ x: -1340, y: -800 });
  });
});
