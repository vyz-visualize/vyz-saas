import { describe, expect, it } from "vitest";
import { mmmReadiness, type MonthSpend, type OutcomeMonths } from "./readiness";

const today = "2026-11-25";
/** n meses com gasto até o mês de hoje, com o gasto diário variando (ou sempre igual). */
function months(projectId: string, platform: string, n: number, opts: { flat?: boolean; endsAgo?: number } = {}): MonthSpend[] {
  const out: MonthSpend[] = [];
  for (let i = 0; i < n; i++) {
    const t = 2026 * 12 + 10 - (opts.endsAgo ?? 0) - i;
    const month = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
    const days = 30;
    // diário: média 100; variando, metade dos dias 50 e metade 150 (desvio 50); fixo, sempre 100
    const spend = 100 * days;
    const sumSq = opts.flat ? days * 100 * 100 : (days / 2) * (50 * 50 + 150 * 150);
    out.push({ projectId, platform, month, spend: opts.flat ? spend : spend * (1 + (i % 3) * 0.2), days, sumSq });
  }
  return out;
}
const ga4 = (projectId: string, n: number): OutcomeMonths => ({ projectId, source: "ga4", connected: true, months: Array.from({ length: n }, (_, i) => `2026-${String(11 - i).padStart(2, "0")}`) });
const crit = (r: ReturnType<typeof mmmReadiness>[number]) => Object.fromEntries(r.criteria.map((c) => [c.id, c.ok]));

describe("o que falta para o MMM de cada cliente", () => {
  it("cliente pronto: 2 canais, 6 meses em cada, resultado independente com 6 meses e verba variando", () => {
    const [r] = mmmReadiness([{ id: "a", name: "Cliente A" }], [...months("a", "meta", 8), ...months("a", "google", 7)], [ga4("a", 6)], today);
    expect(crit(r)).toEqual({ canais: true, historico: true, resultado: true, variacao: true });
    expect(r.ready).toBe(true);
    expect(r.channels.map((c) => c.platform)).toEqual(["google", "meta"]);
  });

  it("cliente com 1 canal: falta o segundo (e o resto pode estar ok)", () => {
    const [r] = mmmReadiness([{ id: "b", name: "Cliente B" }], months("b", "meta", 12), [ga4("b", 12)], today);
    expect(crit(r).canais).toBe(false);
    expect(crit(r).historico).toBe(true);
    expect(r.ready).toBe(false);
  });

  it("histórico curto: quantos meses tem e a partir de quando cumpre, se continuar investindo", () => {
    const [r] = mmmReadiness([{ id: "c", name: "C" }], [...months("c", "meta", 4), ...months("c", "google", 9)], [ga4("c", 9)], today);
    const meta = r.channels.find((c) => c.platform === "meta")!;
    expect(meta.months).toBe(4);
    // nov/26 já conta: faltam dez e jan
    expect(meta.readyOn).toBe("2027-01");
    expect(crit(r).historico).toBe(false);
    // parou de investir há meses: sem previsão
    const [s] = mmmReadiness([{ id: "s", name: "S" }], months("s", "meta", 3, { endsAgo: 5 }), [], today);
    expect(s.channels[0].readyOn).toBeNull();
    expect(s.channels[0].active).toBe(false);
  });

  it("resultado: só GA4, CRM ou planilha com 6 meses; a conversão da plataforma não entra", () => {
    const base = [...months("d", "meta", 8), ...months("d", "google", 8)];
    expect(crit(mmmReadiness([{ id: "d", name: "D" }], base, [], today)[0]).resultado).toBe(false);
    expect(crit(mmmReadiness([{ id: "d", name: "D" }], base, [ga4("d", 4)], today)[0]).resultado).toBe(false);
    const crm: OutcomeMonths = { projectId: "d", source: "crm", connected: true, months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"] };
    const r = mmmReadiness([{ id: "d", name: "D" }], base, [ga4("d", 4), crm], today)[0];
    expect(crit(r).resultado).toBe(true);
    expect(r.outcomes.find((o) => o.source === "ga4")).toMatchObject({ months: 4, connected: true });
  });

  it("verba sempre igual: o modelo não consegue medir o canal", () => {
    const [r] = mmmReadiness([{ id: "e", name: "E" }], [...months("e", "meta", 8), ...months("e", "google", 8, { flat: true })], [ga4("e", 8)], today);
    expect(r.channels.find((c) => c.platform === "google")!.variation).toBe("constante");
    expect(r.channels.find((c) => c.platform === "meta")!.variation).toBe("ok");
    expect(crit(r).variacao).toBe(false);
  });

  it("contas em dois workspaces: cada conta conta só no projeto dela (um bloco por cliente, sem somar)", () => {
    // a mesma conta do Google ligada nos workspaces X e Y: duas contas, cada uma no seu projeto
    const spend = [...months("px", "google", 26), ...months("px", "meta", 18), ...months("py", "google", 26)];
    const r = mmmReadiness([{ id: "px", name: "Cliente no workspace X" }, { id: "py", name: "Cliente no workspace Y" }], spend, [], today);
    expect(r).toHaveLength(2);
    expect(r[0].channels.map((c) => [c.platform, c.months])).toEqual([["google", 26], ["meta", 18]]);
    expect(r[1].channels.map((c) => [c.platform, c.months])).toEqual([["google", 26]]);
    expect(crit(r[1]).canais).toBe(false);
  });
});
