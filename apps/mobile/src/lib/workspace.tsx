// Quem está logado e qual workspace está aberto, compartilhado pelas abas.
// Trocar de workspace grava o padrão no perfil (vale também no site).

import type { MeResponse } from "@vyz/shared";
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

type Ws = MeResponse["workspaces"][number];

type State = {
  me: MeResponse | null;
  workspace: Ws | null;
  error: string | null;
  refresh(): Promise<void>;
  switchTo(id: string): Promise<void>;
};

const Ctx = createContext<State | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<MeResponse>("/me"));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTo = useCallback(async (id: string) => {
    setMe((m) => (m ? { ...m, defaultWorkspaceId: id } : m));
    await api("/me", { method: "PATCH", body: JSON.stringify({ defaultWorkspaceId: id }) }).catch(() => {});
  }, []);

  const workspace = me?.workspaces.find((w) => w.id === me.defaultWorkspaceId) ?? me?.workspaces[0] ?? null;
  return <Ctx value={{ me, workspace, error, refresh, switchTo }}>{children}</Ctx>;
}

export function useWorkspace(): State {
  const s = use(Ctx);
  if (!s) throw new Error("useWorkspace precisa do WorkspaceProvider");
  return s;
}
