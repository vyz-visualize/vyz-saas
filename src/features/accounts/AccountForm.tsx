"use client";

// Cadastro de conta pelo ID (plataformas sem login no VYZ), com máscara e
// validação de formato no navegador e de novo no servidor (addManualAccount).
// Meta Ads e Google Ads entram pelo botão Conectar.

import Link from "next/link";
import { useState, useTransition } from "react";
import { LockBadge, PendingChip, SelectField, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { ConnectButton } from "@/features/integrations/ConnectButton";
import { isProviderId, PROVIDERS } from "@/features/integrations/providers";
import { availableIn, canUse, TIER_LABEL } from "@/features/pricing/entitlements";
import type { Account } from "@/features/workspace/types";
import { useWorkspace } from "@/features/workspace/workspace";
import { hasRole } from "@/features/workspace/session";
import { addManualAccount } from "@/server/integrations/actions";
import { CONNECTIONS, MODE_LABEL } from "./connection-modes";
import { buildManualAccount, MANUAL_PLATFORMS } from "./manual";
import { PLATFORMS, type PlatformId } from "./platforms";
import { maskId } from "./validate";

export type SavedAccount = { id: string; name: string; platform: PlatformId };

type AccountFormProps = {
  /** Plataforma fixa (no fluxo do dashboard) ou escolha entre as do cadastro manual. */
  platform?: PlatformId;
  onSaved: (a: SavedAccount) => void;
  onCancel?: () => void;
  /** Para onde o login volta, quando a plataforma fixa é Meta ou Google. */
  next?: string;
};

export function AccountForm({ platform: fixed, onSaved, onCancel, next }: AccountFormProps) {
  const { ws, session } = useWorkspace();
  const [platform, setPlatform] = useState<PlatformId>(fixed ?? MANUAL_PLATFORMS[0]);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const def = PLATFORMS[platform];
  const locked = !canUse(ws.tier, def.tier);
  const canManage = session ? hasRole(session.role, "admin") : false;

  if (isProviderId(platform)) {
    return (
      <div className="space-y-3 rounded-card border border-line bg-card p-4 text-[14px]">
        <p>
          {PROVIDERS[platform].name} entra pelo {PROVIDERS[platform].loginName}: o VYZ encontra as contas e importa os dados sozinho.
        </p>
        <ConnectButton provider={platform} next={next} canManage={canManage} />
      </div>
    );
  }

  function save() {
    setFormError(null);
    const check = buildManualAccount({ platformId: platform, name, values });
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    start(async () => {
      const res = await addManualAccount({ platformId: platform, name: name.trim() || undefined, values });
      if (!res.ok) {
        setErrors(res.error.fields ?? {});
        if (!res.error.fields) setFormError(res.error.message);
        return;
      }
      onSaved({ id: res.data.id, name: res.data.name, platform: res.data.platformId });
    });
  }

  return (
    <div className="space-y-4">
      {!fixed && (
        <SelectField
          label="Plataforma"
          value={platform}
          onChange={(v) => {
            setPlatform(v as PlatformId);
            setValues({});
            setErrors({});
            setFormError(null);
          }}
          options={MANUAL_PLATFORMS.map((id) => ({
            value: id,
            label: `${PLATFORMS[id].name}${canUse(ws.tier, PLATFORMS[id].tier) ? "" : ` · ${availableIn(PLATFORMS[id].tier)}`}`,
          }))}
        />
      )}
      <p className="rounded-control bg-field px-3 py-2 text-[13px] text-fg-2">
        <span className="font-medium text-fg">{MODE_LABEL[CONNECTIONS[platform].mode]}.</span> {CONNECTIONS[platform].note}
      </p>
      {locked ? (
        <div className="rounded-card border border-line bg-card p-4 text-[14px]">
          <LockBadge label={availableIn(def.tier)} />
          <p className="mt-2 text-fg-2">
            {def.name} entra a partir do {TIER_LABEL[def.tier]}.{" "}
            <Link href="/painel/plano" className="font-semibold text-accent underline-offset-4 hover:underline">
              Ver planos
            </Link>
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <TextField label="Nome (para você reconhecer)" value={name} onChange={setName} placeholder={`Ex.: ${def.short} · Loja Verde`} disabled={pending} />
          {def.fields.map((f) => (
            <TextField
              key={f.key}
              label={`${f.label}${f.optional ? " (opcional)" : ""}`}
              value={values[f.key] ?? ""}
              placeholder={f.placeholder}
              hint={f.hint}
              error={errors[f.key]}
              disabled={pending}
              inputMode={f.kind === "text" || f.kind === "ga4Measurement" ? "text" : "numeric"}
              onChange={(v) => {
                setValues((s) => ({ ...s, [f.key]: maskId(f.kind, v) }));
                setErrors((e) => ({ ...e, [f.key]: null }));
              }}
            />
          ))}
          <PendingChip
            label="Conexão automática em breve"
            detail="A conta fica como “Aguardando conexão”: não sincroniza nem ocupa o limite do plano. Os dashboards dela usam dados de amostra até a conexão chegar."
          />
          {formError && (
            <p role="alert" className="rounded-control border border-error/60 bg-error-soft p-3 text-[13.5px] text-error-fg">
              {formError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending || !canManage} className={btn.small}>
              {pending ? "Salvando…" : "Adicionar conta"}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} disabled={pending} className={`${btn.ghost} h-9`}>
                Cancelar
              </button>
            )}
          </div>
          {!canManage && <p className="text-[12px] text-fg-2">Só administradores do workspace cadastram contas.</p>}
        </form>
      )}
    </div>
  );
}

/** Texto curto do ID principal (para listas do fluxo antigo de dashboard). */
export function accountIdLabel(a: Pick<Account, "values">): string {
  return a.values.account ?? Object.values(a.values)[0] ?? "—";
}
