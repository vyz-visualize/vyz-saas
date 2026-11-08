import { deflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { weeklyEmail } from "./email";
import { delta, moneyText, monthsOf, parseTable, type AdminReport } from "./types";

const { summarizeUsers } = await import("@/server/admin/users");
const { unzipFirst } = await import("@/server/admin/google");

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-09T12:00:00Z");
const at = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("summarizeUsers", () => {
  it("conta novos, ativos e retenção", () => {
    const users = [
      { created_at: at(1), last_sign_in_at: at(0) },
      { created_at: at(10), last_sign_in_at: at(9) },
      { created_at: at(20), last_sign_in_at: at(5) },
      { created_at: at(60), last_sign_in_at: null },
    ];
    const s = summarizeUsers(users, 2, NOW);
    expect([s.total, s.new7, s.newPrev7, s.new30, s.active7, s.active30, s.workspacesWithPlan]).toEqual([4, 1, 1, 3, 2, 3, 2]);
    expect(s.signupsByDay).toHaveLength(30);
    const c = s.cohorts.find((x) => x.size && x.returned);
    expect(c).toBeTruthy();
  });
});

describe("utilitários", () => {
  it("lê CSV com aspas e TSV", () => {
    expect(parseTable('a,b\n"x, y",2\n', ",")).toEqual([{ a: "x, y", b: "2" }]);
    expect(parseTable("a\tb\n1\t2", "\t")).toEqual([{ a: "1", b: "2" }]);
  });
  it("meses da duração", () => {
    expect(monthsOf("1 Year")).toBe(12);
    expect(monthsOf("1 Month")).toBe(1);
    expect(monthsOf("6 Months")).toBe(6);
  });
  it("dinheiro por moeda e variação", () => {
    expect(moneyText({ USD: 2, BRL: 10 })).toMatch(/^R\$\s?10,00 \+ US\$\s?2,00$/);
    expect(delta(10, 0)).toBeNull();
    expect(delta(15, 10)).toBe(50);
  });
  it("abre o zip do Play", () => {
    const data = Buffer.from("a,b\n1,2\n");
    const comp = deflateRawSync(data);
    const name = Buffer.from("x.csv");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(0, 42);
    const cdOffset = 30 + name.length + comp.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt32LE(cdOffset, 16);
    expect(unzipFirst(Buffer.concat([local, name, comp, cd, name, eocd])).toString()).toBe("a,b\n1,2\n");
  });
});

describe("weeklyEmail", () => {
  it("monta assunto e mostra fonte indisponível sem quebrar", () => {
    const r: AdminReport = {
      generatedAt: at(0),
      users: { ok: true, data: summarizeUsers([{ created_at: at(1), last_sign_in_at: at(0) }], 0, NOW) },
      ga4: { ok: false, reason: "sem dados" },
      stripe: { ok: true, data: { mrr: { BRL: 59.9 }, subscribers: 1, revenue30: { BRL: 59.9 }, churned30: 0, churnRate: 0, refunds30: {}, refundCount30: 0 } },
      appStore: { ok: false, reason: "A Apple <ainda> não gerou" },
      googlePlay: { ok: false, reason: "403" },
      revenueCat: { ok: false, reason: "x" },
    };
    const m = weeklyEmail(r);
    expect(m.subject).toContain("1 cadastros");
    expect(m.html).toContain("&lt;ainda&gt;");
    expect(m.html).toMatch(/R\$\s?59,90/);
  });
});
