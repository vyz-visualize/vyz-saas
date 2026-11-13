import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { launchCode, launchTemplateCsv } from "@/features/import/launch-sheet";
import { readLaunchLink } from "./launch";
import { forgetSheetsTokens, readSheetValues, sheetsAccessToken, sheetsServiceAccount, type SheetsAccount } from "./sheets-service";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_ab";
const LINK = `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=7`;
const WORKSPACE = "7b1c2d3e-0000-4000-8000-000000000001";
const CODE = launchCode(WORKSPACE);
const TODAY = "2026-11-13";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const ACCOUNT: SheetsAccount = { client_email: "planilhas@vyz-teste.iam.gserviceaccount.com", private_key: privateKey };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const csv = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
const serial = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

type Handler = (url: string, init: RequestInit) => Response;
/** Google de mentira: token, metadados da planilha, valores e a exportação em CSV. */
function google(opts: { meta?: Handler; values?: Handler; export?: Handler } = {}) {
  const calls: string[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push(url);
    if (url === "https://oauth2.googleapis.com/token") return json({ access_token: "token-de-teste", expires_in: 3600 });
    if (url.startsWith("https://sheets.googleapis.com/")) {
      if (url.includes("/values/")) return (opts.values ?? (() => json({ values: [] })))(url, init);
      return (opts.meta ?? (() => json({ sheets: [{ properties: { sheetId: 7, title: "Funil 'novo'" } }] })))(url, init);
    }
    return (opts.export ?? (() => new Response(null, { status: 307, headers: { location: "https://accounts.google.com/ServiceLogin" } })))(url, init);
  };
  return { fetcher, calls };
}

const TABLE = (header: unknown[]) => [header, [serial("2026-11-03"), "Meta Ads", 42, 25, 6, 2, 1, 684000], [serial("2026-11-04"), "Google Ads", 18, 12, 4, 1, 0, 0]];
const HEADER = ["data", "origem", "leads", "atendimentos", "visitas", "propostas", "vendas", "valor vendido"];

beforeEach(() => forgetSheetsTokens());

describe("conta de serviço das planilhas", () => {
  it("lê o JSON cru ou em base64; sem variável ou com JSON inválido, fica desligada", () => {
    const raw = JSON.stringify({ client_email: ACCOUNT.client_email, private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n" });
    expect(sheetsServiceAccount(raw)).toEqual({ client_email: ACCOUNT.client_email, private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" });
    expect(sheetsServiceAccount(Buffer.from(raw).toString("base64"))?.client_email).toBe(ACCOUNT.client_email);
    for (const bad of [undefined, "", "  ", "{", JSON.stringify({ client_email: "x" }), JSON.stringify({ client_email: "sem-arroba", private_key: "k" })]) expect(sheetsServiceAccount(bad)).toBeNull();
  });

  it("pede o token só de leitura de planilhas e guarda até perto de vencer", async () => {
    const seen: { url: string; body: string }[] = [];
    const fetcher = async (url: string, init: RequestInit) => {
      seen.push({ url, body: String(init.body) });
      return json({ access_token: "t1", expires_in: 3600 });
    };
    expect(await sheetsAccessToken(ACCOUNT, fetcher, 1_000_000)).toBe("t1");
    expect(await sheetsAccessToken(ACCOUNT, fetcher, 1_000_000 + 30 * 60_000)).toBe("t1");
    expect(seen).toHaveLength(1);
    const assertion = new URLSearchParams(seen[0].body).get("assertion")!;
    const claims = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"));
    expect(claims).toMatchObject({ iss: ACCOUNT.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token" });
    // perto de vencer, renova
    await sheetsAccessToken(ACCOUNT, fetcher, 1_000_000 + 3600_000);
    expect(seen).toHaveLength(2);
  });

  it("token recusado: erro sem nada da resposta nem da chave", async () => {
    const fetcher = async () => json({ error: "invalid_grant", error_description: "segredo-que-nao-pode-vazar" }, 400);
    const err = await sheetsAccessToken(ACCOUNT, fetcher).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("conta de serviço das planilhas recusada (HTTP 400)");
  });

  it("acha a aba pelo gid e pede só o intervalo dela, com o nome entre aspas", async () => {
    const g = google({ values: () => json({ values: TABLE(HEADER) }) });
    const r = await readSheetValues({ spreadsheetId: ID, gid: "7" }, { account: ACCOUNT, fetcher: g.fetcher });
    expect(r).toMatchObject({ status: "ok", title: "Funil 'novo'" });
    const values = decodeURIComponent(g.calls.find((u) => u.includes("/values/"))!);
    expect(values).toContain(`/spreadsheets/${ID}/values/'Funil ''novo'''!A1:AZ20002?`);
    expect(values).toContain("valueRenderOption=UNFORMATTED_VALUE");
    expect(g.calls.every((u) => u.startsWith("https://oauth2.googleapis.com/") || u.startsWith("https://sheets.googleapis.com/"))).toBe(true);
  });

  it("planilha não compartilhada, aba que não existe e id malformado voltam como estado", async () => {
    expect(await readSheetValues({ spreadsheetId: ID, gid: "7" }, { account: ACCOUNT, fetcher: google({ meta: () => json({}, 403) }).fetcher })).toEqual({ status: "denied" });
    expect(await readSheetValues({ spreadsheetId: ID, gid: "7" }, { account: ACCOUNT, fetcher: google({ meta: () => json({}, 404) }).fetcher })).toEqual({ status: "not_found" });
    expect(await readSheetValues({ spreadsheetId: ID, gid: "99" }, { account: ACCOUNT, fetcher: google().fetcher })).toEqual({ status: "not_found" });
    const g = google();
    expect(await readSheetValues({ spreadsheetId: "../../outro", gid: "7" }, { account: ACCOUNT, fetcher: g.fetcher })).toEqual({ status: "not_found" });
    expect(g.calls).toHaveLength(0);
  });
});

describe("planilha do lançamento pelo link", () => {
  it("planilha fechada, compartilhada com a conta de serviço e com o código: lê", async () => {
    const g = google({ values: () => json({ values: TABLE([...HEADER, CODE]) }) });
    const r = await readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher: g.fetcher });
    expect(r).toMatchObject({ via: "service", spreadsheetId: ID, gid: "7" });
    expect(r.summary).toMatchObject({ leads: 60, visits: 10, sales: 1, value: 684000, from: "2026-11-03", to: "2026-11-04" });
    // não tentou o link aberto
    expect(g.calls.some((u) => u.includes("/export?"))).toBe(false);
  });

  it("sem o código deste workspace no cabeçalho, a conta de serviço não entrega a planilha", async () => {
    for (const header of [HEADER, [...HEADER, launchCode("outro-workspace")]]) {
      const g = google({ values: () => json({ values: TABLE(header) }) });
      await expect(readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher: g.fetcher })).rejects.toMatchObject({ code: "import:code", message: expect.stringContaining(CODE) });
      expect(g.calls.some((u) => u.includes("/export?"))).toBe(false);
    }
  });

  it("não compartilhada com a conta de serviço, mas aberta por link: lê pelo link (sem pedir código)", async () => {
    const g = google({ meta: () => json({}, 403), export: () => csv(launchTemplateCsv()) });
    const r = await readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher: g.fetcher });
    expect(r.via).toBe("link");
    expect(r.summary.leads).toBe(97);
  });

  it("fechada para todos: pede para compartilhar com o e-mail da conta de serviço", async () => {
    const g = google({ meta: () => json({}, 403) });
    await expect(readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher: g.fetcher })).rejects.toMatchObject({ code: "import:not_shared", message: expect.stringContaining(ACCOUNT.client_email) });
  });

  it("sem conta de serviço configurada: só o link aberto, com o aviso de sempre", async () => {
    const open = google({ export: () => csv(launchTemplateCsv()) });
    const r = await readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: null, fetcher: open.fetcher });
    expect(r.via).toBe("link");
    expect(open.calls.some((u) => u.includes("googleapis.com"))).toBe(false);
    const closed = google();
    await expect(readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: null, fetcher: closed.fetcher })).rejects.toMatchObject({ code: "import:not_shared", message: expect.stringContaining("Qualquer pessoa com o link") });
  });

  it("falha da conta de serviço (token recusado) não derruba: segue pelo link aberto", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = async (url: string) => (url === "https://oauth2.googleapis.com/token" ? json({ error: "invalid_grant" }, 400) : csv(launchTemplateCsv()));
    const r = await readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher });
    expect(r.via).toBe("link");
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE KEY");
    log.mockRestore();
  });

  it("linha inválida recusa a planilha, com a linha; link que não é do Google Sheets nem é buscado", async () => {
    const g = google({ values: () => json({ values: [[...HEADER, CODE], ["03/13/2026", "Meta Ads", 4]] }) });
    await expect(readLaunchLink(LINK, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher: g.fetcher })).rejects.toMatchObject({ code: "import:invalid", message: expect.stringContaining("Linha 2") });
    const none = google();
    await expect(readLaunchLink("https://evil.example/spreadsheets/d/" + ID, { workspaceId: WORKSPACE, today: TODAY, account: ACCOUNT, fetcher: none.fetcher })).rejects.toMatchObject({ code: "import:link" });
    expect(none.calls).toHaveLength(0);
  });
});
