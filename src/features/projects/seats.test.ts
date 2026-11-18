import { describe, expect, it } from "vitest";
import { UNLIMITED_MEMBERS } from "@/features/pricing/entitlements";
import { seatsLimit, seatsView } from "./seats";

describe("vagas de usuário", () => {
  it("limite do banco → limite das vagas: 1000 vira ilimitado (null)", () => {
    expect(seatsLimit(1)).toBe(1);
    expect(seatsLimit(UNLIMITED_MEMBERS)).toBeNull();
    expect(seatsLimit(null)).toBeNull();
  });

  it("ilimitado: só o uso, sem total, sem barra e sem bloquear convite", () => {
    const v = seatsView({ used: 7, limit: null });
    expect(v).toMatchObject({ unlimited: true, full: false, free: null, ratio: null, countLabel: "usuários em uso" });
    expect(v.inviteNote).toContain("Usuários ilimitados");
    expect(JSON.stringify(v)).not.toMatch(/1000|de \d+ usuários|vagas? (do plano )?em uso/);
    expect(seatsView({ used: 1, limit: null }).countLabel).toBe("usuário em uso");
  });

  it("Básico com 1 vaga ocupada: cheio, bloqueia o convite", () => {
    const v = seatsView({ used: 1, limit: 1 });
    expect(v).toMatchObject({ unlimited: false, full: true, free: 0, ratio: 1, countLabel: "de 1 usuário" });
    expect(v.inviteNote).toBe("A vaga de usuário do plano está em uso (convites pendentes contam). Suba de plano para convidar mais gente.");
  });

  it("com vaga livre: mostra o total e quanto cabe", () => {
    const v = seatsView({ used: 1, limit: 3 });
    expect(v).toMatchObject({ full: false, free: 2, countLabel: "de 3 usuários", note: "Ainda cabem 2 pessoas." });
    expect(v.inviteNote).toBe("Gasta 1 vaga do plano: 1 de 3 em uso.");
  });
});
