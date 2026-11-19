"use client";

// Campos de ajustes do dashboard: nome, cliente, meta de CPA/CPL (opcional), margem, verba,
// período e atribuição. Os mesmos no "Novo dashboard" e no editor; cada tela decide o layout.

import { SelectField, TextField } from "@/components/ui/kit";
import { ATTRIBUTIONS, PERIODS, type PeriodId } from "@/features/workspace/types";
import { breakEvenRoas, reais, toCents, type DraftBase } from "./draft-fields";

type Settings = Pick<DraftBase, "name" | "client" | "goal" | "budget" | "margin" | "period" | "customDays" | "attribution">;

export function SettingsFields({
  draft,
  save,
  placeholderName,
  errors,
  goalLabel,
}: {
  draft: Settings;
  save: (patch: Partial<Settings>) => void;
  placeholderName: string;
  errors?: Partial<Record<"name" | "client", string>>;
  /** Com rótulo, mostra a meta de CPA/CPL (no editor ela fica na aba Metas). */
  goalLabel?: string;
}) {
  return (
    <>
      <TextField label="Nome do dashboard" value={draft.name} placeholder={placeholderName} error={errors?.name} onChange={(name) => save({ name })} />
      <TextField label="Cliente" value={draft.client} placeholder="Ex.: Loja Verde" error={errors?.client} onChange={(client) => save({ client })} />
      {goalLabel && (
        <TextField label={goalLabel} prefix="R$" inputMode="numeric" value={reais(draft.goal)} placeholder="60" hint="Vira a linha tracejada nos gráficos." onChange={(v) => save({ goal: toCents(v) })} />
      )}
      <TextField
        label="Margem"
        suffix="%"
        inputMode="numeric"
        value={draft.margin ? String(Math.round(draft.margin * 100)) : ""}
        placeholder="sem margem"
        hint={draft.margin ? `ROAS de equilíbrio = 1 ÷ margem = ${breakEvenRoas(draft.margin)}` : "Sem margem, o equilíbrio é ROAS 1 (receita = investimento)."}
        onChange={(v) => {
          const n = Number(v.replace(/\D/g, ""));
          save({ margin: n > 0 ? Math.min(100, n) / 100 : null });
        }}
      />
      <TextField label="Verba mensal" prefix="R$" inputMode="numeric" value={reais(draft.budget)} placeholder="50000" hint="Usada no pacing e na projeção do mês." onChange={(v) => save({ budget: toCents(v) })} />
      <SelectField label="Período padrão" value={draft.period} onChange={(v) => save({ period: v as PeriodId })} options={PERIODS} />
      {draft.period === "custom" && (
        <TextField
          label="Dias do período personalizado"
          inputMode="numeric"
          value={String(draft.customDays)}
          hint="De 3 a 60 dias, terminando ontem."
          onChange={(v) => save({ customDays: Math.min(60, Math.max(3, Number(v.replace(/\D/g, "")) || 3)) })}
        />
      )}
      <SelectField label="Janela de atribuição exibida" value={draft.attribution} onChange={(v) => save({ attribution: v })} options={ATTRIBUTIONS} />
    </>
  );
}
