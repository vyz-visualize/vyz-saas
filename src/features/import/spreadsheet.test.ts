import { describe, expect, it } from "vitest";
import { campaignExternalId, detectDelimiter, IMPORT_MAX_ERRORS, IMPORT_TEMPLATE_CSV, mapHeader, parseCsv, parseDate, parseNumber, readSpreadsheet, sheetsCsvUrl, toDataset } from "./spreadsheet";

describe("parseCsv", () => {
  it("descobre o separador pela primeira linha", () => {
    expect(detectDelimiter("data;campanha;investimento\n1;2;3")).toBe(";");
    expect(detectDelimiter("data,campanha,investimento\n1,2,3")).toBe(",");
    expect(detectDelimiter("data\tcampanha\tinvestimento")).toBe("\t");
    // vírgula dentro de aspas não conta
    expect(detectDelimiter('"a,b,c";d;e')).toBe(";");
  });

  it("respeita aspas, aspas dobradas, BOM e quebra de linha do Windows", () => {
    expect(parseCsv('﻿data,campanha\r\n01/11/2026,"Marca, pesquisa"\r\n02/11/2026,"Diz ""oi"""\r\n')).toEqual([
      ["data", "campanha"],
      ["01/11/2026", "Marca, pesquisa"],
      ["02/11/2026", 'Diz "oi"'],
    ]);
  });

  it("ignora linhas em branco e tira espaços das pontas", () => {
    expect(parseCsv("a;b\n\n 1 ; 2 \n;\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseNumber", () => {
  it("lê o formato brasileiro e o americano", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("R$ 150,00")).toBe(150);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("162,5")).toBe(162.5);
    expect(parseNumber("1.5")).toBe(1.5);
    expect(parseNumber("1.234")).toBe(1234);
    expect(parseNumber("1,234,567")).toBe(1234567);
    expect(parseNumber("12")).toBe(12);
  });

  it("contagens não têm decimal: o separador é de milhar", () => {
    expect(parseNumber("12.000", { integer: true })).toBe(12000);
    expect(parseNumber("12,000", { integer: true })).toBe(12000);
    expect(parseNumber("1.234.567", { integer: true })).toBe(1234567);
    expect(parseNumber("340,00", { integer: true })).toBe(340);
    expect(parseNumber("340,5", { integer: true })).toBeNull();
  });

  it("vazio vale zero; texto e negativo são inválidos", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(" - ")).toBe(0);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("-5")).toBeNull();
    expect(parseNumber("1.2.3,4,5")).toBeNull();
  });
});

describe("parseDate", () => {
  it("aceita dd/mm/aaaa, dd/mm/aa e aaaa-mm-dd", () => {
    expect(parseDate("01/11/2026")).toBe("2026-11-01");
    expect(parseDate("1/3/26")).toBe("2026-03-01");
    expect(parseDate("31-12-2026")).toBe("2026-12-31");
    expect(parseDate("2026-11-09")).toBe("2026-11-09");
    expect(parseDate("2026-11-09T00:00:00")).toBe("2026-11-09");
  });

  it("recusa data que não existe", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("13/13/2026")).toBeNull();
    expect(parseDate("ontem")).toBeNull();
    expect(parseDate("01/01/1999")).toBeNull();
  });
});

describe("mapHeader", () => {
  it("reconhece nomes em português e inglês, com ou sem acento", () => {
    expect(mapHeader(["Data", "Nome da campanha", "Valor gasto", "Impressões", "Cliques", "Vendas", "Faturamento"])).toEqual({ date: 0, campaign: 1, spend: 2, impressions: 3, clicks: 4, conversions: 5, revenue: 6 });
    expect(mapHeader(["Day", "Campaign", "Cost", "Impressions", "Clicks", "Conversions", "Conversion value"])).toEqual({ date: 0, campaign: 1, spend: 2, impressions: 3, clicks: 4, conversions: 5, revenue: 6 });
  });
});

describe("readSpreadsheet", () => {
  it("lê o modelo que a tela oferece para baixar", () => {
    const r = readSpreadsheet(IMPORT_TEMPLATE_CSV);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { date: "2026-11-01", campaign: "Campanha de exemplo", spend: 150, impressions: 12000, clicks: 340, conversions: 12, revenue: 1890 },
      { date: "2026-11-02", campaign: "Campanha de exemplo", spend: 162.5, impressions: 13150, clicks: 371, conversions: 15, revenue: 2310.4 },
    ]);
    expect(r.summary).toMatchObject({ rows: 2, campaigns: 1, from: "2026-11-01", to: "2026-11-02", days: 2, spend: 312.5, impressions: 25150, clicks: 711, conversions: 27, revenue: 4200.4, missing: [], merged: 0 });
  });

  it("colunas opcionais ausentes entram zeradas e são avisadas", () => {
    const r = readSpreadsheet("data,campanha,custo\n2026-11-01,A,10.50\n2026-11-01,B,5");
    expect(r.ok && r.summary.missing).toEqual(["impressions", "clicks", "conversions", "revenue"]);
    expect(r.ok && r.rows[0]).toMatchObject({ spend: 10.5, impressions: 0, revenue: 0 });
  });

  it("soma linhas repetidas da mesma data e campanha (sem diferenciar maiúsculas)", () => {
    const r = readSpreadsheet("data;campanha;investimento;cliques\n01/11/2026;Marca;10,00;5\n01/11/2026;MARCA;2,50;1\n02/11/2026;Marca;1;0");
    expect(r.ok && r.rows).toEqual([
      { date: "2026-11-01", campaign: "Marca", spend: 12.5, impressions: 0, clicks: 6, conversions: 0, revenue: 0 },
      { date: "2026-11-02", campaign: "Marca", spend: 1, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
    ]);
    expect(r.ok && r.summary.merged).toBe(1);
  });

  it("aponta a coluna obrigatória que falta", () => {
    const r = readSpreadsheet("data;cliques\n01/11/2026;5");
    expect(r).toEqual({ ok: false, errors: [{ line: 1, message: 'Falta a coluna "campanha", "investimento" no cabeçalho.' }], more: 0 });
  });

  it("recusa o arquivo inteiro quando alguma linha é inválida, com o número da linha", () => {
    const r = readSpreadsheet("data;campanha;investimento;impressões;cliques\n32/11/2026;A;1;10;1\n01/11/2026;;1;10;1\n01/11/2026;A;x;10;1\n01/11/2026;A;1;10;20\n02/11/2026;A;1;10;1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(r.errors[0].message).toContain("Data");
    expect(r.errors[1].message).toContain("campanha");
    expect(r.errors[2].message).toContain("investimento");
    expect(r.errors[3].message).toContain("cliques");
  });

  it("barra data no futuro quando sabe que dia é hoje", () => {
    const csv = "data;campanha;investimento\n10/11/2026;A;1";
    expect(readSpreadsheet(csv, { today: "2026-11-10" }).ok).toBe(true);
    expect(readSpreadsheet(csv, { today: "2026-11-09" })).toMatchObject({ ok: false, errors: [{ line: 2 }] });
  });

  it("mostra só os primeiros erros e conta o resto", () => {
    const lines = Array.from({ length: IMPORT_MAX_ERRORS + 7 }, () => "xx;A;1").join("\n");
    const r = readSpreadsheet(`data;campanha;investimento\n${lines}`);
    expect(r).toMatchObject({ ok: false, more: 7 });
    expect(!r.ok && r.errors).toHaveLength(IMPORT_MAX_ERRORS);
  });

  it("planilha sem dados ou grande demais não entra", () => {
    expect(readSpreadsheet("data;campanha;investimento\n")).toMatchObject({ ok: false, errors: [{ line: 0 }] });
    expect(readSpreadsheet("a".repeat(2 * 1024 * 1024 + 1))).toMatchObject({ ok: false, errors: [{ line: 0 }] });
  });
});

describe("toDataset", () => {
  it("monta campanhas com id estável e os totais por dia", () => {
    const r = readSpreadsheet("data;campanha;investimento;impressões;cliques;conversões;receita\n02/11/2026;Marca;10;100;5;1;50\n01/11/2026;Marca;8;80;4;0;0\n02/11/2026;Remarketing · Site;4,5;40;2;1;30,25");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ds = toDataset(r.rows, { platform: "shopee", externalId: "loja-1" });
    expect(ds.range).toEqual({ from: "2026-11-01", to: "2026-11-02" });
    expect(ds.campaigns.map((c) => [c.externalId, c.name, c.startedOn])).toEqual([
      ["marca", "Marca", "2026-11-01"],
      ["remarketing-site", "Remarketing · Site", "2026-11-02"],
    ]);
    expect(ds.campaignDaily).toHaveLength(3);
    expect(ds.campaignDaily[0]).toMatchObject({ campaignExternalId: "marca", date: "2026-11-01", spend: 8, conversionValue: 0, reach: null });
    expect(ds.accountDaily.map((d) => [d.date, d.spend, d.impressions, d.clicks, d.conversions, d.conversionValue])).toEqual([
      ["2026-11-01", 8, 80, 4, 0, 0],
      ["2026-11-02", 14.5, 140, 7, 2, 80.25],
    ]);
  });

  it("nome longo de campanha cabe no limite do banco e não colide", () => {
    const a = campaignExternalId(`${"Campanha muito longa ".repeat(8)}A`);
    const b = campaignExternalId(`${"Campanha muito longa ".repeat(8)}B`);
    expect(a.length).toBeLessThanOrEqual(64);
    expect(a).not.toBe(b);
    expect(campaignExternalId("···")).toBe("campanha");
  });
});

describe("sheetsCsvUrl", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_ab";

  it("monta o endereço de exportação da aba aberta", () => {
    expect(sheetsCsvUrl(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=123456`)).toEqual({ ok: true, spreadsheetId: id, gid: "123456", csvUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=123456` });
    expect(sheetsCsvUrl(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=7&usp=sharing`)).toMatchObject({ ok: true, gid: "7" });
    expect(sheetsCsvUrl(` https://docs.google.com/spreadsheets/d/${id} `)).toMatchObject({ ok: true, gid: "0" });
  });

  it("só aceita planilhas do Google, por https", () => {
    for (const link of [
      "planilha",
      `http://docs.google.com/spreadsheets/d/${id}/edit`,
      `https://docs.google.com.evil.example/spreadsheets/d/${id}/edit`,
      `https://evil.example/spreadsheets/d/${id}/edit`,
      `https://user@docs.google.com/spreadsheets/d/${id}/edit`,
      `https://docs.google.com:8443/spreadsheets/d/${id}/edit`,
      "https://docs.google.com/document/d/abc/edit",
      "https://docs.google.com/spreadsheets/d/../../etc/passwd",
    ])
      expect(sheetsCsvUrl(link).ok).toBe(false);
  });
});
