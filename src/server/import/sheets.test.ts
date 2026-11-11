import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchSheetCsv, isSheetsHost } from "./sheets";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_ab";
const LINK = `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=5`;
const csv = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
const redirect = (to: string) => new Response(null, { status: 307, headers: { location: to } });

describe("fetchSheetCsv", () => {
  it("busca a exportação da aba e segue o redirecionamento do próprio Google", async () => {
    const calls: string[] = [];
    const r = await fetchSheetCsv(LINK, async (url) => {
      calls.push(url);
      return calls.length === 1 ? redirect("https://doc-0s-sheets.googleusercontent.com/export/abc?format=csv") : csv("data;campanha;investimento\n01/11/2026;A;1");
    });
    expect(calls).toEqual([`https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=5`, "https://doc-0s-sheets.googleusercontent.com/export/abc?format=csv"]);
    expect(r).toEqual({ text: "data;campanha;investimento\n01/11/2026;A;1", spreadsheetId: ID, gid: "5" });
  });

  it("planilha fechada (vai para o login) não é seguida e vira aviso de compartilhamento", async () => {
    const fetcher = vi.fn(async () => redirect("https://accounts.google.com/ServiceLogin?continue=x"));
    await expect(fetchSheetCsv(LINK, fetcher)).rejects.toMatchObject({ code: "import:not_shared" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("nunca segue para fora do Google, nem por http", async () => {
    for (const to of ["https://evil.example/x.csv", "http://docs.google.com/x", "https://169.254.169.254/latest/meta-data", "https://googleusercontent.com.evil.example/x"]) {
      const fetcher = vi.fn(async () => redirect(to));
      await expect(fetchSheetCsv(LINK, fetcher)).rejects.toMatchObject({ code: "import:not_shared" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("página que não é CSV (tela de login com 200) é recusada", async () => {
    await expect(fetchSheetCsv(LINK, async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }))).rejects.toMatchObject({ code: "import:not_shared" });
  });

  it("corta a leitura quando passa de 2 MB", async () => {
    await expect(fetchSheetCsv(LINK, async () => csv("a".repeat(2 * 1024 * 1024 + 10)))).rejects.toMatchObject({ code: "import:too_large" });
  });

  it("link que não é do Google Sheets nem chega a buscar", async () => {
    const fetcher = vi.fn();
    await expect(fetchSheetCsv("https://evil.example/spreadsheets/d/x", fetcher)).rejects.toMatchObject({ code: "import:link" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("hosts aceitos", () => {
    expect(isSheetsHost("docs.google.com")).toBe(true);
    expect(isSheetsHost("doc-08-sheets.googleusercontent.com")).toBe(true);
    expect(isSheetsHost("accounts.google.com")).toBe(false);
    expect(isSheetsHost("googleusercontent.com.evil.example")).toBe(false);
  });
});
