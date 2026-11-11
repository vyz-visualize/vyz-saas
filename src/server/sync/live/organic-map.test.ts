import { describe, expect, it } from "vitest";
import { igDay, igKind, igPost, pageDay, pagePost, pageSeries } from "./organic-map";

describe("orgânico: mapeadores da Graph API", () => {
  it("Instagram: total do dia, com seguir e deixar de seguir pela quebra follow_type", () => {
    const day = igDay(
      "2026-11-10",
      [
        { name: "reach", total_value: { value: 1200 } },
        { name: "views", total_value: { value: 3400 } },
        { name: "likes", total_value: { value: 90 } },
        { name: "comments", total_value: { value: 7 } },
        { name: "shares", total_value: { value: 3 } },
        { name: "saves", total_value: { value: 12 } },
        { name: "follows_and_unfollows", total_value: { breakdowns: [{ results: [{ dimension_values: ["FOLLOWER"], value: 25 }, { dimension_values: ["NON_FOLLOWER"], value: 4 }] }] } },
      ],
      15_000,
      2,
    );
    expect(day).toMatchObject({ date: "2026-11-10", followers: 15_000, follows: 25, unfollows: 4, views: 3400, reach: 1200, interactions: 112, posts: 2 });
    expect(day.profileViews).toBeNull();
  });

  it("Instagram: tipo do post pelo media_product_type", () => {
    expect(igKind({ media_product_type: "REELS", media_type: "VIDEO" })).toBe("reel");
    expect(igKind({ media_product_type: "STORY", media_type: "IMAGE" })).toBe("story");
    expect(igKind({ media_type: "CAROUSEL_ALBUM" })).toBe("carousel");
    const story = igPost({ id: "1", timestamp: "2026-11-10T12:00:00+0000", media_product_type: "STORY" }, [{ name: "views", values: [{ value: 500 }] }]);
    expect(story).toMatchObject({ kind: "story", views: 500, likes: null, saves: null });
  });

  it("Página: série diária pela véspera do end_time e total do dia", () => {
    const dateOf = (end: string) => (end.startsWith("2026-11-11") ? "2026-11-10" : "x");
    const views = pageSeries({ name: "page_media_view", values: [{ value: 800, end_time: "2026-11-11T08:00:00+0000" }] }, dateOf);
    const day = pageDay("2026-11-10", { page_media_view: views }, 1);
    expect(day).toMatchObject({ views: 800, followers: null, interactions: 0, posts: 1, saves: null });
  });

  it("Página: post com reações, comentários e compartilhamentos", () => {
    const p = pagePost(
      { id: "10_20", created_time: "2026-11-10T15:00:00+0000", message: " Oi ", full_picture: "https://x/y.jpg", reactions: { summary: { total_count: 40 } }, comments: { summary: { total_count: 5 } }, shares: { count: 2 } },
      [{ name: "post_media_view", values: [{ value: 1500 }] }],
    );
    expect(p).toMatchObject({ kind: "post", caption: "Oi", views: 1500, likes: 40, comments: 5, shares: 2, interactions: 47 });
  });
});
