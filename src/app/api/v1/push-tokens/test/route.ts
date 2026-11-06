// POST /api/v1/push-tokens/test: manda uma notificação de teste para os
// aparelhos de quem pediu (botão em Conta), com a análise mais importante do
// workspace quando houver.

import { z } from "zod";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { loadWorkspaceInsights } from "@/server/insights/load";
import { pushConfigured, sendPushToUser } from "@/server/push/send";

const Input = z.object({ workspaceId: z.uuid().nullish() });

export async function POST(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId } = Input.catch({}).parse(await request.json().catch(() => ({})));
  const cfg = pushConfigured();
  if (!cfg.ios && !cfg.android) return apiJson({ error: { code: "push:not_configured", message: "O envio de notificações ainda não foi configurado no servidor." } }, 503);

  let msg = { title: "VYZ", body: "Notificações ligadas. Você vai receber aqui o resumo e os alertas das suas contas.", data: {} as Record<string, string> };
  if (workspaceId) {
    const top = (await loadWorkspaceInsights(session.db, workspaceId, "7d", 6).catch(() => null))?.insights[0];
    if (top) msg = { title: top.title, body: top.body, data: { dashboardId: top.dashboardId, ...(top.campaignId ? { campaignId: top.campaignId } : {}), ...(top.metric ? { metric: top.metric } : {}) } };
  }
  const result = await sendPushToUser(session.userId, msg);
  if (result.sent === 0) return apiJson({ error: { code: "push:no_device", message: "Nenhum aparelho recebeu. Confira se as notificações do VYZ estão permitidas nos ajustes do celular." } }, 409);
  return apiJson({ ok: true, ...result });
}
