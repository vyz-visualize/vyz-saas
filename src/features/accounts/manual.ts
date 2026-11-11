// Cadastro manual (pelo ID): valida os campos da plataforma e monta a linha de
// ad_accounts. A mesma regra roda no formulário e na Server Action. Meta Ads e
// Google Ads entram pelo login (OAuth), não por aqui.

import { PLATFORM_ORDER, PLATFORMS, type PlatformId } from "./platforms";
import { validateId } from "./validate";

/** Plataformas que entram pelo login (botão Conectar). */
// Instagram e Página do Facebook vêm pelo login do Meta (sem cadastro pelo ID).
export const OAUTH_PLATFORMS: PlatformId[] = ["meta", "instagram", "facebook", "google"];

/** Plataformas do cadastro manual, na ordem da tela. */
export const MANUAL_PLATFORMS: PlatformId[] = PLATFORM_ORDER.filter((p) => !OAUTH_PLATFORMS.includes(p));

export const isManualPlatform = (id: string): id is PlatformId => (MANUAL_PLATFORMS as string[]).includes(id);

export type ManualAccountDraft = { platformId: PlatformId; name?: string; values: Record<string, string> };

export type ManualAccountRow = {
  platform_id: PlatformId;
  external_id: string;
  name: string;
  business_external_id: string | null;
  manager_external_id: string | null;
  metadata: { source: "manual"; fields: Record<string, string> };
};

export type ManualAccountCheck = { ok: true; row: ManualAccountRow } | { ok: false; errors: Record<string, string> };

/** Valida e normaliza. Campos que a plataforma não tem são ignorados. */
export function buildManualAccount(draft: ManualAccountDraft): ManualAccountCheck {
  const def = PLATFORMS[draft.platformId];
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const f of def.fields) {
    const raw = (draft.values[f.key] ?? "").trim();
    if (!raw) {
      if (!f.optional) errors[f.key] = "Preencha este campo.";
      continue;
    }
    const check = validateId(f.kind, raw);
    if (check.ok) values[f.key] = check.value;
    else errors[f.key] = check.error;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const name = (draft.name ?? "").trim().replace(/\s+/g, " ").slice(0, 200) || `${def.short} · ${values.account}`;
  return {
    ok: true,
    row: {
      platform_id: draft.platformId,
      external_id: values.account,
      name,
      business_external_id: values.business ?? null,
      manager_external_id: values.mcc ?? null,
      metadata: { source: "manual", fields: values },
    },
  };
}

/** Texto curto do ID principal (para listas). */
export function manualIdLabel(fields: Record<string, string>, externalId: string): string {
  return fields.account ?? externalId;
}
