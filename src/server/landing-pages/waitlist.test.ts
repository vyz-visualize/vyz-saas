import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({}));

const session = { user: { id: "user-1" }, workspace: { id: "ws-1", product: "dash" } };
const inserted: { table: string; row: Record<string, unknown> }[] = [];
const flags = { show: false };

vi.mock("@/lib/flags", () => ({
  get SHOW_LANDING_PAGES() {
    return flags.show;
  },
  landingPagesEnabledFor: (product: string) => flags.show || product === "lp",
}));
vi.mock("@/server/auth/workspace", () => ({ authorize: vi.fn(async () => session) }));
vi.mock("@/server/supabase/server", () => ({
  // como o banco: a segunda inscrição do mesmo usuário bate no unique
  createServerSupabase: vi.fn(async () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        const dup = table === "landing_waitlist" && inserted.some((i) => i.table === table && i.row.user_id === row.user_id && i.row.workspace_id === row.workspace_id);
        if (dup) return { error: { code: "23505", message: "duplicate", details: "", hint: "" } };
        inserted.push({ table, row });
        return { error: null };
      },
    }),
  })),
}));

const load = () => import("./waitlist");

describe("lista de espera das landing pages", () => {
  beforeEach(() => {
    inserted.length = 0;
    flags.show = false;
    session.workspace.product = "dash";
  });
  afterEach(() => vi.restoreAllMocks());

  it("inscreve com workspace, usuário e resposta; o e-mail fica com o banco", async () => {
    const { joinLandingWaitlist } = await load();
    expect(await joinLandingWaitlist("  páginas de captação  ")).toEqual({ ok: true, data: { already: false } });
    expect(inserted).toEqual([{ table: "landing_waitlist", row: { workspace_id: "ws-1", user_id: "user-1", use_case: "páginas de captação" } }]);
  });

  it("a resposta é opcional", async () => {
    const { joinLandingWaitlist } = await load();
    expect((await joinLandingWaitlist("   ")).ok).toBe(true);
    expect(inserted[0].row.use_case).toBeNull();
  });

  it("não duplica: a segunda vez responde que já está na lista", async () => {
    const { joinLandingWaitlist } = await load();
    await joinLandingWaitlist(null);
    expect(await joinLandingWaitlist("de novo")).toEqual({ ok: true, data: { already: true } });
    expect(inserted).toHaveLength(1);
  });

  it("recusa resposta acima do limite sem tocar no banco", async () => {
    const { joinLandingWaitlist } = await load();
    const res = await joinLandingWaitlist("x".repeat(501));
    expect(res.ok).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("com a flag ligada a lista fecha", async () => {
    flags.show = true;
    const { joinLandingWaitlist, recordLandingWaitlistVisit } = await load();
    expect((await joinLandingWaitlist(null)).ok).toBe(false);
    await recordLandingWaitlistVisit();
    expect(inserted).toHaveLength(0);
  });

  it("flag desligada: workspace do produto LP segue fora da lista (tem o módulo)", async () => {
    session.workspace.product = "lp";
    const { joinLandingWaitlist, recordLandingWaitlistVisit } = await load();
    expect((await joinLandingWaitlist(null)).ok).toBe(false);
    await recordLandingWaitlistVisit();
    expect(inserted).toHaveLength(0);
  });

  it("registra a visita só com o workspace", async () => {
    const { recordLandingWaitlistVisit } = await load();
    await recordLandingWaitlistVisit();
    expect(inserted).toEqual([{ table: "landing_waitlist_visits", row: { workspace_id: "ws-1" } }]);
  });

  it("visita que falha não derruba a página", async () => {
    const { authorize } = await import("@/server/auth/workspace");
    vi.mocked(authorize).mockRejectedValueOnce(new Error("sem sessão"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { recordLandingWaitlistVisit } = await load();
    await expect(recordLandingWaitlistVisit()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
});
