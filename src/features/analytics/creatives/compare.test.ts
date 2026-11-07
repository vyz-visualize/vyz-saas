import { describe, expect, it } from "vitest";
import { compactCount, compactMoney, creativeAnalysis, perExposure, plainPct } from "@/features/agent/engine/creative-analysis";
import { decimal, pct } from "@/lib/format";
import { money } from "../format";
import type { CompareAd } from "../types";
import { adStats, axisFromZero, axisLabel, bestOf, BLOCK_DAYS, chartRange, defaultAds, compareTable, deliveryDays, diffLabel, diffVsBest, evolution, metricById, metricValue, COMPARE_METRICS, objectiveHighlights, objectivesDiffer, objectiveWarning, shortName, sumsOf } from "./compare";
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
    expect(objectiveResult("OUTCOME_ENGAGEMENT", t)).toEqual({ label: "interações", value: 40 });
    expect(objectiveResult("OUTCOME_TRAFFIC", t)).toEqual({ label: "cliques no link", value: 20 });
    // o resultado segue o objetivo: nunca compras numa campanha de leads
    // sem o dado: "—" na tela, nunca 0
    expect(objectiveResult("OUTCOME_LEADS", { ...t, leads: null })).toEqual({ label: "leads", value: null });
    expect(objectiveResult("OUTCOME_ENGAGEMENT", { ...t, postEngagement: null })).toEqual({ label: "interações", value: null });
    expect(objectiveResult("OUTRO", t)).toEqual({ label: "compras", value: 3 });
    expect(objectiveResult("OUTRO", { ...t, conversions: 0 })).toEqual({ label: "resultados", value: null });
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

describe("eixo do gráfico", () => {
  it("volumes começam em 0", () => {
    for (const id of ["spend", "impressions", "clicks", "linkClicks", "conversions", "value", "reach", "thruplays", "engagement"]) {
      expect([id, axisFromZero(m(id))]).toEqual([id, true]);
      expect(chartRange([500, 800], m(id)).min).toBe(0);
    }
  });

  it("taxas e custos se ajustam aos valores, com margem", () => {
    for (const id of ["ctr", "linkCtr", "cpm", "cpc", "cpcLink", "cpa", "cpl", "frequency", "roas", "costPerThruplay"]) expect([id, axisFromZero(m(id))]).toEqual([id, false]);
    const r = chartRange([0.012, 0.016], m("linkCtr"));
    expect(r.min).toBeGreaterThan(0);
    expect(r.min).toBeLessThan(0.012);
    expect(r.max).toBeGreaterThan(0.016);
  });

  it("nunca fica abaixo de 0, aceita valor único e ignora vazios", () => {
    expect(chartRange([0, 0.02], m("ctr")).min).toBe(0);
    const single = chartRange([2, null, 2], m("roas"));
    expect(single.min).toBeLessThan(2);
    expect(single.max).toBeGreaterThan(2);
    expect(chartRange([null], m("ctr"))).toEqual({ min: 0, max: 1 });
  });

  it("os rótulos não se repetem quando o eixo é estreito", () => {
    const labels = [1.1, 1.15, 1.2, 1.25].map((v) => axisLabel(m("frequency"), v, 0.05, "BRL"));
    expect(new Set(labels).size).toBe(4);
    const pcts = [0.012, 0.014, 0.016].map((v) => axisLabel(m("linkCtr"), v, 0.002, "BRL"));
    expect(new Set(pcts).size).toBe(3);
  });
});

describe("anúncios que já abrem escolhidos", () => {
  it("os 2 de maior investimento", () => {
    const pool = [ad("a", range(1, 2, { spend: 10 })), ad("b", range(1, 2, { spend: 90 })), ad("c", range(1, 2, { spend: 50 }))];
    expect(defaultAds(pool)).toEqual(["b", "c"]);
  });

  it("sem investimento à vista, os de mais impressões", () => {
    const pool = [ad("a", range(1, 2, { spend: null as never, impressions: 10 })), ad("b", range(1, 2, { spend: null as never, impressions: 90 })), ad("c", range(1, 2, { spend: null as never, impressions: 50 }))];
    expect(defaultAds(pool)).toEqual(["b", "c"]);
  });

  it("com menos de 2 anúncios, devolve o que tem", () => {
    expect(defaultAds([ad("a", range(1, 2))])).toEqual(["a"]);
    expect(defaultAds([])).toEqual([]);
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
  /** Constantes da explicação: "de cada 100", "de cada 1.000", "cada R$ 1", "primeiros 3 segundos". */
  const WORDING = ["100", "1.000", "1", "3"];

  /** Todo número que o texto pode citar, calculado à parte a partir dos dados. */
  function allowed(stats: ReturnType<typeof adStats>[]) {
    const set = new Set<string>(WORDING);
    const add = (s: string) => {
      for (const n of s.match(/\d[\d.,]*\d|\d/g) ?? []) set.add(n);
    };
    for (const s of stats) {
      set.add(String(s.activeDays));
      for (const metric of COMPARE_METRICS) {
        const v = metricValue(metric, s.sums, "total");
        if (v == null) continue;
        for (const text of [compactCount(v), compactMoney(v), money(v), plainPct(v), pct(v, 0), decimal(v, 1), decimal(v, 2)]) add(text);
        if (metric.format === "pct") {
          const per = perExposure(v);
          if (per) set.add(String(per.count));
        }
      }
      if (s.fatigue) {
        add(pct(s.fatigue.frequencyChange, 0));
        add(pct(Math.abs(s.fatigue.ctrChange), 0));
      }
    }
    return set;
  }
  /** Os números do texto que não saíram dos dados (nomes de anúncio não contam). */
  function invented(text: string, stats: ReturnType<typeof adStats>[]) {
    let clean = text;
    for (const s of stats) clean = clean.split(s.ad.name).join(" ").split(shortName(s.ad.name)).join(" ");
    const ok = allowed(stats);
    return (clean.match(/\d[\d.,]*\d|\d/g) ?? []).filter((n) => !ok.has(n));
  }

  const venda = (id: string, over: Partial<Day> = {}, days = 9) => ad(id, range(1, days, { spend: 120, impressions: 3000, reach: 2500, clicks: 90, linkClicks: 40, conversions: 3, conversionValue: 480, ...over }));
  const cases: [string, CompareAd[]][] = [
    ["mesmo objetivo", [venda("a"), venda("b", { spend: 300, impressions: 2100, conversions: 1, conversionValue: 100, linkClicks: 12 }, 6)]],
    ["números grandes", [venda("a", { spend: 2400, impressions: 120000, reach: 95000, clicks: 3400, linkClicks: 1800, conversions: 40, conversionValue: 9000 }, 30), venda("b", { spend: 900, impressions: 40000, reach: 30000 }, 30)]],
    ["com vídeo", [venda("a", { videoViews: 900, videoThruplays: 200 }), venda("b", { videoViews: 500, videoThruplays: 90 })]],
    ["objetivos diferentes", [venda("a"), ad("b", range(1, 8, { leads: 12, postEngagement: 40 }), "OUTCOME_LEADS"), ad("c", range(1, 4, { postEngagement: 90 }), "OUTCOME_ENGAGEMENT")]],
    ["só leads", [ad("a", range(1, 8, { leads: 12 }), "OUTCOME_LEADS"), ad("b", range(1, 8, { leads: 30, spend: 90 }), "OUTCOME_LEADS")]],
    ["só engajamento", [ad("a", range(1, 8, { postEngagement: 40 }), "OUTCOME_ENGAGEMENT"), ad("b", range(1, 8, { postEngagement: 70 }), "OUTCOME_ENGAGEMENT")]],
    ["tráfego", [ad("a", range(1, 5), "OUTCOME_TRAFFIC"), ad("b", range(1, 5, { spend: 40 }), "OUTCOME_TRAFFIC")]],
    ["nome com número não conta", [ad("a", range(1, 5), "OUTCOME_SALES", { name: "VID · UGC provador 15s" }), ad("b", range(1, 7), "OUTCOME_SALES", { name: "IMG · 2 por R$ 299" })]],
  ];

  it.each(cases)("%s: nenhum número inventado", (_, ads) => {
    const stats = ads.map(adStats);
    const a = creativeAnalysis(stats);
    expect(invented(a.text, stats)).toEqual([]);
    expect(a.perAd).toHaveLength(ads.length);
    expect(a.comparison.length).toBeGreaterThan(10);
  });

  it.each(cases)("%s: sem investimento oculto escapando e sem número inventado", (_, ads) => {
    const hidden = ads.map((x) => ({ ...x, days: x.days.map((d) => ({ ...d, spend: null as never })) })).map(adStats);
    const a = creativeAnalysis(hidden, { hideSpend: true });
    expect(invented(a.text, hidden)).toEqual([]);
    for (const term of ["investimento", "investido", "custou", "barato", "ROAS"]) expect([term, a.text.includes(term)]).toEqual([term, false]);
  });

  it("o teste pega número inventado", () => {
    const stats = cases[0][1].map(adStats);
    const a = creativeAnalysis(stats);
    expect(invented(`${a.text} Foi exibido 987,6 mil vezes.`, stats)).toEqual(["987,6"]);
  });

  describe("linguagem", () => {
    const [big] = [cases[1][1].map(adStats)];
    const text = creativeAnalysis(big).text;

    it("números grandes abreviados, sem o rótulo com dois-pontos", () => {
      expect(compactCount(331826)).toBe("331,8 mil");
      expect(compactCount(1250000)).toBe("1,3 milhão");
      expect(compactCount(2500000)).toBe("2,5 milhões");
      expect(compactCount(950)).toBe("950");
      expect(compactCount(156000)).toBe("156 mil");
      expect(compactMoney(6700)).toBe("R$ 6,7 mil");
      expect(compactMoney(94.5)).toBe("R$ 94,50");
      expect(text).toContain("foi exibido 3,6 milhões vezes".replace("3,6 milhões", compactCount(120000 * 30)));
      expect(text).not.toMatch(/impressões:/i);
      expect(text).not.toMatch(/\d{3}\.\d{3}/);
    });

    it("traduz cada métrica no que ela significa", () => {
      expect(text).toMatch(/alcançou em média .* pessoas por dia/);
      expect(text).toMatch(/de cada 100 vezes que apareceu, cerca de \d+ (virou|viraram) clique no link/);
      expect(text).toMatch(/cada compra custou em média R\$ [\d,.]+/);
      expect(text).toMatch(/ROAS\) foi de [\d,]+: cada R\$ 1 investido voltou R\$ [\d,]+ em vendas/);
    });

    it("alcance é por dia: nunca diz um total de pessoas", () => {
      expect(text).not.toMatch(/alcançou [\d,.]+ (mil )?pessoas\b(?! por dia)/);
    });

    it("sem jargão em inglês", () => {
      const video = creativeAnalysis(cases[2][1].map(adStats)).text;
      expect(video).not.toMatch(/hook|hold rate|thruplay/i);
      expect(video).toContain("taxa de retenção nos primeiros 3 segundos");
    });

    it("base de 1.000 quando a taxa é baixa", () => {
      expect(perExposure(0.0123)).toEqual({ base: 100, count: 1 });
      expect(perExposure(0.004)).toEqual({ base: 1000, count: 4 });
      expect(perExposure(0.0001)).toBeNull();
    });

    it("métrica sem dado não entra no texto", () => {
      const plain = creativeAnalysis([adStats(ad("a", range(1, 3))), adStats(ad("b", range(1, 3)))]).text;
      expect(plain).not.toContain("retenção");
      expect(plain).not.toContain("leads");
    });

    it("sem compras: diz que não houve, sem custo nem retorno", () => {
      const none = creativeAnalysis([adStats(ad("a", range(1, 3, { conversions: 0, conversionValue: 0 }))), adStats(ad("b", range(1, 3)))]).perAd[0].text;
      expect(none).toContain("Não registrou compras");
      expect(none).not.toContain("cada compra");
      expect(none).not.toContain("ROAS");
    });
  });

  describe("comparação", () => {
    const a = venda("a", { spend: 100, conversionValue: 900, linkClicks: 30, reach: 2000 });
    const b = venda("b", { spend: 200, conversionValue: 400, linkClicks: 60, reach: 2800 });
    const same = creativeAnalysis([adStats(a), adStats(b)]).comparison;

    it("cobre várias dimensões, com o vencedor certo em cada uma", () => {
      expect(same).toMatch(/“Anúncio b” alcançou mais pessoas/);
      expect(same).toMatch(/“Anúncio b” teve mais cliques proporcionalmente/);
      expect(same).toMatch(/“Anúncio a” vendeu mais barato/);
      expect(same).toMatch(/“Anúncio a” teve o melhor retorno/);
    });

    it("fecha com uma leitura geral baseada nos números, sem recomendar", () => {
      expect(same).toMatch(/Na leitura geral, “Anúncio a” entregou mais vendas por real investido\.$/);
      for (const c of cases) {
        const text = creativeAnalysis(c[1].map(adStats)).text;
        expect(text).not.toMatch(/recomend|deveria|sugiro|aument[ea]|paus[ea]|renove|invista/i);
      }
    });

    it("empate: não inventa destaque", () => {
      const tie = creativeAnalysis([adStats(ad("a", range(1, 5))), adStats(ad("b", range(1, 5)))]).comparison;
      expect(tie).toContain("nenhum anúncio se destacou");
    });

    it("cansaço é mencionado", () => {
      const first = range(1, 10, { impressions: 3000, reach: 2500, linkClicks: 90 });
      const second = range(11, 20, { impressions: 3000, reach: 1500, linkClicks: 30 });
      const stats = [adStats(ad("a", [...first, ...second])), adStats(ad("b", range(1, 20)))];
      expect(stats[0].fatigue).not.toBeNull();
      const r = creativeAnalysis(stats);
      expect(r.perAd[0].text).toContain("sinal de cansaço");
      expect(r.comparison).toContain("“Anúncio a” mostra sinal de cansaço");
      expect(invented(r.text, stats)).toEqual([]);
    });

    it("objetivos diferentes: só a métrica principal de cada um e o aviso", () => {
      const r = creativeAnalysis(cases[3][1].map(adStats));
      expect(r.comparison).toContain("em Vendas, custo por compra de");
      expect(r.comparison).toContain("em Leads, custo por lead de");
      expect(r.comparison).toContain("não para eleger um vencedor");
      expect(r.comparison.match(/não para eleger/g)).toHaveLength(1);
      for (const term of ["alcançou mais", "cliques proporcionalmente", "melhor retorno", "leitura geral"]) expect(r.comparison).not.toContain(term);
    });
  });
});

describe("nomes em português", () => {
  it("Hold rate vira Retenção até o fim, com a explicação no ⓘ", () => {
    const m = metricById("holdRate")!;
    expect(m.label).toBe("Retenção até o fim");
    expect(m.help).toMatch(/3 segundos.*até o fim/);
    expect(COMPARE_METRICS.map((x) => x.label).join(" ")).not.toMatch(/hold rate/i);
  });
});
