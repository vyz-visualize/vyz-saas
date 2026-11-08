import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const WS = "7b0e4f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const TASK = "1a2b3c4d-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

let session: { userId: string; db: object } | null = null;
let workspace: { workspace: { id: string; timezone: string }; role: string; access: { hasAccess: boolean } } | null = null;
const generate = vi.fn(async () => ({ created: 0, closed: 0 }));
const update = vi.fn();

vi.mock("@/server/auth/bearer", () => ({
  bearerSession: async () => session,
  apiJson: (body: unknown, status = 200) => Response.json(body, { status }),
  unauthorized: () => Response.json({ error: { code: "auth:required" } }, { status: 401 }),
}));
vi.mock("@/server/auth/bearer-workspace", () => ({ bearerWorkspace: async () => workspace }));
vi.mock("@/server/supabase/admin", () => ({ createAdminSupabase: () => ({}) }));
vi.mock("@/server/todo/automation", () => ({ maybeGenerateAutoTasks: generate }));
vi.mock("@/server/todo/queries", () => ({
  todoLevel: () => "basic",
  listTasks: async () => [
    { id: "a", title: "Baixa", status: "planejado", priority: "baixa", dueDate: "2020-01-01", createdAt: "2026-11-01T00:00:00Z", assignees: [] },
    { id: "b", title: "Alta", status: "em_andamento", priority: "alta", dueDate: "2999-01-01", createdAt: "2026-11-01T00:00:00Z", assignees: [] },
  ],
}));
vi.mock("@/server/todo/mutations", () => ({ updateTaskRow: update }));
vi.mock("@/server/optimize/service", () => ({ listRuns: async () => [] }));

const { GET } = await import("./route");
const { PATCH } = await import("./[taskId]/route");
const { appError } = await import("@/server/supabase/errors");

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const get = (id = WS) => GET(new Request(`http://localhost/api/v1/workspaces/${id}/tasks`, { headers: { authorization: "Bearer x" } }), ctx({ workspaceId: id }));
const patch = (body: unknown, id = TASK) =>
  PATCH(new Request(`http://localhost/api/v1/workspaces/${WS}/tasks/${id}`, { method: "PATCH", headers: { authorization: "Bearer x" }, body: JSON.stringify(body) }), ctx({ workspaceId: WS, taskId: id }));

beforeEach(() => {
  session = { userId: "u1", db: {} };
  workspace = { workspace: { id: WS, timezone: "America/Sao_Paulo" }, role: "member", access: { hasAccess: true } };
  generate.mockClear();
  update.mockReset();
});

describe("GET /api/v1/workspaces/:id/tasks", () => {
  it("sem sessão: 401", async () => {
    session = null;
    expect((await get()).status).toBe(401);
  });

  it("workspace inválido ou de outra pessoa", async () => {
    expect((await get("x")).status).toBe(400);
    workspace = null;
    expect((await get()).status).toBe(403);
  });

  it("lista ordenada por prioridade, com situação, e gera as automáticas", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks.map((t: { id: string }) => t.id)).toEqual(["b", "a"]);
    expect(body.tasks[1].situation).toBe("atrasado");
    expect(body.level).toBe("basic");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("sem plano ativo não gera", async () => {
    workspace!.access.hasAccess = false;
    await get();
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/workspaces/:id/tasks/:taskId", () => {
  it("leitura não edita", async () => {
    workspace!.role = "viewer";
    expect((await patch({ status: "concluido" })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("corpo vazio: 400", async () => {
    const res = await PATCH(new Request(`http://localhost/x`, { method: "PATCH", body: "nada" }), ctx({ workspaceId: WS, taskId: TASK }));
    expect(res.status).toBe(400);
  });

  it("erro de validação e de plano viram 400 e 403", async () => {
    update.mockRejectedValueOnce(appError("validation", "Confira."));
    expect((await patch({ status: "x" })).status).toBe(400);
    update.mockRejectedValueOnce(appError("forbidden", "Disponível no Avançado"));
    expect((await patch({ assignees: ["u2"] })).status).toBe(403);
  });

  it("conclui a tarefa", async () => {
    update.mockResolvedValueOnce({ id: TASK, status: "concluido", dueDate: null });
    const res = await patch({ status: "concluido" });
    expect(res.status).toBe(200);
    expect((await res.json()).task).toMatchObject({ id: TASK, situation: "concluido" });
    expect(update).toHaveBeenCalledWith({}, WS, TASK, { status: "concluido" }, "basic");
  });
});
