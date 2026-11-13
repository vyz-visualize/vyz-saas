import { describe, expect, it } from "vitest";
import { needsRefresh, oldestSync, REFRESH_AFTER_MS } from "./freshness";
import { isRateLimited, runPool, summarizeRuns } from "./throttle";

const err = (message: string, status?: number) => Object.assign(new Error(message), { status });

describe("isRateLimited", () => {
  it("reconhece os limites da Meta", () => {
    for (const code of [4, 17, 32, 613, 80000, 80004, 80014]) expect(isRateLimited(err(`Meta: insights: HTTP 400 type=OAuthException code=${code} fbtrace_id=Abc`, 400))).toBe(true);
  });
  it("não confunde outros códigos da Meta (nem o subcode)", () => {
    expect(isRateLimited(err("Meta: insights: HTTP 400 type=OAuthException code=100 error_subcode=17", 400))).toBe(false);
    expect(isRateLimited(err("Meta: insights: HTTP 400 code=190", 400))).toBe(false);
    expect(isRateLimited(err("Meta: insights: HTTP 400 code=80015", 400))).toBe(false);
    expect(isRateLimited(err("Meta: insights: HTTP 500 code=1", 500))).toBe(false);
  });
  it("reconhece o Google (429 e RESOURCE_EXHAUSTED)", () => {
    expect(isRateLimited(err("Google Ads: busca: HTTP 429 status=RESOURCE_EXHAUSTED", 429))).toBe(true);
    expect(isRateLimited(err("GA4: relatório: HTTP 403 status=RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isRateLimited(err("Google Ads: busca: HTTP 400 quotaError=RESOURCE_TEMPORARILY_EXHAUSTED"))).toBe(true);
    expect(isRateLimited(err("Google Ads: busca: HTTP 401 status=UNAUTHENTICATED", 401))).toBe(false);
  });
  it("aguenta erro sem formato", () => {
    expect(isRateLimited(null)).toBe(false);
    expect(isRateLimited("x")).toBe(false);
  });
});

describe("runPool", () => {
  it("roda no máximo N ao mesmo tempo, na ordem da fila", async () => {
    let running = 0;
    let peak = 0;
    const started: number[] = [];
    const out = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      started.push(n);
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5 + (n % 3) * 3));
      running--;
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(started).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(out.map((o) => o.result).sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });
  it("plataforma em pausa: as contas dela ficam de fora da rodada", async () => {
    const paused = new Set<string>();
    const queue = [
      { id: "a", p: "meta" },
      { id: "b", p: "meta" },
      { id: "c", p: "google" },
      { id: "d", p: "meta" },
    ];
    const out = await runPool(
      queue,
      1,
      async (x) => {
        if (x.id === "a") paused.add("meta");
        return x.id;
      },
      (x) => !paused.has(x.p),
    );
    expect(out.map((o) => o.result)).toEqual(["a", "c"]);
  });
  it("fila vazia", async () => {
    expect(await runPool([], 3, async () => 1)).toEqual([]);
  });
});

describe("summarizeRuns", () => {
  it("separa sincronizadas, falhas, já rodando, limite e pendentes", () => {
    const s = summarizeRuns(
      6,
      [
        { adAccountId: "1", ok: true, rowsWritten: 10 },
        { adAccountId: "2", ok: false, rowsWritten: 0, code: "sync:failed" },
        { adAccountId: "3", ok: false, rowsWritten: 0, code: "sync:running" },
        { adAccountId: "4", ok: false, rowsWritten: 0, code: "sync:rate_limited" },
      ],
      1000,
    );
    expect(s).toMatchObject({ ok: false, due: 6, synced: 1, failed: 1, skipped: 1, rateLimited: 1, pending: 2 });
  });
  it("limite de taxa não conta como falha", () => {
    expect(summarizeRuns(1, [{ adAccountId: "1", ok: false, rowsWritten: 0, code: "sync:rate_limited" }], 1).ok).toBe(true);
  });
});

describe("frescor", () => {
  const now = Date.parse("2026-11-13T15:00:00Z");
  it("mais de 6 h pede atualização; nunca sincronizada não", () => {
    expect(needsRefresh(new Date(now - REFRESH_AFTER_MS - 1000).toISOString(), now)).toBe(true);
    expect(needsRefresh(new Date(now - REFRESH_AFTER_MS + 60_000).toISOString(), now)).toBe(false);
    expect(needsRefresh(null, now)).toBe(false);
    expect(needsRefresh("lixo", now)).toBe(false);
  });
  it("vale a mais antiga das contas", () => {
    expect(oldestSync(["2026-11-13T10:00:00Z", null, "2026-11-12T22:00:00Z"])).toBe("2026-11-12T22:00:00Z");
    expect(oldestSync([null, undefined])).toBeNull();
  });
});
