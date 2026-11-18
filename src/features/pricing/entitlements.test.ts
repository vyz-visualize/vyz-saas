import { VISUALS } from "@/features/templates/dashboards/composed";
import { describe, expect, it } from "vitest";
import { PLATFORMS } from "@/features/accounts/platforms";
import { ALL_DASHBOARD_TEMPLATES } from "@/features/templates/live";
import { LANDING_TEMPLATES } from "@/features/templates/landing-pages";
import { PAGES } from "@/features/templates/pages";
import { canUse, ENTITLEMENTS, isUnlimitedMemberLimit, LIMIT_ROWS, LIMIT_TIERS, membersLabel, templateCountsLabel, TIERS, UNLIMITED_MEMBERS, unlimitedMembers } from "./entitlements";

const count = (tier: (typeof TIERS)[number], list: { tier: string }[]) => list.filter((t) => canUse(tier, t.tier as never)).length;

describe("limites por plano", () => {
  it("contagem de templates bate com o cadastro", () => {
    for (const tier of TIERS) {
      expect(VISUALS.filter((v) => canUse(tier, v.tier)).length).toBe(ENTITLEMENTS[tier].dashboardTemplates);
      expect(count(tier, LANDING_TEMPLATES)).toBe(ENTITLEMENTS[tier].landingTemplates);
    }
  });

  it("rótulo dos cartões da LP", () => {
    expect(templateCountsLabel("base")).toBe("2 visuais de dashboard · 4 de landing page");
    expect(templateCountsLabel("pro")).toBe("3 visuais de dashboard · 8 de landing page");
    expect(templateCountsLabel("avancado")).toBe("6 visuais de dashboard · 13 de landing page");
  });

  it("Base só usa Meta (com Instagram e Página, que vêm pelo mesmo login), Google Ads e GA4", () => {
    const base = Object.values(PLATFORMS).filter((p) => canUse("base", p.tier)).map((p) => p.id);
    expect(base.sort()).toEqual(["facebook", "ga4", "google", "instagram", "meta"]);
    expect(canUse("pro", PLATFORMS.tiktok.tier)).toBe(true);
  });

  it("páginas: Base essenciais, Pro + Pro, Avançado todas", () => {
    expect(canUse("base", PAGES.publico.tier)).toBe(false);
    expect(canUse("pro", PAGES.publico.tier)).toBe(true);
    // Criativos é de todos os planos; a profundidade vem de ENTITLEMENTS.creatives
    expect(canUse("base", PAGES.criativos.tier)).toBe(true);
    expect(canUse("pro", PAGES["leads-crm"].tier)).toBe(false);
    expect(canUse("avancado", PAGES["leads-crm"].tier)).toBe(true);
  });

  it("marca própria só no Personalizado", () => {
    expect(TIERS.filter((t) => ENTITLEMENTS[t].whiteLabel)).toEqual(["personalizado"]);
  });

  it("todo template usa só plataformas do próprio plano", () => {
    for (const t of ALL_DASHBOARD_TEMPLATES) for (const s of t.sources) expect(canUse(t.tier, PLATFORMS[s].tier)).toBe(true);
  });
});

describe("dashboards e usuários por plano", () => {
  it("dashboards: Básico 3, Padrão 10, Avançado 40, Personalizado 100", () => {
    expect(TIERS.map((t) => ENTITLEMENTS[t].maxDashboards)).toEqual([3, 10, 40, 100]);
  });

  it("usuários: Básico 1; os outros ilimitados (UNLIMITED_MEMBERS = 1000)", () => {
    expect(UNLIMITED_MEMBERS).toBe(1000);
    expect(TIERS.map((t) => ENTITLEMENTS[t].maxMembers)).toEqual([1, 1000, 1000, 1000]);
    expect(TIERS.map(unlimitedMembers)).toEqual([false, true, true, true]);
    expect(unlimitedMembers(null)).toBe(false);
  });

  it("membersLabel: \"1 usuário\" / \"usuários ilimitados\", sem o número interno", () => {
    expect(TIERS.map((t) => membersLabel(t))).toEqual(["1 usuário", "usuários ilimitados", "usuários ilimitados", "usuários ilimitados"]);
    expect(membersLabel("base", { capital: true })).toBe("1 usuário");
    expect(membersLabel("pro", { capital: true })).toBe("Usuários ilimitados");
  });

  it("limite lido do banco: 1000 ou mais (ou nulo) é ilimitado", () => {
    expect(isUnlimitedMemberLimit(1)).toBe(false);
    expect(isUnlimitedMemberLimit(5)).toBe(false);
    expect(isUnlimitedMemberLimit(1000)).toBe(true);
    expect(isUnlimitedMemberLimit(null)).toBe(true);
  });

  it("tabela de limites: Usuários \"1\" e \"ilimitados\"; o 1000 nunca aparece", () => {
    const row = (label: string) => LIMIT_ROWS.find((r) => r.label === label)!;
    expect(LIMIT_TIERS.map(row("Usuários").value)).toEqual(["1", "ilimitados", "ilimitados"]);
    expect(LIMIT_TIERS.map(row("Dashboards").value)).toEqual(["3", "10", "40"]);
    for (const r of LIMIT_ROWS) for (const t of TIERS) expect(r.value(t)).not.toContain("1000");
  });
});
