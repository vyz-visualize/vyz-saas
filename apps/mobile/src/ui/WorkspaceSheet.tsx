// Trocar de workspace: a folha que sobe do Início e da Conta. A troca grava o
// padrão no perfil (vale também no site).

import type { MeResponse } from "@vyz/shared";
import { View } from "react-native";
import { useWorkspace } from "@/lib/workspace";
import { Avatar, Card, Divider, ListRow, Sheet } from "./kit";

type Role = MeResponse["workspaces"][number]["role"];
export const ROLE_LABEL: Record<Role, string> = { owner: "Dono", admin: "Administrador", member: "Membro", viewer: "Leitura" };

export function WorkspaceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, workspace, switchTo } = useWorkspace();
  return (
    <Sheet open={open} onClose={onClose} title="Trocar de workspace" caption="Os dashboards, as análises e as tarefas mudam junto.">
      <Card padded={false} style={{ gap: 0, overflow: "hidden" }}>
        {me?.workspaces.map((w, i) => (
          <View key={w.id}>
            {i > 0 ? <Divider inset={62} /> : null}
            <ListRow
              label={w.name}
              caption={ROLE_LABEL[w.role]}
              icon={<Avatar name={w.name} size={36} tone="solid" square />}
              selected={w.id === workspace?.id}
              right={w.id === workspace?.id ? undefined : <View />}
              onPress={() => {
                void switchTo(w.id);
                onClose();
              }}
            />
          </View>
        ))}
      </Card>
    </Sheet>
  );
}
