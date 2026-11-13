import { describe, expect, it } from "vitest";
import { hasLaunchCode, LAUNCH_COLUMNS, launchCode, launchHeader, launchSummaryText, launchTemplateCsv, launchTemplateTsv, readLaunchSheet, readLaunchTable, serialDate } from "./launch-sheet";

const TODAY = "2026-11-13";
const CODE = launchCode("7b1c2d3e-0000-4000-8000-000000000001");

describe("modelo da planilha do lançamento", () => {
  it("o modelo que a pessoa copia é lido sem erro e traz o código do workspace", () => {
    for (const text of [launchTemplateTsv(CODE), launchTemplateCsv(CODE)]) {
      const r = readLaunchSheet(text, { today: TODAY });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.summary).toMatchObject({ rows: 3, from: "2026-11-03", to: "2026-11-04", days: 2, leads: 97, attended: 58, visits: 15, proposals: 5, sales: 1, value: 684000, missing: [], merged: 0 });
      expect(r.summary.origins).toEqual(["Google Ads", "Meta Ads"]);
      expect(hasLaunchCode(r.header, CODE)).toBe(true);
    }
  });

  it("só contagens: nenhuma coluna pede nome, telefone ou e-mail", () => {
    const names = LAUNCH_COLUMNS.flatMap((c) => [c.label, ...c.aliases]).join(" ");
    expect(names).not.toMatch(/nome|telefone|celular|whats|e-?mail|cpf/);
    expect(launchHeader()).toEqual(["data", "origem", "leads", "atendimentos", "visitas", "propostas", "vendas", "valor vendido"]);
  });

  it("o código é curto, estável e muda de um workspace para outro", () => {
    expect(CODE).toMatch(/^vyz-[0-9a-z]{8}$/);
    expect(launchCode("7b1c2d3e-0000-4000-8000-000000000001")).toBe(CODE);
    expect(launchCode("7b1c2d3e-0000-4000-8000-000000000002")).not.toBe(CODE);
    expect(hasLaunchCode(["data", "leads", ` ${CODE.toUpperCase()} `], CODE)).toBe(true);
    expect(hasLaunchCode(["data", "leads", "vyz-outrocod"], CODE)).toBe(false);
    expect(hasLaunchCode(["data", "leads"], "")).toBe(false);
  });
});

describe("leitura da planilha do lançamento", () => {
  it("só data e leads são obrigatórias; o que falta entra zerado e fica anotado", () => {
    const r = readLaunchSheet("Dia;Cadastros\n01/11/2026;12\n02/11/2026;8", { today: TODAY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { date: "2026-11-01", origin: "Sem origem", leads: 12, attended: 0, visits: 0, proposals: 0, sales: 0, value: 0 },
      { date: "2026-11-02", origin: "Sem origem", leads: 8, attended: 0, visits: 0, proposals: 0, sales: 0, value: 0 },
    ]);
    expect(r.summary.missing).toEqual(["origin", "attended", "visits", "proposals", "sales", "value"]);
  });

  it("sem a coluna de leads, recusa e diz qual falta", () => {
    const r = readLaunchSheet("data;visitas\n01/11/2026;3", { today: TODAY });
    expect(r).toMatchObject({ ok: false, errors: [{ line: 1, message: 'Falta a coluna "leads" no cabeçalho.' }] });
  });

  it("aceita as células coladas do Google Sheets (tabulação) e nomes de coluna parecidos", () => {
    const r = readLaunchSheet("Data\tCanal\tLeads\tQualificados\tVisitas agendadas\tPropostas enviadas\tContratos\tVGV\n03/11/2026\tPortal\t1.250\t700\t80\t22\t3\tR$ 2.136.000,00", { today: TODAY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toEqual({ date: "2026-11-03", origin: "Portal", leads: 1250, attended: 700, visits: 80, proposals: 22, sales: 3, value: 2136000 });
  });

  it("linhas com a mesma data e origem são somadas (maiúsculas e acentos não separam)", () => {
    const r = readLaunchSheet("data;origem;leads;vendas;valor vendido\n01/11/2026;Indicação;4;1;500.000,00\n01/11/2026;INDICACAO;6;0;0\n01/11/2026;Meta Ads;10;0;0", { today: TODAY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary).toMatchObject({ rows: 2, merged: 1, leads: 20, sales: 1, value: 500000 });
    expect(r.rows.find((x) => x.origin === "Indicação")).toMatchObject({ leads: 10, sales: 1 });
  });

  it("data no futuro, data inválida e número inválido recusam a planilha inteira, com a linha", () => {
    const r = readLaunchSheet("data;leads;visitas\n14/11/2026;5;1\n31/02/2026;5;1\n01/11/2026;cinco;1\n02/11/2026;5;1,5\n03/11/2026;-2;0", { today: TODAY });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => `${e.line}: ${e.message}`)).toEqual([
      "2: Data 14/11/2026 está no futuro.",
      '3: Data "31/02/2026" inválida. Use dd/mm/aaaa.',
      '4: Valor "cinco" inválido na coluna "leads".',
      '5: Valor "1,5" inválido na coluna "visitas".',
      '6: Valor "-2" inválido na coluna "leads".',
    ]);
  });

  it("planilha só com o cabeçalho é recusada", () => {
    expect(readLaunchSheet("data;leads\n", { today: TODAY })).toMatchObject({ ok: false, errors: [{ line: 0 }] });
  });

  it("resumo em uma frase, só com as etapas que a planilha traz", () => {
    const full = readLaunchSheet(launchTemplateTsv(), { today: TODAY });
    const lean = readLaunchSheet("data;leads\n01/11/2026;1", { today: TODAY });
    expect(full.ok && launchSummaryText(full.summary)).toBe("2 dias, de 03/11/2026 a 04/11/2026: 97 leads, 15 visitas, 1 venda.");
    expect(lean.ok && launchSummaryText(lean.summary)).toBe("1 dia, de 01/11/2026 a 01/11/2026: 1 lead.");
  });
});

describe("tabela vinda da Sheets API (valores crus)", () => {
  const serial = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

  it("data como número de série e números como números: não dependem do idioma da planilha", () => {
    const r = readLaunchTable(
      [
        ["data", "origem", "leads", "atendimentos", "visitas", "propostas", "vendas", "valor vendido", CODE],
        [serial("2026-11-03"), "Meta Ads", 42, 25, 6, 2, 1, 684000.5, null],
        [serial("2026-11-04") + 0.75, "Meta Ads", 37, 21, 5, 2, 0, 0],
        [null, "", "", null],
      ],
      { today: TODAY },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => x.date)).toEqual(["2026-11-03", "2026-11-04"]);
    expect(r.rows[0]).toMatchObject({ leads: 42, sales: 1, value: 684000.5 });
    expect(hasLaunchCode(r.header, CODE)).toBe(true);
  });

  it("valor com três casas vindo de fórmula não vira milhar; contagem quebrada é recusada", () => {
    const ok = readLaunchTable([["data", "leads", "valor vendido"], [serial("2026-11-03"), 3, 150.125]], { today: TODAY });
    expect(ok.ok && ok.rows[0].value).toBe(150.13);
    const bad = readLaunchTable([["data", "leads"], [serial("2026-11-03"), 2.5]], { today: TODAY });
    expect(bad).toMatchObject({ ok: false, errors: [{ line: 2, message: 'Valor "2.5" inválido na coluna "leads".' }] });
  });

  it("número de série fora de 2015 a 2100 não é data", () => {
    expect(serialDate(serial("2026-11-03"))).toBe("2026-11-03");
    expect(serialDate(42)).toBeNull();
    expect(serialDate(Number.NaN)).toBeNull();
    expect(serialDate(serial("2101-01-01"))).toBeNull();
  });
});
