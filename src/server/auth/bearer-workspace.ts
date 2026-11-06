import "server-only";

// Sessão de workspace para o app (Bearer): a mesma que o site monta com
// cookies, no workspace pedido (ou no padrão do perfil), com o RLS do usuário.

import type { WorkspaceSession } from "@/features/workspace/session";
import type { BearerSession } from "./bearer";
import { composeWorkspaceSession, loadViewer } from "./workspace";

export async function bearerWorkspace(session: BearerSession, workspaceId?: string | null): Promise<WorkspaceSession | null> {
  const viewer = await loadViewer(session.db, { id: session.userId, email: session.email });
  if (workspaceId && !viewer.memberships.some((m) => m.workspace.id === workspaceId)) return null;
  return composeWorkspaceSession(session.db, viewer, workspaceId);
}
