import { describe, expect, it } from "vitest";
import { sampleRows } from "@/features/analytics/preview";
import { datasetFromWarehouse } from "./warehouse-dataset";

describe("dados reais em qualquer modelo", () => {
  const today = "2026-11-12";
  const meta = sampleRows("meta", { period: "30d", today });
  const google = sampleRows("google", { period: "30d", today });

  it("soma as plataformas por dia, em centavos, do mais antigo ao mais novo", () => {
    const ds = datasetFromWarehouse([meta, google], { profile: "ecommerce", today });
    expect(ds.current).toHaveLength(meta.current.days);
    expect(ds.current[0].ago).toBeGreaterThan(ds.current.at(-1)!.ago);
    const reais = [...meta.accountDaily, ...google.accountDaily].filter((r) => r.date >= meta.current.from && r.date <= meta.current.to).reduce((a, r) => a + r.spend, 0);
    const total = ds.current.reduce((a, d) => a + d.spend, 0);
    expect(Math.abs(total - Math.round(reais * 100))).toBeLessThanOrEqual(ds.current.length);
    expect(ds.adPlatforms).toEqual(["meta", "google"]);
    const day = ds.current.find((d) => d.spend > 0)!;
    expect((day.byPlatform.meta?.spend ?? 0) + (day.byPlatform.google?.spend ?? 0)).toBe(day.spend);
  });

  it("campanhas do período, ordenadas por investimento, com a plataforma", () => {
    const ds = datasetFromWarehouse([google], { profile: "pesquisa", today });
    expect(ds.campaigns.length).toBeGreaterThan(0);
    expect(ds.campaigns.every((c) => c.platform === "google")).toBe(true);
    expect(ds.campaigns[0].spend).toBeGreaterThanOrEqual(ds.campaigns.at(-1)!.spend);
  });

  it("os 3 últimos dias ficam em maturação; meta, margem e verba vêm das configurações", () => {
    const ds = datasetFromWarehouse([meta], { profile: "ecommerce", today, goal: 5000, margin: 0.4, budget: 3_000_000 });
    expect(ds.current.filter((d) => d.maturing)).toHaveLength(3);
    expect(ds.goal).toBe(5000);
    expect(ds.breakEven).toBeCloseTo(2.5);
    expect(ds.budget.monthly).toBe(3_000_000);
    expect(ds.budget.daysInMonth).toBe(30);
    expect(ds.budget.day).toBe(12);
  });

  it("sem linhas, um painel vazio que não quebra", () => {
    const empty = { ...meta, accountDaily: [], campaignDaily: [], adDaily: [], breakdownDaily: [], productDaily: [] };
    const ds = datasetFromWarehouse([empty], { profile: "ecommerce", today });
    expect(ds.current.every((d) => d.spend === 0)).toBe(true);
    expect(ds.campaigns).toEqual([]);
    expect(ds.funnel).toEqual([]);
  });
});

describe("criativos com dados reais", () => {
  const today = "2026-11-12";
  const meta = sampleRows("meta", { period: "30d", today });

  it("levam a imagem do anúncio e o formato em português; a cor da amostra fica entre as 5", () => {
    const ads = meta.ads.map((a, i) => ({ ...a, format: i % 2 ? "video" : "image", thumbnailUrl: i === 0 ? null : `https://scontent.example.fbcdn.net/${a.id}.jpg` }));
    const ds = datasetFromWarehouse([{ ...meta, ads }], { profile: "ecommerce", today });
    expect(ds.creatives.length).toBeGreaterThan(1);
    expect(ds.creatives.every((c) => ["Imagem", "Vídeo"].includes(c.format))).toBe(true);
    expect(ds.creatives.every((c) => c.tone >= 0 && c.tone < 5)).toBe(true);
    const withImage = ds.creatives.filter((c) => c.imageUrl);
    expect(withImage.length).toBeGreaterThan(0);
    expect(withImage.every((c) => c.imageUrl === `https://scontent.example.fbcdn.net/${c.id}.jpg`)).toBe(true);
    const first = ds.creatives.find((c) => c.id === meta.ads[0].id);
    if (first) expect(first.imageUrl).toBeNull();
  });

  it("e-commerce com a Meta: o funil de compra dela, cada etapa sobre a anterior", () => {
    const ds = datasetFromWarehouse([meta], { profile: "ecommerce", today });
    expect(ds.funnel[0]?.label).toBe("Cliques no link");
    expect(ds.funnel.at(-1)?.label).toBe("Compras");
    expect(ds.funnel.every((s) => typeof s.count === "number")).toBe(true);
  });
});
