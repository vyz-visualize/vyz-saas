import { describe, expect, it } from "vitest";
import { aggregateOrganic, type OrganicDayRow } from "./organic";
import { sampleOrganic } from "./preview";

const day = (id: string, date: string, over: Partial<OrganicDayRow> = {}): OrganicDayRow => ({
  ad_account_id: id, date, followers: null, follows: null, unfollows: null, views: 100, reach: 50, profile_views: null, accounts_engaged: null, interactions: 10, link_clicks: null, posts: 0, ...over,
});
const current = { from: "2026-11-08", to: "2026-11-10", days: 3 };
const previous = { from: "2026-11-05", to: "2026-11-07", days: 3 };
const profiles = [{ id: "ig", name: "@loja", platform: "instagram" as const }, { id: "fb", name: "Loja", platform: "facebook" as const }];

describe("orgânico no dashboard", () => {
  it("soma os perfis por dia e compara com o período anterior", () => {
    const rows = ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"].flatMap((d) => [day("ig", d), day("fb", d, { views: 40, reach: null, interactions: 4 })]);
    const v = aggregateOrganic(profiles, rows, [], current, previous);
    const k = Object.fromEntries(v.kpis.map((x) => [x.id, x]));
    expect(k.views.value).toBe(420);
    expect(k.views.delta).toBe(0);
    expect(k.interactions.value).toBe(42);
    expect(k.engagement.value).toBeCloseTo(42 / 150);
    expect(v.daily).toHaveLength(3);
    expect(v.byProfile.find((p) => p.id === "fb")!.reach).toBeNull();
  });

  it("seguidores: o último número conhecido; novos = seguir menos deixar de seguir", () => {
    const rows = [day("ig", "2026-11-07", { followers: 1000 }), day("ig", "2026-11-09", { follows: 30, unfollows: 5 }), day("ig", "2026-11-10", { followers: 1025, follows: 2, unfollows: 2 })];
    const v = aggregateOrganic(profiles.slice(0, 1), rows, [], current, previous);
    const k = Object.fromEntries(v.kpis.map((x) => [x.id, x]));
    expect(k.followers.value).toBe(1025);
    expect(k.followers.previous).toBe(1000);
    expect(k.followers_net.value).toBe(25);
  });

  it("ranking de conteúdo por interações, só do período", () => {
    const post = (id: string, at: string, interactions: number) => ({ ad_account_id: "ig", external_id: id, kind: "reel", caption: null, permalink: null, thumbnail_url: null, published_at: at, views: 10, reach: 5, likes: null, comments: null, shares: null, saves: null, interactions });
    const v = aggregateOrganic(profiles, [], [post("a", "2026-11-08T12:00:00Z", 5), post("b", "2026-11-09T12:00:00Z", 50), post("c", "2026-11-01T12:00:00Z", 999)], current, previous);
    expect(v.posts.map((p) => p.id)).toEqual(["ig:b", "ig:a"]);
    expect(v.posts[0].caption).toBe("Sem legenda");
    expect(v.byKind).toEqual([{ kind: "reel", posts: 2, interactions: 55, views: 20 }]);
    expect(v.hasData).toBe(true);
  });

  it("a prévia da galeria traz os dois perfis com dados", () => {
    const v = sampleOrganic({ from: "2026-10-12", to: "2026-11-10", days: 30 }, { from: "2026-09-12", to: "2026-10-11", days: 30 });
    expect(v.profiles).toHaveLength(2);
    expect(v.hasData).toBe(true);
    expect(v.kpis.find((k) => k.id === "followers")!.value).toBeGreaterThan(0);
  });
});
