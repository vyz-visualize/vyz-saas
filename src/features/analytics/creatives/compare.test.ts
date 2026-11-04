import { describe, expect, it } from "vitest";
import { creativeAnalysis } from "@/features/agent/engine/creative-analysis";
import { pct } from "@/lib/format";
import type { CompareAd } from "../types";
import { adStats, bestOf, BLOCK_DAYS, compareTable, deliveryDays, diffLabel, diffVsBest, evolution, formatMetric, metricById, metricValue, COMPARE_METRICS, objectiveHighlights, objectivesDiffer, objectiveWarning, sumsOf } from "./compare";
import { objectiveKey, objectiveResult } from "./objectives";

type Day = CompareAd["days"][number];
const day = (n: number, over: Partial<Day> = {}): Day => ({
  date: `2026-10-${String(n).padStart(2, "0")}`,
  spend: 100,
  impressions: 1000,
  reach: 800,
  clicks: 50,
  linkClicks: 20,
  conversions: 2,
  conversionValue: 400,
  videoViews: null,
  videoThruplays: null,
  ...over,
});
const ad = (id: string, days: Day[], objective = "OUTCOME_SALES", over: Partial<CompareAd> = {}): CompareAd => ({ id, name: `Anúncio ${id}`, campaignName: "Campanha", objective, format: "image", status: "active", headline: null, thumbnailUrl: null, postUrl: null, days, ...over });
const range = (from: number, to: number, over: Partial<Day> = {}) => Array.from({ length: to - from + 1 }, (_, i) => day(from + i, over));
const m = (id: string) => metricById(id)!;

describe("normalização por dia", () => {
  const sums = sumsOf(range(1, 10));

  it("divide o que se soma pelos dias de veiculação", () => {
    expect(metricValue(m("spend"), sums, "total")).toBe(1000);
    expect(metricValue(m("spend"), sums, "day")).toBe(100);
    expect(metricValue(m("impressions"), sums, "day")).toBe(1000);
  });

  it("taxas e custos são iguais nos dois modos", () => {
    for (const id of ["ctr", "linkCtr", "cpm", "cpc", "cpa", "roas", "frequency"]) {
      expect([id, metricValue(m(id), sums, "day")]).toEqual([id, metricValue(m(id), sums, "total")]);
    }
  });

  it("alcance é sempre média diária: somar dias não dá pessoas únicas", () => {
    expect(metricValue(m("reach"), sums, "total")).toBe(800);
    expect(metricValue(m("reach"), sums, "day")).toBe(800);
  });

  it("anúncios com períodos diferentes ficam comparáveis", () => {
    const longo = sumsOf(range(1, 20));
    const curto = sumsOf(range(1, 5));
    expect(metricValue(m("impressions"), longo, "total")).not.toBe(metricValue(m("impressions"), curto, "total"));
    expect(metricValue(m("impressions"), longo, "day")).toBe(metricValue(m("impressions"), curto, "day"));
  });

  it("dia sem impressão não conta como dia de veiculação", () => {
    const a = ad("a", [day(1), day(2, { impressions: 0, spend: 0, clicks: 0, linkClicks: 0, reach: 0, conversions: 0, conversionValue: 0 }), day(3)]);
    expect(deliveryDays(a)).toHaveLength(2);
    expect(adStats(a).activeDays).toBe(2);
    expect(metricValue(m("impressions"), adStats(a).sums, "day")).toBe(1000);
  });
});

describe("melhor valor", () => {
  it("maior é melhor", () => {
    expect(bestOf([10, 30, 20], "up")).toEqual({ best: 30, winners: [1] });
  });

  it("menor é melhor nas métricas de custo", () => {
    expect(bestOf([10, 30, 20], "down")).toEqual({ best: 10, winners: [0] });
    for (const id of ["cpm", "cpc", "cpcLink", "cpa", "cpl", "costPerThruplay", "costPerEngagement"]) expect([id, m(id).better]).toEqual([id, "down"]);
  });

  it("sem vencedor: todos iguais, um só com dado ou métrica sem direção", () => {
    expect(bestOf([5, 5], "up").winners).toEqual([]);
    expect(bestOf([5, null], "up").winners).toEqual([]);
    expect(bestOf([5, 9], null).winners).toEqual([]);
  });

  it("empate no topo marca os dois", () => {
    expect(bestOf([5, 5, 2], "up").winners).toEqual([0, 1]);
  });

  it("diferença relativa ao lado do perdedor", () => {
    expect(diffVsBest(62, 100)).toBeCloseTo(-0.38);
    expect(diffLabel(-0.38)).toBe("−38% vs melhor");
    expect(diffVsBest(30, 20)).toBeCloseTo(0.5);
    expect(diffLabel(0.5)).toBe("+50% vs melhor");
    expect(diffVsBest(100, 100)).toBeNull();
    expect(diffVsBest(10, 0)).toBeNull();
    expect(diffVsBest(null, 10)).toBeNull();
  });

  it("na tabela, o melhor não tem diferença e o perdedor tem", () => {
    const a = adStats(ad("a", range(1, 5, { spend: 100, conversions: 10 })));
    const b = adStats(ad("b", range(1, 5, { spend: 200, conversions: 10 })));
    const row = compareTable([a, b], "total")
      .flatMap((g) => g.rows)
      .find((r) => r.metric.id === "cpa")!;
    expect(row.cells[0].isBest).toBe(true);
    expect(row.cells[0].diff).toBeNull();
    expect(row.cells[1].isBest).toBe(false);
    expect(row.cells[1].diff).toBeCloseTo(1);
  });
});

describe("só mostra o que existe", () => {
  it("sem vídeo nem engajamento, os grupos somem", () => {
    const groups = compareTable([adStats(ad("a", range(1, 3))), adStats(ad("b", range(1, 3)))], "total").map((g) => g.group);
    expect(groups).toEqual(["delivery", "clicks"]);
  });

  it("com vídeo num só anúncio, o grupo aparece e o outro fica com traço", () => {
    const video = adStats(ad("v", range(1, 3, { videoViews: 300, videoThruplays: 60 })));
    const imagem = adStats(ad("i", range(1, 3)));
    const g = compareTable([video, imagem], "total").find((x) => x.group === "video")!;
    expect(g.rows.map((r) => r.metric.id)).toContain("thruplays");
    const r = g.rows.find((x) => x.metric.id === "thruplays")!;
    expect(r.cells[1].text).toBe("—");
    expect(r.cells[0].isBest).toBe(false);
  });
});

describe("objetivos diferentes", () => {
  const vendas = adStats(ad("a", range(1, 5)));
  const leads = adStats(ad("b", range(1, 5, { leads: 8 }), "OUTCOME_LEADS"));

  it("avisa quando os objetivos são diferentes", () => {
    expect(objectivesDiffer([vendas, leads])).toBe(true);
    const text = objectiveWarning([vendas, leads])!;
    expect(text).toContain("Vendas × Leads");
    expect(text).toContain("CPL, CTR, CPM e custo por resultado");
    expect(text).toContain("não para eleger um vencedor");
  });

  it("não avisa com o mesmo objetivo", () => {
    expect(objectivesDiffer([vendas, adStats(ad("c", range(1, 5)))])).toBe(false);
    expect(objectiveWarning([vendas, adStats(ad("c", range(1, 5)))])).toBeNull();
  });

  it("nomes diferentes do mesmo objetivo contam como iguais", () => {
    expect(objectiveKey("OUTCOME_SALES")).toBe(objectiveKey("CONVERSIONS"));
    expect(objectiveKey("XYZ")).toBe("other");
    expect(objectiveKey(null)).toBe("other");
  });

  it("destaque por objetivo usa a métrica-chave de cada um", () => {
    const h = objectiveHighlights([vendas, leads], "total");
    expect(h.map((x) => [x.objective, x.metric.id, x.alone])).toEqual([
      ["sales", "cpa", true],
      ["leads", "cpl", true],
    ]);
    const a = adStats(ad("a", range(1, 5, { spend: 100 })));
    const b = adStats(ad("b", range(1, 5, { spend: 300 })));
    expect(objectiveHighlights([a, b], "total")[0].winner).toBe(0);
  });

  it("resultado principal segue o objetivo", () => {
    const t = { conversions: 3, leads: 9, postEngagement: 40, linkClicks: 20, clicks: 50, impressions: 1000 };
    expect(objectiveResult("OUTCOME_SALES", t)).toEqual({ label: "compras", value: 3 });
    expect(objectiveResult("OUTCOME_LEADS", t)).toEqual({ label: "leads", value: 9 });
    expect(objectiveResult("OUTCOME_ENGAGEMENT", t)).toEqual({ label: "engajamentos", value: 40 });
    expect(objectiveResult("OUTCOME_TRAFFIC", t)).toEqual({ label: "cliques no link", value: 20 });
    expect(objectiveResult("OUTCOME_LEADS", { ...t, leads: null })).toEqual({ label: "compras", value: 3 });
  });
});

describe("evolução por dia de veiculação", () => {
  it("alinha pelo dia de veiculação, não pela data", () => {
    const a = ad("a", range(1, 3, { impressions: 100 }));
    const b = ad("b", range(20, 22, { impressions: 200 }));
    const e = evolution([a, b], m("impressions"));
    expect(e.labels).toEqual(["Dia 1", "Dia 2", "Dia 3"]);
    expect(e.series).toEqual([
      [100, 100, 100],
      [200, 200, 200],
    ]);
    expect(e.blocked).toBe(false);
  });

  it("anúncio mais curto termina antes", () => {
    const e = evolution([ad("a", range(1, 4)), ad("b", range(1, 2))], m("impressions"));
    expect(e.series[1]).toEqual([1000, 1000, null, null]);
  });

  it("até 30 dias, um ponto por dia", () => {
    expect(evolution([ad("a", range(1, 30))], m("ctr")).labels).toHaveLength(30);
  });

  it("acima de 30 dias, blocos de 5", () => {
    const days: Day[] = Array.from({ length: 33 }, (_, i) => day(1, { date: `2026-${i < 28 ? "09" : "10"}-${String(i < 28 ? i + 1 : i - 27).padStart(2, "0")}`, impressions: 100 + i }));
    const e = evolution([ad("a", days)], m("impressions"));
    expect(e.blocked).toBe(true);
    expect(e.labels[0]).toBe(`Dias 1–${BLOCK_DAYS}`);
    expect(e.labels).toHaveLength(7);
    expect(e.labels.at(-1)).toBe("Dias 31–33");
    // contagem: média por dia do bloco, inclusive no último, que é menor
    expect(e.series[0][0]).toBe(102);
    expect(e.series[0][6]).toBe(131);
  });

  it("taxa no bloco é soma ÷ soma, não média de médias", () => {
    const days = Array.from({ length: 31 }, (_, i) => day(1, { date: `2026-0${i < 15 ? 8 : 9}-${String((i % 15) + 1).padStart(2, "0")}${i >= 30 ? "" : ""}`.slice(0, 10), impressions: i === 0 ? 900 : 100, clicks: i === 0 ? 9 : 10 }));
    const unique = days.map((d, i) => ({ ...d, date: new Date(Date.UTC(2026, 7, i + 1)).toISOString().slice(0, 10) }));
    const e = evolution([ad("a", unique)], m("ctr"));
    expect(e.series[0][0]).toBeCloseTo((9 + 40) / (900 + 400));
  });
});

describe("investimento oculto", () => {
  const hidden = range(1, 5, { spend: null as never, videoViews: 100, videoThruplays: 20, postEngagement: 30 });

  it("nenhuma métrica derivada do investimento aparece", () => {
    const stats = [adStats(ad("a", hidden)), adStats(ad("b", hidden))];
    const ids = compareTable(stats, "total", { hideSpend: true }).flatMap((g) => g.rows.map((r) => r.metric.id));
    for (const metric of COMPARE_METRICS.filter((x) => x.spendDerived)) expect(ids).not.toContain(metric.id);
    expect(ids).toContain("linkCtr");
  });

  it("mesmo sem o aviso de oculto, sem o dado a linha não aparece", () => {
    const ids = compareTable([adStats(ad("a", hidden))], "total").flatMap((g) => g.rows.map((r) => r.metric.id));
    for (const id of ["spend", "cpm", "cpc", "cpa", "roas", "costPerThruplay", "costPerEngagement"]) expect(ids).not.toContain(id);
  });
});

describe("texto da análise", () => {
  /** Todo número que o texto pode citar, calculado à parte. */
  function allowed(stats: ReturnType<typeof adStats>[], currency = "BRL") {
    const set = new Set<string>();
    const addNumbers = (s: string) => {
      for (const n of s.match(/\d[\d.,]*\d|\d/g) ?? []) set.add(n);
    };
    for (const s of stats) {
      set.add(String(s.activeDays));
      for (const metric of COMPARE_METRICS) addNumbers(formatMetric(metric, metricValue(metric, s.sums, "total"), currency));
      if (s.fatigue) {
        addNumbers(pct(s.fatigue.frequencyChange, 0));
        addNumbers(pct(Math.abs(s.fatigue.ctrChange), 0));
      }
    }
    for (const a of stats) {
      for (const b of stats) {
        for (const metric of COMPARE_METRICS) {
          const x = metricValue(metric, a.sums, "total");
          const y = metricValue(metric, b.sums, "total");
          if (x != null && y) addNumbers(pct(Math.abs(x - y) / Math.abs(y), 0));
        }
      }
    }
    return set;
  }
  const numbersIn = (text: string, names: string[]) => {
    let clean = text;
    for (const n of names) clean = clean.split(n).join(" ");
    return clean.match(/\d[\d.,]*\d|\d/g) ?? [];
  };

  const cases: [string, CompareAd[]][] = [
    ["mesmo objetivo", [ad("a", range(1, 9, { spend: 120, impressions: 3000 })), ad("b", range(1, 6, { spend: 300, impressions: 2100, conversions: 1 }))]],
    ["objetivos diferentes", [ad("a", range(1, 8)), ad("b", range(1, 8, { leads: 12, postEngagement: 40 }), "OUTCOME_LEADS"), ad("c", range(1, 4, { postEngagement: 90 }), "OUTCOME_ENGAGEMENT")]],
    ["nome com número não conta", [ad("a", range(1, 5), "OUTCOME_SALES", { name: "VID · UGC provador 15s" }), ad("b", range(1, 7), "OUTCOME_SALES", { name: "IMG · 2 por R$ 299" })]],
  ];

  it.each(cases)("%s: nenhum número inventado", (_, ads) => {
    const stats = ads.map(adStats);
    const a = creativeAnalysis(stats);
    const ok = allowed(stats);
    for (const n of numbersIn(a.text, ads.map((x) => x.name))) expect([n, ok.has(n)]).toEqual([n, true]);
    expect(a.perAd).toHaveLength(ads.length);
    expect(a.comparison.length).toBeGreaterThan(10);
  });

  it("o teste pega número inventado", () => {
    const stats = cases[0][1].map(adStats);
    expect(allowed(stats).has("987654")).toBe(false);
  });

  it("métrica sem dado não entra no texto", () => {
    const text = creativeAnalysis([adStats(ad("a", range(1, 3))), adStats(ad("b", range(1, 3)))]).text;
    expect(text).not.toContain("hook rate");
    expect(text).not.toContain("leads");
  });

  it("objetivos diferentes: não elege vencedor", () => {
    const a = creativeAnalysis(cases[1][1].map(adStats));
    expect(a.comparison).toContain("não para eleger um vencedor");
    expect(a.comparison).not.toContain("o melhor");
  });

  it("investimento oculto: sem dinheiro no texto", () => {
    const hidden = (id: string) => ad(id, range(1, 5, { spend: null as never, conversionValue: 0 }));
    const a = creativeAnalysis([adStats(hidden("a")), adStats(hidden("b"))], { hideSpend: true });
    expect(a.text).not.toContain("R$");
    for (const term of ["investimento", "custo", "ROAS"]) expect(a.text).not.toContain(term);
  });

  it("cansaço entra no texto com os números da regra", () => {
    const first = range(1, 10, { impressions: 3000, reach: 2500, linkClicks: 90 });
    const second = range(11, 20, { impressions: 3000, reach: 1500, linkClicks: 30 });
    const stats = [adStats(ad("a", [...first, ...second])), adStats(ad("b", range(1, 20)))];
    expect(stats[0].fatigue).not.toBeNull();
    expect(creativeAnalysis(stats).perAd[0].text).toContain("sinal de cansaço");
  });
});
