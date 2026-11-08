import "server-only";

// Quem aplica a mudança em cada plataforma. Antes de mudar, lê o valor atual
// na plataforma e só segue se ele ainda é o "de" da ação (ninguém mexeu na
// campanha depois da análise). Conexão simulada: muda só a campanha no banco.
//
// Meta (Marketing API, v26): POST /<campaign_id> com status ou daily_budget
//   (em centavos da moeda da conta). Exige ads_management na conexão. Campanha
//   com orçamento nos conjuntos (sem daily_budget na campanha) não muda por aqui.
// Google Ads (API v26, REST): campaigns:mutate (status) e campaignBudgets:mutate
//   (amountMicros). Orçamento compartilhado entre campanhas não muda por aqui.
// TikTok (Business API v1.3): campaign/status/update e campaign/update (budget).
//   Ainda sem login do TikTok no VYZ: a conexão não existe, a ação não aparece.

import type { OptimizationAction } from "@/features/optimize/actions";
import { ADS, developerToken } from "@/server/integrations/providers/google";
import { fetchJson } from "@/server/integrations/providers/http";
import { graph } from "@/server/integrations/providers/meta";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { DB } from "@/server/supabase/server";

export type ExecTarget = {
  connectionId: string;
  isMock: boolean;
  scopes: string[];
  campaignExternalId: string;
  accountExternalId: string;
  /** Google: login-customer-id (MCC ou a própria conta), sem hífens. */
  loginCustomerId: string | null;
};

export class ExecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecError";
  }
}

const close = (a: number, b: number) => Math.abs(a - b) < 0.01;

function checkFrom(action: OptimizationAction, current: { status?: "active" | "paused"; budget?: number | null }) {
  if (action.kind === "pause") {
    if (current.status !== action.from) throw new ExecError("A campanha mudou na plataforma depois da análise. Nada foi alterado.");
    return;
  }
  if (current.budget == null) throw new ExecError("Esta campanha não tem orçamento diário próprio (o orçamento está nos conjuntos ou é compartilhado).");
  if (!close(current.budget, action.from as number)) throw new ExecError("O orçamento mudou na plataforma depois da análise. Nada foi alterado.");
}

// ---- simulado ---------------------------------------------------------------------------

async function applyMock(db: DB, action: OptimizationAction) {
  const { data: c } = await db.from("ad_campaigns").select("status, daily_budget").eq("id", action.campaignId).maybeSingle();
  if (!c) throw new ExecError("Campanha não encontrada.");
  checkFrom(action, {
    status: c.status === "paused" ? "paused" : "active",
    budget: c.daily_budget,
  });
}

// ---- Meta -------------------------------------------------------------------------------

async function applyMeta(action: OptimizationAction, t: ExecTarget) {
  if (!t.scopes.includes("ads_management")) throw new ExecError("A conexão do Meta só tem permissão de leitura. Reconecte a conta para o VYZ poder aplicar mudanças.");
  const token = await getValidAccessToken(t.connectionId);
  const id = t.campaignExternalId;
  const cur = await graph<{
    effective_status?: string;
    status?: string;
    daily_budget?: string;
  }>(`/${id}`, { fields: "status,daily_budget" }, token, "Meta: campanha");
  const offset = await metaOffset(t, token);
  checkFrom(action, {
    status: cur.status === "PAUSED" ? "paused" : "active",
    budget: cur.daily_budget ? Number(cur.daily_budget) / offset : null,
  });
  const params: Record<string, string> = action.kind === "pause" ? { status: action.to === "paused" ? "PAUSED" : "ACTIVE" } : { daily_budget: String(Math.round((action.to as number) * offset)) };
  await graph<{ success?: boolean }>(`/${id}`, params, token, "Meta: atualizar campanha", "POST");
}

/** Fator da menor unidade da moeda da conta (BRL: 100; JPY: 1). */
async function metaOffset(t: ExecTarget, token: string): Promise<number> {
  const acc = await graph<{ currency?: string }>(`/${t.accountExternalId}`, { fields: "currency" }, token, "Meta: moeda da conta");
  return ["JPY", "KRW", "CLP", "COP", "HUF", "ISK", "TWD", "VND", "PYG", "IDR"].includes(acc.currency ?? "") ? 1 : 100;
}

// ---- Google Ads -------------------------------------------------------------------------

type GoogleRow = {
  campaign?: {
    resourceName?: string;
    status?: string;
    campaignBudget?: string;
  };
  campaignBudget?: {
    resourceName?: string;
    amountMicros?: string;
    explicitlyShared?: boolean;
  };
};

async function applyGoogle(action: OptimizationAction, t: ExecTarget) {
  const token = await getValidAccessToken(t.connectionId);
  const customer = t.accountExternalId.replace(/-/g, "");
  if (!/^\d{10}$/.test(customer) || !/^\d+$/.test(t.campaignExternalId)) throw new ExecError("Conta ou campanha do Google Ads inválida.");
  const headers = {
    Authorization: `Bearer ${token}`,
    "developer-token": developerToken(),
    "login-customer-id": t.loginCustomerId ?? customer,
    "Content-Type": "application/json",
  };
  const query = `SELECT campaign.resource_name, campaign.status, campaign.campaign_budget, campaign_budget.amount_micros, campaign_budget.explicitly_shared FROM campaign WHERE campaign.id = ${t.campaignExternalId}`;
  const res = await fetchJson<{ results?: GoogleRow[] }>(`${ADS}/customers/${customer}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    label: "Google: campanha",
  });
  const row = res.results?.[0];
  if (!row?.campaign?.resourceName) throw new ExecError("Campanha não encontrada no Google Ads.");
  const shared = row.campaignBudget?.explicitlyShared === true;
  checkFrom(action, {
    status: row.campaign.status === "PAUSED" ? "paused" : "active",
    budget: shared || !row.campaignBudget?.amountMicros ? null : Number(row.campaignBudget.amountMicros) / 1e6,
  });
  if (action.kind === "pause") {
    await fetchJson(`${ADS}/customers/${customer}/campaigns:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName: row.campaign.resourceName,
              status: action.to === "paused" ? "PAUSED" : "ENABLED",
            },
            updateMask: "status",
          },
        ],
      }),
      label: "Google: status da campanha",
    });
    return;
  }
  // micros em múltiplos de 10.000 (centavo)
  const micros = String(Math.round((action.to as number) * 100) * 10_000);
  await fetchJson(`${ADS}/customers/${customer}/campaignBudgets:mutate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      operations: [
        {
          update: {
            resourceName: row.campaignBudget!.resourceName,
            amountMicros: micros,
          },
          updateMask: "amount_micros",
        },
      ],
    }),
    label: "Google: orçamento da campanha",
  });
}

// ---- TikTok -----------------------------------------------------------------------------

const TIKTOK = "https://business-api.tiktok.com/open_api/v1.3";
type TikTokRes<T> = { code?: number; message?: string; data?: T };

async function tiktok<T>(path: string, token: string, body: unknown, label: string, method = "POST"): Promise<T> {
  const url = method === "GET" ? `${TIKTOK}${path}?${new URLSearchParams(body as Record<string, string>)}` : `${TIKTOK}${path}`;
  const res = await fetchJson<TikTokRes<T>>(url, {
    method,
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    label,
  });
  if (res.code !== 0) throw new ExecError(`TikTok recusou a mudança (código ${res.code ?? "?"}).`);
  return res.data as T;
}

async function applyTikTok(action: OptimizationAction, t: ExecTarget) {
  const token = await getValidAccessToken(t.connectionId);
  const advertiser_id = t.accountExternalId;
  const list = await tiktok<{
    list?: {
      operation_status?: string;
      budget?: number;
      budget_mode?: string;
    }[];
  }>(
    "/campaign/get/",
    token,
    {
      advertiser_id,
      filtering: JSON.stringify({ campaign_ids: [t.campaignExternalId] }),
    },
    "TikTok: campanha",
    "GET",
  );
  const c = list.list?.[0];
  if (!c) throw new ExecError("Campanha não encontrada no TikTok.");
  checkFrom(action, {
    status: c.operation_status === "DISABLE" ? "paused" : "active",
    budget: c.budget_mode === "BUDGET_MODE_DAY" ? (c.budget ?? null) : null,
  });
  if (action.kind === "pause") {
    await tiktok(
      "/campaign/status/update/",
      token,
      {
        advertiser_id,
        campaign_ids: [t.campaignExternalId],
        operation_status: action.to === "paused" ? "DISABLE" : "ENABLE",
      },
      "TikTok: status",
    );
    return;
  }
  await tiktok("/campaign/update/", token, { advertiser_id, campaign_id: t.campaignExternalId, budget: action.to }, "TikTok: orçamento");
}

/** Aplica na plataforma e espelha na campanha do banco (a próxima sincronização confirma). */
export async function execute(db: DB, action: OptimizationAction, t: ExecTarget): Promise<void> {
  if (t.isMock) await applyMock(db, action);
  else if (action.platform === "meta") await applyMeta(action, t);
  else if (action.platform === "google") await applyGoogle(action, t);
  else await applyTikTok(action, t);
  const patch = action.kind === "pause" ? { status: action.to as "active" | "paused" } : { daily_budget: action.to as number };
  const { error } = await db.from("ad_campaigns").update(patch).eq("id", action.campaignId);
  if (error) console.error("[vyz] otimização: espelhar campanha", error.message);
}
