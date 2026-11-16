// Redis (Upstash): sem as variáveis ou com ele fora do ar, tudo segue igual. Com ele, a pausa
// por limite é compartilhada e as respostas ficam alguns minutos em cache.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { cached, countGoogleAdsOp, metaAccountFromUrl, metaUsagePause, pauseAfterRateLimit, pauseCalls, requestHash, safe, secondsToUtcMidnight, setRedisForTests, sharedPauses } = await import("./redis");

/** Um Redis de mentira em memória, com o mínimo que o módulo usa. */
function fakeRedis(opts: { slowMs?: number; broken?: boolean } = {}) {
  const store = new Map<string, unknown>();
  const wait = async () => {
    if (opts.broken) throw new Error("fora do ar");
    if (opts.slowMs) await new Promise((r) => setTimeout(r, opts.slowMs));
  };
  const r = {
    store,
    get: vi.fn(async (k: string) => (await wait(), store.has(k) ? store.get(k) : null)),
    set: vi.fn(async (k: string, v: unknown) => (await wait(), store.set(k, v), "OK")),
    mget: vi.fn(async (...ks: string[]) => (await wait(), ks.map((k) => (store.has(k) ? store.get(k) : null)))),
    incr: vi.fn(async (k: string) => {
      await wait();
      const n = Number(store.get(k) ?? 0) + 1;
      store.set(k, n);
      return n;
    }),
    expire: vi.fn(async () => (await wait(), 1)),
  };
  setRedisForTests(r as never);
  return r;
}

const headers = (h: Record<string, unknown>) => new Headers(Object.fromEntries(Object.entries(h).map(([k, v]) => [k, JSON.stringify(v)])));

describe("sem Redis", () => {
  afterEach(() => setRedisForTests(undefined));

  it("sem as variáveis, nada muda: cache só chama a fonte e ninguém fica em pausa", async () => {
    setRedisForTests(null);
    const load = vi.fn(async () => ({ data: [1] }));
    expect(await cached("k", 60, load)).toEqual({ data: [1] });
    expect(await cached("k", 60, load)).toEqual({ data: [1] });
    expect(load).toHaveBeenCalledTimes(2);
    const isPaused = await sharedPauses([{ platform_id: "meta", external_id: "act_1" }]);
    expect(isPaused({ platform_id: "meta", external_id: "act_1" })).toBe(false);
    expect(await countGoogleAdsOp()).toBeNull();
  });

  it("Redis fora do ar ou lento: devolve o padrão e segue", async () => {
    fakeRedis({ broken: true });
    expect(await safe((r) => r.get("x"), "padrão")).toBe("padrão");
    const load = vi.fn(async () => "da API");
    expect(await cached("k", 60, load)).toBe("da API");
    fakeRedis({ slowMs: 2_000 });
    const t = Date.now();
    expect(await safe((r) => r.get("x"), "padrão")).toBe("padrão");
    expect(Date.now() - t).toBeLessThan(1_000);
  });
});

describe("com Redis", () => {
  afterEach(() => setRedisForTests(undefined));

  it("cache curto: a segunda leitura não chama a API; resposta grande não entra", async () => {
    const r = fakeRedis();
    const load = vi.fn(async () => ({ rows: [1, 2, 3] }));
    expect(await cached("a", 600, load)).toEqual({ rows: [1, 2, 3] });
    expect(await cached("a", 600, load)).toEqual({ rows: [1, 2, 3] });
    expect(load).toHaveBeenCalledTimes(1);
    expect(r.set).toHaveBeenCalledWith("vyz:cache:a", { rows: [1, 2, 3] }, { ex: 600 });
    const big = vi.fn(async () => "x".repeat(200_000));
    await cached("b", 600, big);
    await cached("b", 600, big);
    expect(big).toHaveBeenCalledTimes(2);
  });

  it("a chave do cache nunca leva o token em claro, e tokens diferentes não dividem resposta", () => {
    const a = requestHash(["GET", "https://graph.facebook.com/v26.0/act_1/insights?access_token=SEGREDO-A"]);
    const b = requestHash(["GET", "https://graph.facebook.com/v26.0/act_1/insights?access_token=SEGREDO-B"]);
    expect(a).not.toContain("SEGREDO");
    expect(a).not.toBe(b);
  });

  it("pausa compartilhada: plataforma inteira (Meta vale para Instagram e Página) e conta da Meta", async () => {
    fakeRedis();
    await pauseCalls("meta", 300, "act_2");
    let isPaused = await sharedPauses([
      { platform_id: "meta", external_id: "act_1" },
      { platform_id: "meta", external_id: "2" },
    ]);
    expect(isPaused({ platform_id: "meta", external_id: "act_1" })).toBe(false);
    expect(isPaused({ platform_id: "meta", external_id: "2" })).toBe(true);
    await pauseAfterRateLimit("instagram");
    isPaused = await sharedPauses([{ platform_id: "facebook" }, { platform_id: "google" }, { platform_id: "ga4" }]);
    expect(isPaused({ platform_id: "facebook" })).toBe(true);
    expect(isPaused({ platform_id: "google" })).toBe(false);
    expect(isPaused({ platform_id: "ga4" })).toBe(false);
  });

  it("conta as operações do Google Ads no dia, com validade", async () => {
    const r = fakeRedis();
    expect(await countGoogleAdsOp()).toBe(1);
    expect(await countGoogleAdsOp()).toBe(2);
    expect(r.expire).toHaveBeenCalledTimes(1);
  });
});

describe("cabeçalhos de uso da Meta", () => {
  it("passou de 75% da cota de relatórios: pausa a conta; do app: a Meta inteira", () => {
    expect(metaUsagePause(headers({ "x-fb-ads-insights-throttle": { app_id_util_pct: 10, acc_id_util_pct: 80 } }))).toEqual({ pausePlatformSeconds: 0, pauseAccountSeconds: 300 });
    expect(metaUsagePause(headers({ "x-fb-ads-insights-throttle": { app_id_util_pct: 90, acc_id_util_pct: 5 } }))).toEqual({ pausePlatformSeconds: 300, pauseAccountSeconds: 0 });
    expect(metaUsagePause(headers({ "x-app-usage": { call_count: 76, total_cputime: 1, total_time: 1 } })).pausePlatformSeconds).toBe(300);
  });

  it("caso de uso de negócio: respeita o tempo que a Meta diz para a cota voltar", () => {
    const h = headers({ "x-business-use-case-usage": { "123": [{ type: "ads_insights", call_count: 30, estimated_time_to_regain_access: 12 }] } });
    expect(metaUsagePause(h)).toEqual({ pausePlatformSeconds: 0, pauseAccountSeconds: 720 });
  });

  it("sem cabeçalho, ou com lixo: não pausa", () => {
    expect(metaUsagePause(new Headers())).toEqual({ pausePlatformSeconds: 0, pauseAccountSeconds: 0 });
    expect(metaUsagePause(new Headers({ "x-app-usage": "{quebrado" }))).toEqual({ pausePlatformSeconds: 0, pauseAccountSeconds: 0 });
  });

  it("a conta na URL e a meia-noite UTC", () => {
    expect(metaAccountFromUrl("https://graph.facebook.com/v26.0/act_123/insights?x=1")).toBe("act_123");
    expect(metaAccountFromUrl("https://graph.facebook.com/v26.0/me/adaccounts")).toBeNull();
    expect(secondsToUtcMidnight(new Date("2026-11-16T23:00:00Z"))).toBe(3600);
  });
});
