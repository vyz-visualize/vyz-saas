import { describe, expect, it } from "vitest";
import { anyDashboardTemplate } from "@/features/templates/live";
import { composePages } from "@/features/templates/dashboards/composed";
import type { PageId } from "@/features/templates/types";
import { featuresOf, recompose } from "./draft";

const t = anyDashboardTemplate("vyz-ecommerce")!;

describe("recompose", () => {
  it("sem ordem própria, segue o modelo", () => {
    expect(recompose(t, "personalizado", [], ["meta"], [])).toEqual(composePages(["meta"]));
  });

  it("mantém a ordem que a pessoa arrumou e encaixa as páginas novas na posição do modelo", () => {
    const mine: PageId[] = ["publico", "visao-geral", "criativos", "funil"];
    const out = recompose(t, "personalizado", mine, ["meta", "google"], []);
    expect(out.slice(0, 3)).toEqual(["publico", "visao-geral", "meta-ads"]);
    expect(new Set(out)).toEqual(new Set(composePages(["meta", "google"])));
  });

  it("tira as páginas da plataforma desligada e respeita o plano", () => {
    expect(recompose(t, "personalizado", composePages(["meta", "google"]), ["google"], [])).toEqual(composePages(["google"]));
    expect(recompose(t, "base", [], ["meta", "google"], ["mmm"])).not.toContain("mmm");
  });

  it("recursos ligados saem das páginas", () => {
    expect(featuresOf(["visao-geral", "metas", "mmm"])).toEqual(["metas", "mmm"]);
  });
});
